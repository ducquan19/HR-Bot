from livekit.plugins import openai

from app.config import Settings


def build_stt(settings: Settings, language: str | None = None) -> openai.STT:
    """Build the STT plugin for the session language (falls back to settings).

    Vietnamese sessions use a dedicated model/endpoint (stt_vi_*); all other
    languages use the default English STT config (stt_*).
    """
    lang = (language or settings.language or "en").lower()
    if lang == "vi":
        base_url = settings.stt_vi_base_url
        api_key = settings.stt_vi_api_key or "local"
        model = settings.stt_vi_model
    else:
        base_url = settings.stt_base_url
        api_key = settings.stt_api_key or "local"
        model = settings.stt_model
    return openai.STT(
        language=lang,
        model=model,
        base_url=base_url,
        api_key=api_key,
    )
