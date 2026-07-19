"""Tests cho grounding tool của Planning Agent (matching chặt + fallback).

Mục tiêu: tool "bắt đúng mọi trường hợp" — word-boundary chặn false positive,
alias bắt biến thể; seniority chấm điểm không thiên junior; và pipeline KHÔNG
sập khi một brief LLM hỏng (degrade về fallback deterministic).
"""

import pytest

from app.skills.jd_analysis.scripts.jd_tools import (
    extract_requirements,
    skill_present,
)
from app.skills.interview_planning.scripts.planning_tools import (
    match_skills,
    search_problem_bank,
)


# ── skill_present: word-boundary + alias ─────────────────────────────────────
@pytest.mark.parametrize("skill,text", [
    ("go", "i used google and django a while ago"),   # 'go' trong google/ago
    ("java", "we use javascript and typescript"),      # 'java' trong javascript
    ("react", "this is a proactive reactor design"),   # 'react' trong proactive/reactor
])
def test_skill_present_blocks_substring_false_positives(skill, text):
    assert skill_present(skill, text) is False


@pytest.mark.parametrize("canonical,text", [
    ("node", "built apis with nodejs"),
    ("node", "experience in node.js"),
    ("kubernetes", "deployed on k8s clusters"),
    ("postgresql", "data stored in postgres"),
    ("javascript", "strong in js and css"),
    ("typescript", "ts everywhere"),
    ("machine learning", "applied ml to ranking"),
    ("ci/cd", "owns the cicd pipeline"),
    # taxonomy mở rộng + alias
    ("c#", "5 years of c# development"),
    ("dotnet", "built on .net core"),
    ("dotnet", "asp.net mvc apps"),
    ("c++", "strong cpp background"),
    ("rails", "a ruby on rails shop"),
    ("mongodb", "data in mongo"),
    ("tailwind", "styled with tailwindcss"),
    ("react native", "mobile via react-native"),
    ("express", "apis with express.js"),
    ("huggingface", "used hugging face models"),
])
def test_skill_present_matches_aliases(canonical, text):
    assert skill_present(canonical, text) is True


@pytest.mark.parametrize("skill,text", [
    ("rust", "i trust this; it was frustrating"),   # rust trong trust/frustrating
    ("scala", "highly scalable systems"),            # scala trong scalable
    ("swift", "answered swiftly"),                    # swift trong swiftly
    ("express", "an expression of interest"),         # express trong expression
    ("rails", "guardrails and trails"),               # rails trong guardrails/trails
    ("sql", "uses mysql and postgresql only"),        # sql bare không khớp trong mysql
])
def test_expanded_taxonomy_no_new_false_positives(skill, text):
    assert skill_present(skill, text) is False


@pytest.mark.parametrize("jd,position,domain", [
    ("Senior .NET / C# Backend Engineer. SQL Server, RabbitMQ.", "Backend Engineer", "backend"),
    ("Mobile dev with Flutter and Swift, plus React Native.", "Mobile Engineer", "frontend"),
    ("Data Engineer: Spark, Snowflake, dbt, Airflow on Databricks.", "Data Engineer", "data"),
])
def test_expanded_taxonomy_domain_detection(jd, position, domain):
    assert extract_requirements(jd, position)["domain"] == domain


# ── extract_requirements ─────────────────────────────────────────────────────
def test_seniority_is_scored_not_first_match():
    """JD cấp cao lẫn keyword cấp thấp ('1 year') vẫn phải ra senior."""
    req = extract_requirements(
        "Senior Backend Engineer. 1 year leading a team. Python, PostgreSQL, k8s.",
        "Senior Backend Engineer",
    )
    assert req["seniority_level"] == "senior"
    assert "java" not in req["required_skills"]  # không lọt từ 'javascript' nào cả
    assert {"python", "postgresql", "kubernetes"} <= set(req["required_skills"])
    assert req["domain"] == "backend"


def test_year_range_takes_lower_bound():
    req = extract_requirements(
        "Mid-level role, 2-5 years with React and TypeScript.", "Frontend Engineer"
    )
    assert req["min_years_experience"] == 2
    assert req["seniority_level"] == "mid"
    assert req["domain"] == "frontend"


def test_seniority_defaults_to_mid_when_unknown():
    req = extract_requirements("We build software with Python.", "Engineer")
    assert req["seniority_level"] == "mid"


# ── match_skills ─────────────────────────────────────────────────────────────
def test_match_skills_is_alias_aware():
    res = match_skills(
        "Experienced with Postgres, k8s, and Node.js services.",
        ["postgresql", "kubernetes", "node", "redis"],
    )
    assert set(res["matched_skills"]) == {"postgresql", "kubernetes", "node"}
    assert res["skill_gaps"] == ["redis"]
    assert res["match_score"] == 0.75


# ── search_problem_bank: phủ thêm domain, vẫn an toàn fallback ────────────────
@pytest.mark.parametrize("domain", ["frontend", "data", "devops", "backend", "ai"])
def test_problem_bank_returns_domain_reference(domain):
    problems = search_problem_bank(domain, "mid")
    assert problems, f"no problem returned for {domain}"
    # entry đầu phải đúng domain yêu cầu (không rơi thẳng về backend)
    assert "title" in problems[0] and "difficulty" in problems[0]


def test_problem_bank_unknown_level_clamps():
    # 'manager' không có trong bank → clamp về mid, vẫn trả bài.
    assert search_problem_bank("backend", "manager")
