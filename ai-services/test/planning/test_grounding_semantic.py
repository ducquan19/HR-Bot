"""Grounding 2 tầng: keyword base + overlay semantic phòng thủ (không network).

``_parse_grounding`` là chốt an toàn — JSON analyst hợp lệ thì overlay lên base,
hỏng/thiếu field thì giữ nguyên base. Test thuần, không gọi LLM.
"""

import json

from app.agents.planning import agent as A
from app.schemas.plan import PlanRequest

_REQ = PlanRequest(
    jd_text="Senior Backend Engineer. 5+ years Python, PostgreSQL, Kubernetes.",
    cv_markdown="## Experience\nBuilt Python services on Postgres and k8s.",
    position="Senior Backend Engineer",
)


def test_keyword_base_has_unified_shape():
    g = A._ground(_REQ)
    for key in (
        "seniority_level", "seniority_reason", "domain", "required_skills",
        "evidenced_skills", "skill_gaps", "competencies", "assignment",
        "suggested_problem", "suggested_difficulty",
    ):
        assert key in g, key
    assert g["seniority_level"] == "senior"
    assert g["competencies"] and all(
        "name" in c and "weight" in c for c in g["competencies"]
    )
    a = g["assignment"]
    assert a["type"] == "coding" and a["mode"] == "project"  # senior → project
    assert a["ai_assistant"] == "enabled"


def test_parse_grounding_overlays_valid_json():
    base = A._ground(_REQ)
    payload = json.dumps({
        "seniority_level": "mid",
        "seniority_reason": "3 yrs, no leadership shown",
        "domain": "data",
        "required_skills": ["spark", "airflow"],
        "evidenced_skills": ["spark"],
        "skill_gaps": ["airflow"],
        "competencies": [
            {"name": "Data pipelines", "weight": 60},
            {"name": "SQL modeling", "weight": 40},
        ],
        "assignment": {"type": "coding", "mode": "dsa",
                       "ai_assistant": "disabled", "difficulty": "easy"},
    })
    # LLM hay bọc thêm chữ/markdown — parser phải bóc { ... } ra được.
    g = A._parse_grounding("Here you go:\n```json\n" + payload + "\n```", base)

    assert g["seniority_level"] == "mid"
    assert g["domain"] == "data"
    assert g["skill_gaps"] == ["airflow"]
    assert [c["name"] for c in g["competencies"]] == ["Data pipelines", "SQL modeling"]
    assert g["assignment"]["mode"] == "dsa"
    # domain/level đổi → tham chiếu bài được làm tươi theo (data, mid).
    assert g["suggested_difficulty"] in ("easy", "medium", "hard")


def test_parse_grounding_overlays_evidence_and_mandatory():
    base = A._ground(_REQ)
    payload = json.dumps({
        "mandatory_skills": ["python", "kubernetes"],
        "skills_evidence": [
            {"name": "python", "years": 5, "evidence": "built 3 prod services"},
            {"name": "kafka", "years": 0, "evidence": ""},
            {"name": "", "evidence": "ignored — no name"},   # sai → bỏ
            "not-a-dict",                                      # sai kiểu → bỏ
        ],
    })
    g = A._parse_grounding(payload, base)

    assert g["mandatory_skills"] == ["python", "kubernetes"]
    ev = g["skills_evidence"]
    assert [e["name"] for e in ev] == ["python", "kafka"]   # 2 cái hợp lệ
    assert ev[0]["years"] == 5 and ev[0]["evidence"] == "built 3 prod services"
    assert ev[1]["years"] is None                            # years 0 → None


def test_parse_grounding_renormalizes_competency_weights():
    base = A._ground(_REQ)
    # LLM trả weight KHÔNG tổng 100 → parser phải renormalize về đúng 100.
    payload = json.dumps({
        "competencies": [
            {"name": "System design", "weight": 5},
            {"name": "Coding", "weight": 3},
            {"name": "Comms", "weight": 2},
        ],
    })
    g = A._parse_grounding(payload, base)
    assert sum(c["weight"] for c in g["competencies"]) == 100
    assert [c["name"] for c in g["competencies"]] == ["System design", "Coding", "Comms"]


def test_parse_grounding_broken_json_keeps_base():
    base = A._ground(_REQ)
    g = A._parse_grounding("the model rambled and produced no json at all", base)
    assert g == base


def test_parse_grounding_ignores_invalid_fields():
    base = A._ground(_REQ)
    # seniority lạ + competencies sai kiểu → bỏ qua, giữ base; domain hợp lệ → nhận.
    payload = json.dumps({
        "seniority_level": "wizard",
        "domain": "frontend",
        "competencies": "not a list",
    })
    g = A._parse_grounding(payload, base)
    assert g["seniority_level"] == base["seniority_level"]   # 'wizard' bị từ chối
    assert g["domain"] == "frontend"                          # hợp lệ → overlay
    assert g["competencies"] == base["competencies"]          # sai kiểu → giữ base
