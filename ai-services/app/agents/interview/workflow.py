"""Build the LiveKit interviewer Agent from a plan + session config.

This is the seam between our pure domain (prompt assembly) and the LiveKit
framework. Audio plugins (STT/TTS/LLM) are attached on the AgentSession, not
here — this builds the Agent's brain (instructions + MCP tools).
"""

from livekit.agents import Agent, mcp

from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.prompts import build_system_prompt
from app.agents.interview.domain.session_config import SessionConfig


def build_interviewer_agent(
    plan: InterviewPlan,
    config: SessionConfig,
    mcp_servers: "list[mcp.MCPServer] | None" = None,
) -> Agent:
    """Create the interviewer Agent with plan-derived instructions + MCP tools."""
    return Agent(
        instructions=build_system_prompt(plan, config),
        mcp_servers=mcp_servers or [],
    )
