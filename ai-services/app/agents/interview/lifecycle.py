"""Session lifecycle: dispatch metadata -> interview plan + frozen config.

Dispatch mode B (design doc section 5): metadata carries only interview_id +
light config; the plan and CV are fetched from the backend via MCP. This module
holds the framework-agnostic preparation step so it stays unit-testable; the
LiveKit room wiring lives in main.py.
"""

import json
from collections.abc import Awaitable, Callable
from pathlib import Path

from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.session_config import SessionConfig

FetchContext = Callable[[str], Awaitable[dict]]

# Bundled mock fixtures (interview-agent/mock/), used for console/dev runs.
_MOCK_DIR = Path(__file__).resolve().parents[3] / "mock"
_DEFAULT_MOCK_PLAN = _MOCK_DIR / "plan_ai_engineer.json"


async def prepare_session(
    metadata: dict,
    fetch_context: FetchContext,
) -> tuple[InterviewPlan, SessionConfig]:
    """Resolve the interview plan and frozen session config from dispatch.

    ``fetch_context`` mirrors the ``get_interview_context`` MCP tool: given an
    interview_id it returns the interview detail, which includes a ``plan`` key.
    """
    interview_id = metadata["interview_id"]
    context = await fetch_context(interview_id)
    
    # Map HR-Bot context to InterviewPlan
    parsed_cv = context.get("parsedCv") or {}
    job_desc = context.get("jobDescription") or {}
    skills = context.get("positionSkills") or []
    candidate = context.get("candidate") or {}
    
    brief = f"Candidate Name: {candidate.get('firstName', 'Candidate')} {candidate.get('lastName', '')}\n"
    brief += f"Job Overview: {job_desc.get('overview', '')}\n"
    brief += f"Requirements: {job_desc.get('requirements', '')}\n"
    brief += f"Candidate Summary: {parsed_cv.get('summary', '')}\n"
    brief += f"Candidate Skills: {', '.join(parsed_cv.get('skills', []))}\n"
    brief += f"Position Skills: {', '.join([s.get('skill', {}).get('name', '') for s in skills])}\n"
    
    plan = InterviewPlan(
        interview_brief=brief,
        evaluation_brief="Evaluate technical, behavioral and role-fit.",
        assignment_brief="",
        duration_minutes=30
    )
    config = SessionConfig.from_metadata(metadata, plan=plan)
    return plan, config


def load_mock_session(
    plan_path: str | Path | None = None,
    *,
    interview_id: str = "dev-console",
    metadata: dict | None = None,
) -> tuple[InterviewPlan, SessionConfig]:
    """Build a plan + config from a bundled mock fixture — no backend, no MCP.

    Used for console / dev smoke testing where there is no LiveKit dispatch
    metadata to carry an ``interview_id`` and no backend to fetch the plan from.
    """
    path = Path(plan_path) if plan_path else _DEFAULT_MOCK_PLAN
    plan = InterviewPlan(**json.loads(Path(path).read_text()))
    meta = {"interview_id": interview_id, **(metadata or {})}
    config = SessionConfig.from_metadata(meta, plan=plan)
    return plan, config
