import json
import logging

from agent_framework import Agent
from agent_framework.openai import OpenAIChatCompletionClient

from app.agents.assignment.domain.prompts import build_instructions, build_user_prompt
from app.agents.assignment.domain.tools import search_problem_bank
from app.config import settings
from app.schemas.assignment import Assignment, AssignmentRequest

logger = logging.getLogger(__name__)


def _build_agent() -> Agent:
    """Create the Assignment Agent. Same MAF wiring as the Planning Agent:
    provider-agnostic OpenAI-compatible client, model/endpoint from config.

    No set_coding_assistant tool: the AI-assistant toggle is taken directly from
    the returned assignment's ``ai_assistant_enabled`` field by the caller, so an
    extra tool round-trip (which also 404s when the interview row doesn't exist
    yet during link creation) is pure overhead."""
    client = OpenAIChatCompletionClient(
        model=settings.assignment_model,
        api_key=settings.openai_api_key or None,
        base_url=settings.openai_base_url or None,
    )
    return Agent(
        client,
        build_instructions(),
        name="AssignmentAgent",
        tools=[search_problem_bank],
    )


def _parse_assignment(text: str) -> Assignment:
    """Parse an Assignment from model text that may be fenced in ```json ... ```."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        text = text[4:].strip() if text.lstrip().startswith("json") else text.strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    return Assignment.model_validate_json(text)


async def run_assignment_agent(req: AssignmentRequest) -> Assignment:
    """Run the Assignment Agent and return a validated Assignment.

    Single path: ask for ONE JSON object matching the schema and parse it. We do
    NOT use the gateway's ``response_format`` — Gemma truncates long structured
    JSON ("Invalid JSON: EOF"), the exact failure the Planning Agent dropped JSON
    to avoid — so going straight to JSON-in-prompt skips a guaranteed-failing call
    and is faster. Retry once on a parse failure (transient truncation)."""
    agent = _build_agent()
    schema = json.dumps(Assignment.model_json_schema(), ensure_ascii=False)
    prompt = (
        f"{build_user_prompt(req)}\n\n"
        f"Return ONLY one JSON object matching this schema "
        f"(no prose, no markdown fence):\n{schema}"
    )

    last_text = ""
    for attempt in (1, 2):
        result = await agent.run(
            prompt,
            options={
                "temperature": settings.assignment_temperature,
                "max_tokens": settings.assignment_max_tokens,
            },
        )
        last_text = (result.text or "").strip()
        if last_text:
            try:
                return _parse_assignment(last_text)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "assignment JSON parse failed (attempt %d): %s",
                    attempt, str(exc)[:160],
                )

    raise ValueError(
        f"Assignment Agent did not return valid JSON. text_head={last_text[:200]!r}"
    )
