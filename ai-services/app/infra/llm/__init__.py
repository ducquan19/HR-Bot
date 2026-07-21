"""LLM adapter — the agent's "brain" over an OpenAI-compatible endpoint.

Swappable: changing provider/model is a config change, not a domain change.
"""

from livekit.agents.types import NOT_GIVEN
from livekit.plugins import google

from app.config import Settings


def build_llm(settings: Settings) -> google.LLM:
    # temperature + max_completion_tokens keep each spoken turn short and paced
    # (a hard ceiling against the model monologuing). Brevity is also enforced in
    # the system prompt; this is the safety cap.
    return google.LLM(
        model="gemini-3.1-flash-lite",
        api_key=settings.gemini_api_key,
        temperature=settings.interview_temperature,
    )
