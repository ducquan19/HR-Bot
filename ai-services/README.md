# GreenTemis AI Services

`ai-services/` chứa các AI agent và MCP tools của GreenTemis Agent. Service này có hai bề mặt chính:

- REST APIs để backend gọi khi cần sinh plan, assignment, câu trả lời coding assistant và report đánh giá.
- MCP/SSE tools để LiveKit Interview Agent quan sát, điều khiển và ghi trạng thái buổi phỏng vấn theo thời gian thực.

Cùng Docker image của thư mục này cũng được dùng để chạy `interview-agent` worker bằng command riêng trong `docker-compose.yml`.

## Agent Trong Service

| Agent | Vai trò |
| --- | --- |
| Planning Agent | Đọc CV + JD + yêu cầu HR, sinh interview brief, evaluation brief và assignment brief |
| Assignment Agent | Sinh bài coding hoặc cognitive test từ bối cảnh tuyển dụng |
| Coding Assistant | Trả lời câu hỏi của candidate trong editor khi được bật |
| Inspector Agent | Chấm điểm transcript, assignment result và proctoring events, sinh report markdown/PDF |
| Interview Agent Worker | Join LiveKit room, chạy STT -> LLM -> TTS, hỏi ứng viên và dùng MCP tools |

## Use Case

- Backend gọi `POST /api/v1/planning/plan` khi HR tạo interview.
- Backend gọi `POST /api/v1/assignment/generate` để tạo bài test sẵn trước khi candidate join.
- Backend gọi `POST /api/v1/coding-assistant/chat` khi candidate hỏi AI trong editor.
- Backend gọi `POST /api/v1/inspector/evaluate` khi interview kết thúc để sinh report.
- Interview Agent dùng `/mcp/sse` để lấy context, transcript, code, run logs, chuyển mode UI, bật/tắt assistant và kết thúc interview.
- Assignment Agent tools ở `/assignment-mcp/sse` điều khiển trạng thái AI coding assistant theo loại bài.

## Tech Stack

| Nhóm | Công nghệ |
| --- | --- |
| API | Python 3.12, FastAPI, Uvicorn |
| Agent framework | Microsoft Agent Framework (`agent-framework`) |
| MCP | `mcp[cli]`, FastMCP, SSE transport |
| Voice worker | `livekit-agents[openai,silero,turn-detector,mcp]` |
| AI provider | OpenAI-compatible LLM/STT/TTS endpoints |
| Config | pydantic-settings, YAML config, secret-only `.env` loading |
| HTTP | httpx |
| Report | markdown, fpdf2, matplotlib |
| Vietnamese TTS prep | `sea-g2p` |
| Observability | OpenTelemetry OTLP exporter, Phoenix-compatible endpoint |

## Kiến Trúc AI Services

![Sơ đồ tương tác 4 agent trong ai-services](../assets/ai-services-agent-interactions.svg)

Luồng Planning Agent:

```text
PlanRequest
  -> deterministic grounding: JD requirements, skill match, problem bank
  -> LLM sinh 3 brief riêng: interview, evaluation, assignment
  -> validate InterviewPlan
  -> trả về backend
```

Luồng Interview Agent Worker:

```text
LiveKit dispatch metadata: { interview_id, config }
  -> fetch context từ backend qua MCP
  -> tạo AgentSession(STT, LLM, TTS, VAD/turn detection)
  -> nói intro
  -> ghi transcript tăng dần
  -> phản ứng proctoring, chuyển code mode, kết thúc interview
```

## REST API

| Method | Path | Mục đích |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe |
| `POST` | `/api/v1/planning/plan` | Sinh `InterviewPlan` từ CV/JD |
| `POST` | `/api/v1/assignment/generate` | Sinh coding/cognitive assignment |
| `POST` | `/api/v1/coding-assistant/chat` | Trả lời chat coding assistant |
| `POST` | `/api/v1/inspector/evaluate` | Chấm điểm và sinh report |

## MCP Tools

Interview tools tại `/mcp/sse`:

