"""Settings defaults for the interview-agent service.

Secrets come from the environment; non-secret defaults are asserted here.
"""

from app.config import Settings, _load_yaml_config


def test_non_secret_defaults():
    s = Settings(_env_file=None)
    yaml_defaults = _load_yaml_config()

    assert s.agent_name == "interview-agent"
    assert s.mcp_sse_url == "http://localhost:8001/mcp/sse"
    assert s.openai_base_url == "https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1"
    assert s.openai_model == "minimax/minimax-m2.5"
    assert s.interview_max_tokens == 1000
    assert s.language == "en"

    # OpenAI-compatible speech endpoints live in configs/ai-services.yml.
    assert s.stt_base_url == yaml_defaults["stt_base_url"]
    assert s.stt_model == yaml_defaults["stt_model"]
    assert s.stt_vi_base_url == yaml_defaults["stt_vi_base_url"]
    assert s.stt_vi_model == yaml_defaults["stt_vi_model"]
    # TTS is the remote Kokoro deployment; its base_url is a tunnel that
    # changes, so assert it tracks the yml config rather than a literal.
    assert s.tts_base_url == yaml_defaults["tts_base_url"]
    assert s.tts_model == yaml_defaults["tts_model"]
    assert s.tts_voice == "af_bella"
    assert s.tts_response_format == "wav"
    assert s.tts_vi_base_url == yaml_defaults["tts_vi_base_url"]
    assert s.tts_vi_model == yaml_defaults["tts_vi_model"]
    assert s.tts_vi_voice == yaml_defaults["tts_vi_voice"]
    assert s.barge_in is False
    assert s.proctoring_allow_interruptions is False


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "qwen2.5")
    monkeypatch.setenv("MCP_SSE_URL", "http://ai-services:8001/mcp/sse")

    s = Settings(_env_file=None)

    assert s.openai_model == "qwen2.5"
    assert s.mcp_sse_url == "http://ai-services:8001/mcp/sse"


def test_dotenv_only_loads_keys_and_secrets(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OPENAI_API_KEY=secret\n"
        "OPENAI_MODEL=stale-from-env-file\n"
        "STT_BASE_URL=http://stale.local/v1\n",
        encoding="utf-8",
    )

    s = Settings(_env_file=env_file)
    yaml_defaults = _load_yaml_config()

    assert s.openai_api_key == "secret"
    assert s.openai_model == "minimax/minimax-m2.5"
    assert s.stt_base_url == yaml_defaults["stt_base_url"]
