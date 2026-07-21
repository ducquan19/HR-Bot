"""Render an InterviewPlan into the markdown block used in the system prompt.

Pure domain logic: no LiveKit, no I/O. The plan is narrative-centric — the
planning agent already produced a golden ``interview_brief`` markdown block, so
rendering is just handing that brief to the prompt as-is.
"""

from app.agents.interview.domain.plan_models import InterviewPlan


def render_plan_to_prompt(plan: InterviewPlan) -> str:
    """Return the interviewer's brief for the system prompt."""
    return plan.interview_brief.strip()
