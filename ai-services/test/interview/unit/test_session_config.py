"""Behavior tests for SessionConfig.

Per-session config (design doc section 8) carried in dispatch metadata and
frozen for the duration of the session. Pure model — no env, no I/O.
"""

from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.session_config import SessionConfig


def _plan(duration_minutes: int) -> InterviewPlan:
    return InterviewPlan(
        interview_brief="x",
        evaluation_brief="x",
        assignment_brief="x",
        duration_minutes=duration_minutes,
    )


def test_defaults_match_design_doc():
    cfg = SessionConfig(interview_id="abc")

    assert cfg.language == "en"
    assert cfg.endpointing_mode == "turn-detection"
    assert cfg.silence_threshold_ms == 1500
    assert cfg.barge_in is False
    assert cfg.duration_minutes == 15
    assert cfg.grace_minutes == 3
    assert cfg.max_silence_end_min == 3
    assert cfg.dead_air_prompt_sec == 20


def test_from_metadata_overrides_and_takes_duration_from_plan():
    metadata = {
        "interview_id": "iv-123",
        "config": {"grace_minutes": 0, "barge_in": False},
    }
    plan = _plan(duration_minutes=20)

    cfg = SessionConfig.from_metadata(metadata, plan=plan)

    assert cfg.interview_id == "iv-123"
    assert cfg.grace_minutes == 0          # overridden by metadata
    assert cfg.barge_in is False           # overridden by metadata
    assert cfg.duration_minutes == 20      # taken from the plan
    assert cfg.language == "en"            # untouched default


def test_metadata_duration_wins_over_plan():
    metadata = {"interview_id": "iv", "config": {"duration_minutes": 10}}
    plan = _plan(duration_minutes=20)

    cfg = SessionConfig.from_metadata(metadata, plan=plan)

    assert cfg.duration_minutes == 10
