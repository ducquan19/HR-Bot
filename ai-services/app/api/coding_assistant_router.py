import logging

from fastapi import APIRouter, HTTPException

from app.agents.coding_assistant.agent import run_coding_assistant
from app.schemas.coding_assistant import CodeAssistRequest, CodeAssistResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/coding-assistant", tags=["coding-assistant"])


@router.post("/chat", response_model=CodeAssistResponse)
async def chat(req: CodeAssistRequest) -> CodeAssistResponse:
    """Answer a candidate's coding question during the assignment.

    Called by the backend (which gates this on the interview's
    assistant_enabled flag). The LLM acts as an in-editor coding assistant.
    """
    try:
        result = await run_coding_assistant(req)
    except Exception as exc:
        logger.error("Coding assistant failed: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Coding assistant error: {exc}"
        )
    return CodeAssistResponse(**result)
