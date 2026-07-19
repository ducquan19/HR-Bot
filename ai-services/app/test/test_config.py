"""Settings source order for ai-services."""

from app.config import Settings


def test_non_secret_defaults_from_yaml():
    s = Settings(_env_file=None)

    assert s.backend_url == "http://localhost:8000"
    assert s.openai_base_url == "https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1"
    assert s.planning_model == "google/gemma-4-31b-it"
    assert s.mcp_port == 8001


def test_dotenv_only_loads_openai_api_key(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OPENAI_API_KEY=secret\n"
        "OPENAI_BASE_URL=http://stale.local/v1\n"
        "PLANNING_MODEL=stale-model\n",
        encoding="utf-8",
    )

    s = Settings(_env_file=env_file)

    assert s.openai_api_key == "secret"
    assert s.openai_base_url == "https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1"
    assert s.planning_model == "google/gemma-4-31b-it"


def test_process_env_can_override_runtime_config(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "http://host.docker.internal:8000")

    s = Settings(_env_file=None)

    assert s.backend_url == "http://host.docker.internal:8000"