| Tool | Vai trò |
| --- | --- |
| `list_active_interviews` | Liệt kê interview đang chạy |
| `get_interview_context` | Lấy thông tin candidate, JD, plan, assignment |
| `get_transcript` | Lấy transcript hiện tại |
| `get_problem_statement` | Lấy nội dung assignment để agent giải thích cho candidate |
| `get_candidate_code` | Đọc code hiện tại của candidate |
| `get_code_run_logs` | Đọc kết quả chạy code gần nhất |
| `switch_mode` | Chuyển UI giữa `interview` và `code` |
| `end_interview` | Kết thúc interview và rời room |
| `send_message_to_candidate` | Gửi message qua LiveKit data channel |
| `append_transcript_turn` | Ghi một lượt hội thoại vào backend |
| `set_coding_assistant` | Bật/tắt coding assistant trong UI |
| `get_live_snapshot` | Lấy snapshot tổng hợp để ra quyết định |

Assignment tools tại `/assignment-mcp/sse`:

| Tool | Vai trò |
| --- | --- |
| `enable_coding_assistant` | Bật AI assistant cho project challenge |
| `disable_coding_assistant` | Tắt AI assistant cho DSA challenge |
| `get_coding_assistant_status` | Đọc trạng thái assistant hiện tại |

## Cấu Hình

Giá trị không secret nằm trong `../configs/ai-services.yml`. Secret được đọc từ repo-root `.env` hoặc biến môi trường.

Nhóm cấu hình chính:

| Nhóm | Ví dụ |
| --- | --- |
| REST/MCP | `backend_url`, `mcp_host`, `mcp_port`, `internal_service_key` |
| Planning | `openai_base_url`, `planning_model`, `planning_temperature`, `planning_max_tokens` |
| Assignment | `assignment_model`, `assignment_temperature`, `assignment_max_tokens` |
| Coding Assistant | `coding_assistant_model`, `coding_assistant_temperature` |
| Inspector | `inspector_model`, `inspector_temperature`, `inspector_max_tokens` |
| Interview worker | `livekit_url`, `agent_name`, `language`, `mcp_sse_url`, `duration_minutes` |
| STT/TTS | `stt_base_url`, `stt_model`, `tts_base_url`, `tts_voice`, các cấu hình tiếng Việt |
| Observability | `otel_enabled`, `otel_otlp_endpoint`, `otel_console`, `otel_sensitive` |

Secret tiêu biểu:

- `OPENAI_API_KEY`
- `STT_API_KEY`
- `KOKORO_API_KEY`
- `STT_VI_API_KEY`
- `TTS_VI_API_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `INTERNAL_SERVICE_KEY`

## Chạy Local

```bash
cd ai-services
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

Server mặc định chạy ở <http://localhost:8001>.

Chạy Interview Agent console/mock:

```bash
cd ai-services
source .venv/bin/activate
python -m app.agents.interview.agent console
```

Chạy worker thật thường dùng Docker Compose vì cần LiveKit:

```bash
docker compose up -d --build ai-services interview-agent
```

## Test

```bash
cd ai-services
pip install -r requirements-dev.txt
python -m pytest test app/test
```

## Cấu Trúc Thư Mục

```text
ai-services/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   ├── mcp/
│   ├── agents/
│   │   ├── planning/
│   │   ├── assignment/
│   │   ├── coding_assistant/
│   │   ├── inspector/
│   │   └── interview/
│   ├── infra/
│   ├── schemas/
│   └── skills/
├── mock/
├── scripts/
├── test/
├── requirements.txt
├── requirements-dev.txt
└── Dockerfile
```

## Ghi Chú Phát Triển

- `app/config.py` cố ý chỉ lấy một số field secret từ `.env`; model name và base URL nên để trong YAML hoặc env runtime.
- Planning Agent sinh các brief ngắn riêng biệt để giảm lỗi JSON dài/truncated từ OpenAI-compatible gateway.
- Backend có bản copy schema assignment/plan riêng; khi đổi output contract cần cập nhật backend và test tương ứng.
- `scripts/prefetch_models.py` tải trước asset LiveKit plugins trong Docker build để worker khởi động ổn định hơn.
- `otel_sensitive=true` có thể ghi nội dung prompt/response vào tracing; chỉ bật trong môi trường dev an toàn.
