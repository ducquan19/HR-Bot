import logging
from pathlib import Path

from agent_framework import Agent
from agent_framework.openai import OpenAIChatCompletionClient

from app.config import settings
from app.schemas.coding_assistant import CodeAssistRequest

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).resolve().parent.parent / "prompts" / "coding_assistant.md"
_ASSISTANT_INSTRUCTIONS = _PROMPT_FILE.read_text(encoding="utf-8").strip()


def _model_name() -> str:
    return settings.coding_assistant_model or settings.planning_model


def _build_agent() -> Agent:
    """Build a stateless coding assistant: NO tools, NO memory.

    A fresh agent per request — the whole conversation is passed inline in the
    prompt, so nothing is retained between calls.
    """
    client = OpenAIChatCompletionClient(
        model=_model_name(),
        api_key=settings.openai_api_key or None,
        base_url=settings.openai_base_url or None,
    )
    return Agent(client, _ASSISTANT_INSTRUCTIONS, name="CodingAssistant", tools=[])


def _build_prompt(req: CodeAssistRequest) -> str:
    parts: list[str] = []
    if req.problem_statement:
        parts.append(f"=== CODING TASK ===\n{req.problem_statement}")
    if req.code:
        parts.append(
            f"=== CANDIDATE'S CURRENT CODE ({req.language}) ===\n{req.code}"
        )

    convo: list[str] = []
    for m in req.messages:
        speaker = "Candidate" if m.role == "user" else "Assistant"
        convo.append(f"{speaker}: {m.content}")
    parts.append("=== CONVERSATION ===\n" + "\n".join(convo))
    parts.append("Reply as the Assistant to the candidate's latest message.")
    return "\n\n".join(parts)


def _usage(result) -> tuple[int, int]:
    """Best-effort (input_tokens, output_tokens) from an agent_framework result."""
    u = getattr(result, "usage_details", None)
    if u is None:
        return 0, 0
    ti = getattr(u, "input_token_count", None)
    to = getattr(u, "output_token_count", None)
    if isinstance(u, dict):
        ti = ti if ti is not None else u.get("input_token_count")
        to = to if to is not None else u.get("output_token_count")
    return int(ti or 0), int(to or 0)


async def run_coding_assistant(req: CodeAssistRequest) -> dict:
    """Run the coding assistant; return reply plus the prompt + token usage so
    the backend can log how the candidate used the chatbot."""
    agent = _build_agent()
    prompt = _build_prompt(req)
    result = await agent.run(
        prompt,
        options={
            "temperature": settings.coding_assistant_temperature,
            "max_tokens": settings.coding_assistant_max_tokens,
        },
    )
    tokens_input, tokens_output = _usage(result)
    return {
        "reply": (result.text or "").strip(),
        "prompt": prompt,
        "model": _model_name(),
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
    }
