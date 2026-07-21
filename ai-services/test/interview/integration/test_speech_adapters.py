"""The speech adapters construct the right LiveKit plugin objects.

Construction is offline (no network until used), so we just assert the factory
wires our settings into the openai plugin objects.
"""

from livekit.plugins import openai

from app.config import Settings
from app.infra.llm import build_llm
from app.infra.stt import build_stt
from app.infra.tts import (
    VietnameseNormalizingTTS,
    build_tts,
    normalize_vietnamese_tts_text,
)


def _settings() -> Settings:
    return Settings(
        _env_file=None,
        openai_api_key="k",
        openai_model="my-llm",
        stt_model="my-stt",
        tts_voice="af_sky",
    )


def test_build_llm_returns_openai_llm():
    assert isinstance(build_llm(_settings()), openai.LLM)


def test_build_stt_returns_openai_stt():
    assert isinstance(build_stt(_settings()), openai.STT)


def test_build_tts_returns_openai_tts():
    assert isinstance(build_tts(_settings()), openai.TTS)


def test_kokoro_routes_through_raw_audio_path():
    # Importing app.infra.tts registers "kokoro" onto the openai plugin's
    # raw-audio model set. Without it the plugin uses the SSE path, which
    # kokoro-fastapi doesn't speak, so the agent produces no audio (silence).
    from livekit.plugins.openai import tts as openai_tts

    assert "kokoro" in openai_tts.AUDIO_STREAM_MODELS


def test_build_stt_uses_session_language():
    stt = build_stt(_settings(), "vi")
    assert stt._opts.language == "vi"


def test_build_tts_routes_vietnamese_to_vieneu():
    settings = Settings(
        _env_file=None,
        tts_base_url="http://en-kokoro:8880/v1",
        tts_model="tts-1",
        tts_voice="af_heart",
        tts_response_format="wav",
        tts_vi_base_url="http://vi-vieneu:8881/v1",
        tts_vi_voice="trucly",
    )
    en = build_tts(settings, "en")
    vi = build_tts(settings, "vi")

    # Vietnamese routes to the VieNeu group; English keeps the Kokoro endpoint.
    assert str(vi._client.base_url).rstrip("/") == "http://vi-vieneu:8881/v1"
    assert vi._opts.voice == "trucly"
    assert str(en._client.base_url).rstrip("/") == "http://en-kokoro:8880/v1"
    assert en._opts.voice == "af_heart"
    # Both keep the tts-1 audio-stream wire path (never SSE) with WAV framing.
    assert en._opts.model == "tts-1"
    assert vi._opts.model == "tts-1"
    assert en._opts.response_format == "wav"
    assert vi._opts.response_format == "wav"


def test_build_tts_vi_uses_normalizing_subclass():
    # Vietnamese gets the normalizing TTS so acronyms are spelled before
    # synthesis; English keeps the plain plugin.
    settings = Settings(_env_file=None, tts_voice="af_sky")
    assert isinstance(build_tts(settings, "vi"), VietnameseNormalizingTTS)
    assert not isinstance(build_tts(settings, "en"), VietnameseNormalizingTTS)


def test_vietnamese_tts_spells_acronyms_with_english_letter_names():
    text = normalize_vietnamese_tts_text("Tôi dùng API, RAG, LLM và GPU.")

    # Each acronym letter is voiced as its English letter name, transcribed for
    # the Vietnamese TTS voice (R -> "a", A -> "ây", G -> "gi", ...).
    assert text == "tôi dùng ây pi ai, a ây gi, eo eo em và gi pi diu."
    assert "<en>" not in text and "</en>" not in text


def test_vietnamese_tts_keeps_pronounceable_acronyms_as_words():
    # sea_g2p keeps RAM/NASA as whole words (not letter-split); we must not
    # spell them out letter-by-letter.
    text = normalize_vietnamese_tts_text("RAM và NASA là gì?")

    assert text == "ram và nasa là gì?"


def test_vietnamese_tts_normalizes_before_synthesis(monkeypatch):
    captured = {}

    def fake_synthesize(self, text, *, conn_options):
        captured["text"] = text
        return object()

    monkeypatch.setattr(openai.TTS, "synthesize", fake_synthesize)

    vi = build_tts(
        Settings(
            _env_file=None,
            tts_vi_base_url="http://vi-f5:8881/v1",
            tts_vi_voice="main",
        ),
        "vi",
    )

    vi.synthesize("Hãy giải thích RAG trong hệ thống tuyển dụng.")

    assert captured["text"] == "hãy giải thích a ây gi trong hệ thống tuyển dụng."
