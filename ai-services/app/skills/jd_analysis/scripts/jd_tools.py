"""
JD Analysis tools — grounding facts cho Planning Agent.

Triết lý hybrid (xem thiết kế agent):
  - Tool CHỈ trích xuất *facts* từ JD (keyword/regex deterministic, không gọi LLM).
  - Việc *suy luận & sinh nội dung* (competencies, weights, câu hỏi, rubric) là
    của LLM brain (Gemma) — KHÔNG hardcode template trong tool.
  - Lý do tool không tự gọi LLM: mỗi tool-call là 1 round-trip; với extraction thì
    heuristic vừa nhanh vừa đủ chính xác, để dành "trí tuệ" cho LLM tổng hợp.

Matching được làm CHẶT (word-boundary + alias) để tránh false positive kinh điển
khi dò bằng substring: "go" lọt trong "google/good/ago", "java" lọt trong
"javascript", còn "nodejs/k8s/postgres" lại KHÔNG khớp dạng chuẩn. Helper
``skill_present`` ở đây là nguồn chân lý duy nhất, dùng chung cho cả planning skill.
"""

import re
from typing import Annotated

from agent_framework import tool
from pydantic import Field

# Mapping seniority level từ keyword trong JD
_LEVEL_KEYWORDS = {
    "junior": ["junior", "fresher", "entry", "intern", "0-2 year", "1 year"],
    "mid": ["mid", "intermediate", "2-5 year", "3 year", "4 year"],
    "senior": ["senior", "5+ year", "6+ year", "7+ year", "lead", "principal", "staff"],
    "manager": ["manager", "head of", "director", "vp of", "engineering manager"],
}

# Khi nhiều cấp cùng xuất hiện (vd "Senior ... 1 year leading a team"), hòa điểm
# thì ưu tiên CẤP CAO — JD cấp cao thường vô tình chứa keyword cấp thấp, không
# phải ngược lại.
_LEVEL_RANK = {"junior": 0, "mid": 1, "senior": 2, "manager": 3}

# Nhóm kỹ năng phổ biến theo domain — tên CHUẨN (canonical) của mỗi skill.
# Chỉ liệt kê token an toàn với word-boundary; token đơn-lẻ mơ hồ ("r", "rest")
# bị bỏ qua để khỏi sinh false positive ("rest" lọt trong "interest"…).
_TECH_SKILL_DOMAINS = {
    "backend": ["python", "java", "go", "rust", "scala", "kotlin", "c#", "c++",
                "dotnet", "php", "laravel", "ruby", "rails", "node", "express",
                "nestjs", "django", "fastapi", "flask", "spring", "graphql", "grpc",
                "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
                "kafka", "rabbitmq", "docker", "kubernetes"],
    "frontend": ["react", "react native", "vue", "angular", "svelte", "typescript",
                 "javascript", "css", "html", "sass", "tailwind", "nextjs", "vite",
                 "webpack", "flutter", "swift"],
    "data": ["pytorch", "tensorflow", "pandas", "numpy", "spark", "hadoop", "flink",
             "airflow", "dbt", "snowflake", "bigquery", "databricks", "tableau",
             "machine learning", "llm", "rag", "fine-tuning"],
    "devops": ["ci/cd", "terraform", "ansible", "aws", "gcp", "azure", "helm",
               "jenkins", "gitlab", "prometheus", "grafana", "nginx", "linux"],
    "ai": ["langchain", "openai", "anthropic", "huggingface", "transformers",
           "vector database", "pinecone", "weaviate", "ollama", "embedding",
           "prompt engineering", "agent", "rag"],
}

# Các biến thể bề mặt (viết tắt / đồng nghĩa) NGOÀI tên canonical. Chỉ liệt kê
# đồng nghĩa THẬT — word-boundary bên dưới đã chặn false positive trong-từ, nên
# không cần liệt kê biến dạng vô nghĩa.
_SKILL_VARIANTS = {
    "go": ["go", "golang"],
    "node": ["node", "nodejs", "node.js"],
    "javascript": ["javascript", "js"],
    "typescript": ["typescript", "ts"],
    "postgresql": ["postgresql", "postgres", "psql"],
    "mongodb": ["mongodb", "mongo"],
    "kubernetes": ["kubernetes", "k8s"],
    "nextjs": ["nextjs", "next.js", "next js"],
    "react": ["react", "reactjs", "react.js"],
    "react native": ["react native", "react-native"],
    "c#": ["c#", "csharp"],
    "c++": ["c++", "cpp"],
    "dotnet": ["dotnet", ".net", "asp.net"],
    "rails": ["rails", "ruby on rails", "ror"],
    "express": ["express", "express.js", "expressjs"],
    "nestjs": ["nestjs", "nest.js"],
    "tailwind": ["tailwind", "tailwindcss"],
    "huggingface": ["huggingface", "hugging face"],
    "machine learning": ["machine learning", "ml"],
    "ci/cd": ["ci/cd", "cicd", "ci-cd"],
    "fine-tuning": ["fine-tuning", "fine tuning", "finetuning"],
    "vector database": ["vector database", "vector db", "vectordb"],
    "prompt engineering": ["prompt engineering", "prompting"],
}

