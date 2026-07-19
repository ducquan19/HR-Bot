"""
Interview Planning tools — grounding cho Planning Agent (hybrid design).

Hai tool duy nhất, đều deterministic, KHÔNG sinh nội dung phỏng vấn:
  - match_skills      : đối chiếu CV vs required_skills → matched / gaps (tránh
                        LLM "ảo giác" rằng ứng viên có kỹ năng không hề có trong CV).
  - search_problem_bank: trả về các bài coding ỨNG VIÊN có test_cases đã kiểm chứng,
                        để LLM CHỌN/điều chỉnh — không bịa bài coding với test sai.

Việc sinh competencies, câu hỏi, rubric do LLM brain tự suy luận từ CV/JD markdown
+ các facts grounding này, rồi xuất ra InterviewPlan qua response_format.
"""

from typing import Annotated

from agent_framework import tool
from pydantic import Field

# Dùng CHUNG bộ khớp skill (word-boundary + alias) với JD-analysis để
# matched/gaps nhất quán với required_skills và không false positive ("go" trong
# "google", "java" trong "javascript", còn "nodejs/k8s/postgres" vẫn khớp đúng).
from app.skills.jd_analysis.scripts.jd_tools import skill_present

# ── Kho bài coding theo (domain, level) — test_cases đã kiểm chứng ────────────
# Quan trọng: test_cases ở đây phải chạy được, vì Code Assignment Agent sẽ dùng
# chúng để chấm ứng viên. LLM được phép sửa nhẹ statement nhưng GIỮ test_cases.
_CODING_PROBLEMS = {
    ("backend", "junior"): {
        "title": "Two Sum",
        "difficulty": "easy",
        "statement": (
            "Given an array of integers `nums` and an integer `target`, "
            "return the indices of the two numbers that add up to `target`.\n\n"
            "Example:\n  Input: nums = [2, 7, 11, 15], target = 9\n  Output: [0, 1]"
        ),
        "function_name": "two_sum",
        "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\n    pass\n",
        "test_cases": [
            {"label": "Basic", "inputs": [[2, 7, 11, 15], 9], "expected": [0, 1]},
            {"label": "Middle", "inputs": [[3, 2, 4], 6], "expected": [1, 2]},
            {"label": "Same element", "inputs": [[3, 3], 6], "expected": [0, 1]},
        ],
    },
    ("backend", "mid"): {
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "medium",
        "statement": (
            "Given a string `s`, find the length of the longest substring "
            "without repeating characters.\n\n"
            "Example:\n  Input: s = \"abcabcbb\"\n  Output: 3"
        ),
        "function_name": "length_of_longest_substring",
        "starter_code": "def length_of_longest_substring(s: str) -> int:\n    pass\n",
        "test_cases": [
            {"label": "Basic", "inputs": ["abcabcbb"], "expected": 3},
            {"label": "All same", "inputs": ["bbbbb"], "expected": 1},
            {"label": "Empty", "inputs": [""], "expected": 0},
            {"label": "Overlap", "inputs": ["dvdf"], "expected": 3},
        ],
    },
    ("backend", "senior"): {
        "title": "LRU Cache",
        "difficulty": "hard",
        "statement": (
            "Implement a Least Recently Used (LRU) cache with O(1) `get` and `put`.\n\n"
            "  LRUCache(capacity) — initialize with positive capacity\n"
            "  get(key) — return value if exists, else -1\n"
            "  put(key, value) — insert/update; evict LRU if over capacity"
        ),
        "function_name": "lru_cache_ops",
        "starter_code": (
            "class LRUCache:\n"
            "    def __init__(self, capacity: int):\n"
            "        pass\n\n"
            "    def get(self, key: int) -> int:\n"
            "        pass\n\n"
            "    def put(self, key: int, value: int) -> None:\n"
            "        pass\n"
        ),
        "test_cases": [
            {"label": "Basic ops", "inputs": [2, [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["get", 3]]], "expected": [1, -1, 3]},
        ],
    },
    ("ai", "mid"): {
        "title": "Implement a Simple RAG Retrieval",
        "difficulty": "medium",
        "statement": (
            "Given a list of documents and a query, implement a basic RAG retrieval:\n"
            "1. Compute TF-IDF similarity between query and each document\n"
            "2. Return the top-k most relevant documents\n\n"
            "Use only the standard library (no external packages)."
        ),
        "function_name": "retrieve_top_k",
        "starter_code": (
            "def retrieve_top_k(documents: list[str], query: str, k: int) -> list[str]:\n"
            "    pass\n"
        ),
        "test_cases": [
            {"label": "Basic", "inputs": [["AI is great", "Python rocks", "AI and Python"], "AI Python", 2], "expected": 2},
        ],
    },
    ("frontend", "mid"): {
        "title": "Debounce a Function",
        "difficulty": "medium",
        "statement": (
            "Implement `debounce(fn, wait_ms)`: return a wrapper that delays calling "
            "`fn` until `wait_ms` have elapsed since the LAST invocation. Only the "
            "final call within a burst should fire, with the latest arguments.\n\n"
            "Model time as an integer clock passed per call; return the list of "
            "values that actually fired."
        ),
        "function_name": "debounce_calls",
        "starter_code": (
            "def debounce_calls(events: list[tuple[int, int]], wait_ms: int) -> list[int]:\n"
            "    # events = [(timestamp_ms, value), ...] sorted by time\n"
            "    pass\n"
        ),
        "test_cases": [
            {"label": "Burst collapses", "inputs": [[[0, 1], [50, 2], [90, 3]], 100], "expected": [3]},
            {"label": "Spaced out", "inputs": [[[0, 1], [200, 2]], 100], "expected": [1, 2]},
        ],
    },
    ("data", "mid"): {
        "title": "Sessionize Event Stream",
        "difficulty": "medium",
        "statement": (
            "Given user events sorted by time, group them into sessions: a new "
            "session starts when the gap from the previous event of the SAME user "
            "exceeds `gap_seconds`. Return the number of sessions per user."
        ),
        "function_name": "count_sessions",
        "starter_code": (
            "def count_sessions(events: list[tuple[str, int]], gap_seconds: int) -> dict:\n"
            "    # events = [(user_id, ts_seconds), ...] sorted by ts\n"
            "    pass\n"
        ),
        "test_cases": [
            {"label": "Two sessions", "inputs": [[["u1", 0], ["u1", 10], ["u1", 100]], 30], "expected": {"u1": 2}},
            {"label": "Multi user", "inputs": [[["u1", 0], ["u2", 5], ["u1", 3]], 30], "expected": {"u1": 1, "u2": 1}},
        ],
    },
    ("devops", "mid"): {
        "title": "Resolve Config Overrides",
        "difficulty": "medium",
        "statement": (
            "Implement layered config resolution: given an ordered list of config "
            "dicts (lowest → highest priority), deep-merge them so higher layers "
            "override lower ones key-by-key (nested dicts merge recursively, scalars "
            "and lists replace)."
        ),
        "function_name": "resolve_config",
        "starter_code": (
            "def resolve_config(layers: list[dict]) -> dict:\n"
            "    pass\n"
        ),
        "test_cases": [
            {"label": "Scalar override", "inputs": [[{"a": 1, "b": 2}, {"b": 3}]], "expected": {"a": 1, "b": 3}},
            {"label": "Nested merge", "inputs": [[{"x": {"p": 1, "q": 2}}, {"x": {"q": 9}}]], "expected": {"x": {"p": 1, "q": 9}}},
        ],
    },
}

