"""Planning Agent degrade gracefully khi brief LLM hỏng.

Một brief timeout/lỗi KHÔNG được làm sập cả request (bản cũ raise → 500). Thay
vào đó brief lỗi rơi về fallback deterministic dựng từ grounding facts.

Các test này CÔ LẬP network: mock ``_ground_semantic`` để trả thẳng keyword base
(không gọi gateway thật) → kết quả deterministic, không phụ thuộc môi trường.
"""

import pytest

from app.agents.planning import agent as planning_agent
from app.schemas.plan import PlanRequest

_REQ = PlanRequest(
    jd_text="Senior Backend Engineer. 5+ years Python, PostgreSQL, Kubernetes.",
    cv_markdown="## Experience\nBuilt Python services on Postgres and k8s.",
    position="Senior Backend Engineer",
    special_requirements="Focus on system design.",
)


@pytest.fixture(autouse=True)
def _no_network_grounding(monkeypatch):
    """Bỏ qua tầng semantic (network) — giữ keyword base deterministic."""
    async def passthrough(client, req, base):
        return base

    monkeypatch.setattr(planning_agent, "_ground_semantic", passthrough)


async def test_one_failed_brief_falls_back_others_use_llm(monkeypatch):
    async def fake_gen(client, system_prompt, context, label):
        if label == "assignment_brief":
            raise TimeoutError("gateway stuck")
        return f"LLM {label}"

    monkeypatch.setattr(planning_agent, "_gen_brief", fake_gen)

    plan = await planning_agent.run_planning_agent(_REQ)

    assert plan.interview_brief == "LLM interview_brief"
    assert plan.evaluation_brief == "LLM evaluation_brief"
    # Brief hỏng → fallback, và PHẢI mở đầu bằng directive máy-đọc được.
    assert plan.assignment_brief.startswith("ASSIGNMENT DIRECTIVE → type: coding")
    assert plan.source == "planning-agent+fallback"


async def test_all_briefs_fail_still_returns_usable_plan(monkeypatch):
    async def boom(client, system_prompt, context, label):
        raise RuntimeError("provider down")

    monkeypatch.setattr(planning_agent, "_gen_brief", boom)

    plan = await planning_agent.run_planning_agent(_REQ)

    assert plan.source == "planning-agent+fallback"
    assert plan.interview_brief and plan.evaluation_brief and plan.assignment_brief
    assert "ASSIGNMENT DIRECTIVE" in plan.assignment_brief
    # Senior → project mode + AI assistant enabled trong directive fallback.
    assert "mode: project" in plan.assignment_brief
    assert "ai_assistant: enabled" in plan.assignment_brief
    assert plan.duration_minutes == 60  # senior


async def test_happy_path_source_is_clean(monkeypatch):
    async def ok(client, system_prompt, context, label):
        return f"LLM {label}"

    monkeypatch.setattr(planning_agent, "_gen_brief", ok)

    plan = await planning_agent.run_planning_agent(_REQ)

    assert plan.source == "planning-agent"


def test_verify_briefs_flags_drifted_brief():
    facts = {"competencies": [
        {"name": "System design", "weight": 50},
        {"name": "Coding", "weight": 50},
    ]}
    briefs = {
        "interview_brief": "We probe System design and Coding in depth.",
        "evaluation_brief": "Score on something unrelated entirely.",
    }
    # evaluation_brief bỏ sót cả 2 competency (> nửa) → bị đánh dấu; interview thì không.
    assert planning_agent._verify_briefs(briefs, facts) == ["evaluation_brief"]


def test_verify_briefs_clean_when_competencies_present():
    facts = {"competencies": [{"name": "Coding", "weight": 100}]}
    briefs = {"interview_brief": "coding deep dive", "evaluation_brief": "coding rubric"}
    assert planning_agent._verify_briefs(briefs, facts) == []
