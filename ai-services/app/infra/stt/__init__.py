from livekit.plugins import openai

from app.config import Settings


def build_stt(settings: Settings, language: str | None = None) -> openai.STT:
    """Build the STT plugin for the session language (falls back to settings).

    Vietnamese sessions use a dedicated model/endpoint (stt_vi_*); all other
    languages use the default English STT config (stt_*).
    """
    # We use Groq's extremely fast Whisper endpoint for free STT.
    # The livekit openai.STT plugin is compatible with any OpenAI-like API.
    base_url = "https://api.groq.com/openai/v1"
    api_key = settings.groq_api_key or "gsk_missing_key"
    model = "whisper-large-v3"
    
    return openai.STT(
        language=lang,
        model=model,
        base_url=base_url,
        api_key=api_key,
    )
