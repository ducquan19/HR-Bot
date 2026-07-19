"""Interview plan contract.

Standalone mirror of ``backend/app/schemas/plan.py``. The interview-agent is an
independently deployable service, so it does not import from ``backend/``; it
keeps its own copy of the contract it consumes. Keep these field definitions in
sync with the backend schema (single source to be unified later).

The plan is narrative-centric: the planning agent did the heavy CV reading and
produced ``interview_brief`` (a golden markdown block) that this service injects
straight into the interviewer's system prompt.
"""

from pydantic import BaseModel, Field


class InterviewPlan(BaseModel):
    interview_brief: str
    evaluation_brief: str
    assignment_brief: str
    duration_minutes: int = Field(default=45, ge=5)
    source: str = Field(
        default="planning-agent",
        description="Origin of the plan: 'planning-agent' or 'mock'",
    )
