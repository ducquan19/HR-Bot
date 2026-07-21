"""load_mock_session builds a plan + config with no backend (console/dev)."""

from pathlib import Path

from app.agents.interview.lifecycle import load_mock_session
from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.session_config import SessionConfig

MOCK_DIR = Path(__file__).resolve().parents[3] / "mock"


def test_default_mock_session_loads_bundled_plan():
    plan, config = load_mock_session()

    assert isinstance(plan, InterviewPlan)
    assert isinstance(config, SessionConfig)
    assert plan.interview_topics              # parsed a real plan
    assert config.interview_id == "dev-console"
    assert config.duration_minutes == plan.duration_minutes


def test_explicit_path_and_metadata_override():
    path = MOCK_DIR / "plan_backend_engineer.json"

    plan, config = load_mock_session(
        path,
        interview_id="iv-test",
        metadata={"config": {"grace_minutes": 0}},
    )

    assert config.interview_id == "iv-test"
    assert config.grace_minutes == 0          # from metadata
    assert plan.summary                       # backend-engineer plan parsed
