"""Behavior tests for build_system_prompt.

Assembles the interviewer's system prompt from the rendered plan plus behaviour
rules (one main question + 1-2 follow-ups per topic, greet first, English-only).
"""

from app.agents.interview.domain.plan_models import InterviewPlan, InterviewTopic
from app.agents.interview.domain.prompts import build_system_prompt
from app.agents.interview.domain.session_config import SessionConfig


def test_prompt_embeds_plan_and_behaviour_rules():
    plan = InterviewPlan(
        summary="Backend role",
        interview_topics=[
            InterviewTopic(title="Concurrency", questions=["Explain a deadlock."])
        ],
    )
    cfg = SessionConfig(interview_id="iv")

    prompt = build_system_prompt(plan, cfg)

    # The rendered plan is embedded.
    assert "Concurrency" in prompt
    assert "Explain a deadlock." in prompt
    # Behaviour rules present.
    assert "follow-up" in prompt.lower()
    # English is the default language.
    assert "English" in prompt


def test_prompt_binds_mcp_tools_to_current_interview_id():
    plan = InterviewPlan(
        summary="Backend role",
        interview_topics=[
            InterviewTopic(title="Concurrency", questions=["Explain a deadlock."])
        ],
    )
    cfg = SessionConfig(interview_id="iv-123")

    prompt = build_system_prompt(plan, cfg)

    assert "interview_id is iv-123" in prompt
    assert "never read aloud" in prompt
    assert "never call list_active_interviews" in prompt


def test_prompt_uses_vietnamese_rules_for_vi():
    plan = InterviewPlan(
        summary="Backend role",
        interview_topics=[
            InterviewTopic(title="Concurrency", questions=["Explain a deadlock."])
        ],
    )
    cfg = SessionConfig(interview_id="iv", language="vi")

    prompt = build_system_prompt(plan, cfg)

    # Vietnamese behaviour rules are used; the English block is not.
    assert "phỏng vấn" in prompt
    assert "tiếng Việt" in prompt
    assert "conducting a live, spoken" not in prompt
    # The rendered plan is still embedded.
    assert "Concurrency" in prompt
