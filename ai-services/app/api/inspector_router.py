import logging

from fastapi import APIRouter, HTTPException

from app.agents.inspector.agent import run_inspector_agent
from app.schemas.evaluation import EvaluationRequest, EvaluationResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/inspector", tags=["inspector"])


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(req: EvaluationRequest) -> EvaluationResponse:
    """Chấm điểm buổi phỏng vấn và sinh report (PDF + markdown + scorecard).

    Backend gọi khi kết thúc phỏng vấn (/end). Lỗi → 500, backend tự fallback về
    report mock để luồng không gãy.
    """
    try:
        return await run_inspector_agent(req)
    except Exception as exc:
        logger.error("Inspector agent failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inspector agent error: {exc}")
