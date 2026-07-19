import logging

from fastapi import APIRouter, HTTPException

from app.agents.assignment.agent import run_assignment_agent
from app.schemas.assignment import Assignment, AssignmentRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/assignment", tags=["assignment"])


@router.post("/generate", response_model=Assignment)
async def generate_assignment(req: AssignmentRequest) -> Assignment:
    """Generate a structured assignment (coding challenge or cognitive test).

    Called by the backend after planning. The Assignment Agent (MAF) decides the
    track from the JD/CV and returns an Assignment whose `type` drives the UI."""
    try:
        return await run_assignment_agent(req)
    except Exception as exc:
        logger.error("Assignment agent failed: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Assignment agent error: {exc}"
        )
