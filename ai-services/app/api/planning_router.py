import logging

from fastapi import APIRouter, HTTPException

from app.agents.planning.agent import run_planning_agent
from app.schemas.plan import InterviewPlan, PlanRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/planning", tags=["planning"])


@router.post("/plan", response_model=InterviewPlan)
async def create_plan(req: PlanRequest) -> InterviewPlan:
    """Generate a structured interview plan from CV + JD.

    Called by the backend when HR submits a new interview request.
    The Planning Agent (MAF) analyzes the inputs and returns an InterviewPlan.
    """
    try:
        return await run_planning_agent(req)
    except Exception as exc:
        logger.error("Planning agent failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Planning agent error: {exc}")