_VALID_LEVELS = ("junior", "mid", "senior", "manager")


def _variants(skill: str) -> list[str]:
    return _SKILL_VARIANTS.get(skill.lower(), [skill.lower()])


def _token_present(token: str, text_lower: str) -> bool:
    """Khớp ``token`` như MỘT đơn vị: ký tự alnum hai biên phải KHÔNG có thêm.

    Chặn được "go" trong "google", "java" trong "javascript"… nhưng vẫn cho "ci/cd"
    (dấu "/" ở giữa coi như ranh giới) và "node.js" khớp đúng.
    """
    return re.search(
        rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])", text_lower
    ) is not None


def skill_present(skill: str, text_lower: str) -> bool:
    """Skill canonical này có xuất hiện trong text (alias-aware, boundary-safe)?

    Nguồn chân lý chung cho cả JD-analysis lẫn interview-planning skill.
    ``text_lower`` PHẢI đã ``.lower()`` trước (gọi nhiều lần nên không tự lower).
    """
    return any(_token_present(v, text_lower) for v in _variants(skill))


def detect_domain(text_lower: str, position: str = "") -> str:
    """Đoán domain chính từ position + nội dung JD (dùng cho problem bank)."""
    blob = f"{position} {text_lower}".lower()
    scores = {
        domain: sum(1 for skill in skills if skill_present(skill, blob))
        for domain, skills in _TECH_SKILL_DOMAINS.items()
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "backend"


def _detect_seniority(text_lower: str) -> str:
    """Chấm điểm mọi cấp rồi chọn cấp nhiều tín hiệu nhất; hòa → ưu tiên cao hơn.

    Khác bản cũ (lặp dict, ``break`` ở match đầu → thiên về junior một cách sai
    lệch), bản này không phụ thuộc thứ tự khai báo và bền với JD nhiễu keyword.
    """
    scores = {
        lvl: sum(1 for kw in kws if kw in text_lower)
        for lvl, kws in _LEVEL_KEYWORDS.items()
    }
    best = max(scores, key=lambda lvl: (scores[lvl], _LEVEL_RANK[lvl]))
    return best if scores[best] > 0 else "mid"


@tool(approval_mode="never_require")
def extract_requirements(
    jd_text: Annotated[str, Field(description="Full job description text (markdown ok)")],
    position: Annotated[str, Field(description="Job title / position name")] = "",
) -> dict:
    """Extract grounding FACTS from a job description: required skills, minimum
    years of experience, seniority level, nice-to-have skills, and the primary
    tech domain. These are raw facts — YOU (the planner) decide the competencies,
    weights, and interview questions from them. Call this first."""
    text_lower = jd_text.lower()

    level = _detect_seniority(text_lower)

    # Skill mentions: word-boundary + alias để khớp đúng tên canonical, không
    # nhân bản và không false positive.
    required_skills: list[str] = []
    for skills in _TECH_SKILL_DOMAINS.values():
        for skill in skills:
            if skill not in required_skills and skill_present(skill, text_lower):
                required_skills.append(skill)

    # Số năm KN tối thiểu: lấy CẬN DƯỚI của lần đề cập đầu tiên ("2-5 years" → 2,
    # "5+ years" → 5, "3 years" → 3). Bản cũ vướng dải "2-5" trả nhầm 5.
    exp_match = re.search(r"(\d+)\s*(?:-\s*\d+\s*)?\+?\s*years?", text_lower)
    min_years = int(exp_match.group(1)) if exp_match else 0

    # Nice-to-have heuristic
    nice_patterns = r"(?:nice.to.have|bonus|preferred|plus)[:\s]+([^\n.]+)"
    nice_to_have = [m.strip() for m in re.findall(nice_patterns, text_lower)]

    return {
        "required_skills": required_skills,
        "min_years_experience": min_years,
        "seniority_level": level,
        "nice_to_have": nice_to_have,
        "domain": detect_domain(text_lower, position),
    }
