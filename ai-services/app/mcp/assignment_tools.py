import httpx
from mcp.server.fastmcp import FastMCP

from app.config import settings

mcp = FastMCP(
    name="temis-assignment-agent-tools",
    instructions=(
        "Tools for the Code Assignment Agent on the Temis platform. Use them to "
        "toggle the in-machine AI coding assistant for an interview: disable it for "
        "a DSA challenge (candidate solves unaided) and enable it for a project "
        "challenge (candidate may use AI)."
    ),
    host=settings.mcp_host,
    port=settings.mcp_port,
)

API = settings.backend_url.rstrip("/") + "/api/v1/interviews"


async def _toggle(interview_id: str, enabled: bool) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{API}/{interview_id}/coding-assistant", json={"enabled": enabled}
        )
        r.raise_for_status()
        return r.json()


@mcp.tool()
async def enable_coding_assistant(interview_id: str) -> dict:
    """Enable the in-machine AI coding assistant for this interview.
    Use for a PROJECT coding challenge, where the candidate is expected to work
    with AI. Returns the applied state."""
    return await _toggle(interview_id, True)


@mcp.tool()
async def disable_coding_assistant(interview_id: str) -> dict:
    """Disable the in-machine AI coding assistant for this interview.
    Use for a DSA coding challenge, where the candidate must solve unaided.
    Returns the applied state."""
    return await _toggle(interview_id, False)


@mcp.tool()
async def get_coding_assistant_status(interview_id: str) -> dict:
    """Get whether the AI coding assistant is currently enabled for this interview."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{API}/{interview_id}/coding-assistant")
        r.raise_for_status()
        return r.json()
