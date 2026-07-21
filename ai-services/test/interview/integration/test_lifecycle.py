"""Integration tests for session preparation (dispatch -> plan + config)."""

import json
from pathlib import Path

from app.agents.interview.lifecycle import prepare_session
from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.session_config import SessionConfig

MOCK = Path(__file__).resolve().parents[3] / "mock" / "plan_ai_engineer.json"


async def test_prepare_session_builds_plan_and_config_from_context():
    plan_dict = json.loads(MOCK.read_text())

    async def fake_fetch_context(interview_id: str) -> dict:
        assert interview_id == "iv-9"
        # Mirrors get_interview_context: full interview detail with a "plan" key.
        return {"id": interview_id, "plan": plan_dict}

    metadata = {"interview_id": "iv-9", "config": {"grace_minutes": 0}}

    plan, config = await prepare_session(metadata, fake_fetch_context)

    assert isinstance(plan, InterviewPlan)
    assert isinstance(config, SessionConfig)
    assert config.interview_id == "iv-9"
    assert config.grace_minutes == 0          # from metadata
    assert config.duration_minutes == 15      # from plan
    assert plan.interview_topics              # plan parsed
