FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/root/.cache/huggingface \
    AI_SERVICES_REPO_ROOT=/app

WORKDIR /app

# System deps occasionally needed when building wheels (agent-framework, etc.).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Build context is the repo ROOT (so configs/ can be bundled). Paths are
# therefore prefixed with ai-services/. See docker-compose.yml build.context: "."
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model assets (incl. the multilingual turn detector) so the
# interview-agent starts without network access. The generic download-files
# command misses the multilingual turn detector, so use a targeted script.
COPY scripts/prefetch_models.py ./scripts/prefetch_models.py
RUN python scripts/prefetch_models.py

COPY app ./app
COPY mock ./mock

# Local default 8001; AgentBase Runtime sets PORT=8080 (platform routes to 8080).
# Set AGENT_MODE=interview to run the LiveKit voice worker instead of the REST server.
EXPOSE 8001
CMD ["sh", "-c", "if [ \"$AGENT_MODE\" = 'interview' ]; then exec python -m app.agents.interview.agent start; else exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}; fi"]
