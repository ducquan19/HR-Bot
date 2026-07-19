"""Verify the mock plan fixtures match the real InterviewPlan contract.

These JSON files stand in for the planning agent's output. They must validate
against the schema and render to a non-empty prompt that contains every topic —
catching contract drift early.
"""

import json
from pathlib import Path

import pytest

from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.plan_renderer import render_plan_to_prompt

MOCK_DIR = Path(__file__).resolve().parents[3] / "mock"
PLAN_FILES = sorted(MOCK_DIR.glob("plan_*.json"))


def test_mock_plans_exist():
    assert PLAN_FILES, f"no mock plan_*.json found in {MOCK_DIR}"


@pytest.mark.parametrize("path", PLAN_FILES, ids=lambda p: p.stem)
def test_mock_plan_validates_and_renders(path):
    plan = InterviewPlan(**json.loads(path.read_text()))

    # Design constraint: a 15-minute interview should have <= 4 topics.
    assert plan.duration_minutes == 15
    assert 1 <= len(plan.interview_topics) <= 4

    prompt = render_plan_to_prompt(plan)
    assert prompt.strip()
    for topic in plan.interview_topics:
        assert topic.title in prompt
