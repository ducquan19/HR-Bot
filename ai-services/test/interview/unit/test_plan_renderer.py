"""Behavior tests for render_plan_to_prompt.

The renderer turns an InterviewPlan into the markdown that seeds the
interviewer's system prompt. We assert on observable content (titles,
questions, competencies appear), never on exact formatting.
"""

from app.agents.interview.domain.plan_models import (
    CodingAssignment,
    InterviewPlan,
    InterviewTopic,
    PlanCompetency,
)
from app.agents.interview.domain.plan_renderer import render_plan_to_prompt


def test_renders_single_topic_and_question():
    plan = InterviewPlan(
        summary="Senior backend interview",
        interview_topics=[
            InterviewTopic(
                title="System design",
                questions=["How would you design a URL shortener?"],
            )
        ],
    )

    prompt = render_plan_to_prompt(plan)

    assert "System design" in prompt
    assert "How would you design a URL shortener?" in prompt


def test_renders_multiple_topics_in_plan_order():
    plan = InterviewPlan(
        summary="x",
        interview_topics=[
            InterviewTopic(title="First topic", questions=[]),
            InterviewTopic(title="Second topic", questions=[]),
            InterviewTopic(title="Third topic", questions=[]),
        ],
    )

    prompt = render_plan_to_prompt(plan)

    assert prompt.index("First topic") < prompt.index("Second topic")
    assert prompt.index("Second topic") < prompt.index("Third topic")


def test_renders_competencies_with_weights():
    plan = InterviewPlan(
        summary="x",
        competencies=[
            PlanCompetency(name="Distributed systems", weight=0.7),
            PlanCompetency(name="Communication", weight=0.3),
        ],
    )

    prompt = render_plan_to_prompt(plan)

    assert "Distributed systems" in prompt
    assert "Communication" in prompt
    # Weight is the signal the agent uses to prioritise under time pressure.
    assert "0.7" in prompt


def test_renders_inspector_criteria():
    plan = InterviewPlan(
        summary="x",
        inspector_criteria=["Clarity of reasoning", "Depth of system knowledge"],
    )

    prompt = render_plan_to_prompt(plan)

    assert "Clarity of reasoning" in prompt
    assert "Depth of system knowledge" in prompt


def test_excludes_coding_assignment():
    # Coding assignment is out of scope for the conversational MVP; the
    # interviewer must not surface it.
    plan = InterviewPlan(
        summary="x",
        interview_topics=[InterviewTopic(title="Backend", questions=["q"])],
        coding_assignment=CodingAssignment(
            title="Two Sum",
            statement="Return indices of two numbers adding to target.",
        ),
    )

    prompt = render_plan_to_prompt(plan)

    assert "Two Sum" not in prompt
    assert "Return indices" not in prompt


def test_empty_plan_renders_without_error():
    prompt = render_plan_to_prompt(InterviewPlan(summary="x"))

    assert isinstance(prompt, str)
