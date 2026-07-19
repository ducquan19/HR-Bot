"""LLM adapter — the agent's "brain" over an OpenAI-compatible endpoint.

Swappable: changing provider/model is a config change, not a domain change.
"""

from livekit.agents.types import NOT_GIVEN
from livekit.plugins import openai

from app.config import Settings


def build_llm(settings: Settings) -> openai.LLM:
    # temperature + max_completion_tokens keep each spoken turn short and paced
    # (a hard ceiling against the model monologuing). Brevity is also enforced in
    # the system prompt; this is the safety cap.
    return openai.LLM(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url or NOT_GIVEN,
        temperature=settings.interview_temperature,
        max_completion_tokens=settings.interview_max_tokens,
    )
