import os
from pathlib import Path
from typing import Any

import yaml
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

_REPO_ROOT = Path(os.environ.get("GREENTEMIS_REPO_ROOT", Path(__file__).resolve().parents[2]))
_CONFIG_FILE = _REPO_ROOT / "configs" / "ai-services.yml"
_DOTENV_SECRET_FIELDS = {
    "openai_api_key",
    "livekit_api_key",
    "livekit_api_secret",
    "stt_api_key",
    "stt_vi_api_key",
    "kokoro_api_key",
    "tts_vi_api_key",
    "internal_service_key",
}


def _load_yaml_config() -> dict[str, Any]:
    if not _CONFIG_FILE.exists():
        return {}
    with _CONFIG_FILE.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        return {}
    # Merge interview-agent section into ai-services section.
    # ai-services values take priority over interview-agent defaults.
    merged: dict[str, Any] = {}
    if isinstance(data.get("interview-agent"), dict):
        merged.update(data["interview-agent"])
    if isinstance(data.get("ai-services"), dict):
        merged.update(data["ai-services"])
    return merged


class YamlConfigSource(PydanticBaseSettingsSource):
    """Lowest-priority non-secret defaults from ai-services.yml."""

    def __init__(self, settings_cls):
        super().__init__(settings_cls)
        self._data = _load_yaml_config()

    def get_field_value(self, field, field_name):
        return self._data.get(field_name), field_name, False

    def __call__(self) -> dict[str, Any]:
        return {k: v for k, v in self._data.items() if v is not None}


class DotenvSecretsSource(PydanticBaseSettingsSource):
    """Read only API keys/secrets from repo-root .env."""

    def __init__(self, settings_cls, source: PydanticBaseSettingsSource):
        super().__init__(settings_cls)
        self._source = source

    def get_field_value(self, field, field_name):
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        data = self._source()
        return {k: v for k, v in data.items() if k in _DOTENV_SECRET_FIELDS}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    # MCP server (Interview Agent tools)
    backend_url: str = "http://backend:8000"
    internal_service_key: str = ""
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8001

    # Planning Agent — OpenAI-compatible provider. Non-secret defaults live in
    # configs/ai-services.yml. Secrets (OPENAI_API_KEY) go in repo-root .env.
    openai_api_key: str = ""
    openai_base_url: str = ""
    planning_model: str = ""
    planning_temperature: float = 0.4
    planning_max_tokens: int = 8192
    planning_request_timeout: float = 40.0
    # Analyst (grounding) step — routed separately; empty → use planning_model.
    planning_analyst_model: str = ""
    planning_analyst_max_tokens: int = 1100

    # Assignment Agent — dedicated knobs (same provider as planning).
    # Defaults in configs/ai-services.yml.
    assignment_model: str = ""
    assignment_temperature: float = 0.4
    assignment_max_tokens: int = 8192
    coding_assistant_model: str = ""
    coding_assistant_temperature: float = 0.3
    coding_assistant_max_tokens: int = 2048

    # Inspector (Judge) Agent — chấm điểm + sinh report. Empty model → fallback
    # planning_model. Defaults in configs/ai-services.yml.
    inspector_model: str = ""
    inspector_temperature: float = 0.3
    inspector_max_tokens: int = 4096

    # Interview worker — LiveKit connection. Secrets in .env.
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # Interview worker — LLM. Default in configs/ai-services.yml.
    openai_model: str = ""
    # Keep spoken turns paced while leaving enough room to finish a sentence.
    interview_temperature: float = 0.5
    interview_max_tokens: int = 1000

    # Interview worker — STT (English). Default URL/model in configs/ai-services.yml.
    # STT_API_KEY is env-only.
    stt_base_url: str = ""
    stt_api_key: str = ""
    stt_model: str = ""

    # Interview worker — STT (Vietnamese). STT_VI_API_KEY is env-only; use
    # "local" for unauthenticated local servers. Defaults to a local Whisper
    # instance until a hosted Vietnamese model is provisioned.
    stt_vi_base_url: str = "http://localhost:9000/v1"
    stt_vi_api_key: str = ""
    stt_vi_model: str = "whisper-1"

    # Interview worker — TTS (English kokoro-fastapi). URL/model/voice in
    # configs/ai-services.yml. KOKORO_API_KEY is env-only.
    tts_base_url: str = ""
    kokoro_api_key: str = ""
    tts_model: str = ""
    tts_voice: str = ""
    tts_response_format: str = "wav"

    # Interview worker — Vietnamese TTS. TTS_VI_API_KEY is env-only.
    tts_vi_base_url: str = ""
    tts_vi_api_key: str = ""
    tts_vi_model: str = ""
    tts_vi_voice: str = ""

    # Interview worker — MCP toolbox URL and session defaults
    mcp_sse_url: str = "http://localhost:8001/mcp/sse"
    agent_name: str = "interview-agent"
    language: str = "en"
    mock_plan_path: str = ""

    # ========== SESSION TIMING ==========
    # Duration & pacing configuration (defaults in configs/ai-services.yml).
    duration_minutes: int = 15
    grace_minutes: int = 3
    max_silence_end_min: int = 3
    dead_air_prompt_sec: int = 20
    wrap_soon_minutes: int = 3

    # ========== VOICE/DETECTION ==========
    # Voice activity detection and turn-taking (defaults in configs/ai-services.yml).
    silence_threshold_ms: int = 1500
    barge_in: bool = False
    endpointing_mode: str = "turn-detection"

    # ========== PROCTORING ==========
    # Cheating detection settings (defaults in configs/ai-services.yml).
    proctoring_cooldown_seconds: int = 15
    proctoring_max_violations: int = 5
    proctoring_allow_interruptions: bool = False

    # Monitoring — OpenTelemetry export to Arize Phoenix UI (local)
    otel_enabled: bool = False                            # bật/tắt tracing
    otel_otlp_endpoint: str = "http://localhost:6006/v1/traces"  # Phoenix OTLP HTTP
    otel_console: bool = False                            # in span ra console (debug)
    otel_sensitive: bool = True   # log cả nội dung prompt/response (dev only)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            env_settings,
            DotenvSecretsSource(settings_cls, dotenv_settings),
            YamlConfigSource(settings_cls),
            file_secret_settings,
        )


settings = Settings()
