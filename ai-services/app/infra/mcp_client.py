"""MCP client wiring: connect the agent to the ai-services toolbox over SSE."""

from livekit.agents import mcp

# Whitelist the voice interview agent's tools. It speaks via TTS — NOT via
# send_message_to_candidate (whose description tempts a weak LLM to "talk"
# through it, mangle the args, and loop). The transcript is written by our own
# code (not append_transcript_turn), and the plan is already in the system
# prompt (not get_interview_context). Keep only what the agent genuinely drives.
AGENT_ALLOWED_TOOLS = [
    "switch_mode",
    "end_interview",
    "get_problem_statement",
    "get_candidate_code",
    "get_code_run_logs",
    "get_transcript",
    "get_live_snapshot",
    "get_sandbox_files",
    "analyze_candidate_code",
]


def build_mcp_server(
    sse_url: str, allowed_tools: list[str] | None = AGENT_ALLOWED_TOOLS
) -> mcp.MCPServerHTTP:
    """Build the MCP server handle for the ai-services toolbox (SSE transport).

    ``allowed_tools`` whitelists which tools the LLM may call; pass ``None`` to
    expose every server tool.
    """
    return mcp.MCPServerHTTP(
        url=sse_url, transport_type="sse", allowed_tools=allowed_tools
    )
