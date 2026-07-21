"""Per-session interview configuration (design doc section 8).

Carried in LiveKit dispatch metadata, applied once when the AgentSession is
created, and frozen for the rest of the session. Pure pydantic model so it can
be validated and tested without any environment or I/O.
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.agents.interview.domain.plan_models import InterviewPlan
from app.config import settings


class SessionConfig(BaseModel):
    interview_id: str
    language: str = "en"
    endpointing_mode: Literal["turn-detection", "vad"] = settings.endpointing_mode
    silence_threshold_ms: int = settings.silence_threshold_ms
    barge_in: bool = settings.barge_in
    duration_minutes: int = Field(default=settings.duration_minutes, ge=5)
    grace_minutes: int = Field(default=settings.grace_minutes, ge=0)
    max_silence_end_min: int = settings.max_silence_end_min
    dead_air_prompt_sec: int = settings.dead_air_prompt_sec
    wrap_soon_minutes: int = settings.wrap_soon_minutes

    @classmethod
    def from_metadata(
        cls,
        metadata: dict,
        plan: InterviewPlan | None = None,
    ) -> "SessionConfig":
        """Build config from dispatch metadata ``{interview_id, config}``.

        The plan supplies ``duration_minutes`` unless metadata overrides it.
        """
        config = dict(metadata.get("config") or {})
        if plan is not None and "duration_minutes" not in config:
            config["duration_minutes"] = plan.duration_minutes
        return cls(interview_id=metadata["interview_id"], **config)
