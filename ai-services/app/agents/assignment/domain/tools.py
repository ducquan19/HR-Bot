import logging
from typing import Annotated

import httpx
from agent_framework import tool
from pydantic import Field

from app.config import settings
# Reuse the verified DSA problem bank the Planning Agent already grounds on, so
# DSA challenges ship with runnable test_cases instead of hallucinated ones.
from app.skills.interview_planning.scripts.planning_tools import search_problem_bank

logger = logging.getLogger(__name__)

_API = settings.backend_url.rstrip("/") + "/api/v1/interviews"

__all__ = ["search_problem_bank", "set_coding_assistant"]


@tool(approval_mode="never_require")
async def set_coding_assistant(
    interview_id: Annotated[str, Field(description="The bound interview id")],
    enabled: Annotated[
        bool,
        Field(description="True for a project challenge (AI allowed), False for DSA"),
    ],
) -> dict:
    """Enable or disable the in-machine AI coding assistant for this interview.

    Call this AFTER deciding the coding challenge mode: disable it for a DSA
    challenge (the candidate must solve unaided) and enable it for a project
    challenge (the candidate is expected to use AI). Returns the applied state;
    degrades to a reported (not raised) failure if the backend is unreachable."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{_API}/{interview_id}/coding-assistant",
                json={"enabled": enabled},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as exc:
        logger.warning("set_coding_assistant failed (%s); reporting intent only", exc)
        return {"interview_id": interview_id, "enabled": enabled, "applied": False}