_VALID_LEVELS = ("junior", "mid", "senior")


@tool(approval_mode="never_require")
def match_skills(
    cv_markdown: Annotated[str, Field(description="Full candidate CV in markdown")],
    required_skills: Annotated[list[str], Field(description="Required skills from extract_requirements")],
) -> dict:
    """Deterministically check which required skills literally appear in the CV
    text vs which are missing. Use this to ground your probing — the GAPS are the
    areas to dig into during the interview. Returns matched, gaps, and match_score.

    Matching is word-boundary + alias aware (k8s↔kubernetes, postgres↔postgresql,
    nodejs↔node), so it neither misses synonyms nor false-positives substrings."""
    cv_lower = cv_markdown.lower()
    matched = [s for s in required_skills if skill_present(s, cv_lower)]
    gaps = [s for s in required_skills if s not in matched]
    return {
        "matched_skills": matched,
        "skill_gaps": gaps,
        "match_score": round(len(matched) / max(len(required_skills), 1), 2),
    }


@tool(approval_mode="never_require")
def search_problem_bank(
    domain: Annotated[str, Field(description="Tech domain: backend / frontend / data / devops / ai")],
    level: Annotated[str, Field(description="Candidate level: junior / mid / senior")],
) -> list[dict]:
    """Return sample coding problems for the domain and level. These are only a
    DIFFICULTY reference — there is no auto-grader anymore, so you are NOT required
    to reuse them. Prefer designing a coding task grounded in the JD's real domain;
    if you adapt one of these, rework the statement to fit the role."""
    level = level if level in _VALID_LEVELS else "mid"

    # Ưu tiên đúng (domain, level), rồi (domain, mid), rồi backend cùng level.
    candidates: list[dict] = []
    for key in [(domain, level), (domain, "mid"), ("backend", level), ("backend", "mid")]:
        problem = _CODING_PROBLEMS.get(key)
        if problem and problem not in candidates:
            candidates.append(problem)
    return candidates
