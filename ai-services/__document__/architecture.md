# Architecture — Planning Agent

> **Audience:** engineers and AI assistants who need to understand the Planning
> Agent end-to-end before reading, changing, or extending it. This document is
> meant to be **self-contained**: every concept it relies on is explained here at
> least once. For line-level deep dives it links to the companion docs
> ([data-flow](data-flow.md), [schema](schema.md), [tools-and-skills](tools-and-skills.md),
> [tools-logic-and-scaling](tools-logic-and-scaling.md), [observability](observability.md),
> [known-issues](known-issues.md)).

---

## 1. What this subsystem does

The Planning Agent is the **first** of the four agents in GreenTemis (Planning →
Interview → Code Assignment → Inspector). It is the **orchestrator's brain for a
single candidate**: given the raw inputs of one hiring case, it produces the
plan that the other three agents execute.

**Input (one HTTP request):**

- `cv_markdown` — the candidate's CV, already converted from PDF to Markdown
  upstream (the conversion is the backend's job, not this service's).
- `jd_text` — the job description, markdown or plaintext.
- `position` — the job title (optional).
- `special_requirements` — free-text focus areas from HR (optional).

**Output (one validated object):** a single `InterviewPlan` containing the
weighted competencies, interview topics with candidate-specific questions, one
coding assignment with runnable test cases, the Inspector's scoring criteria, a
duration, and a one-paragraph summary. See [schema.md](schema.md) for every field.

That plan is **data, not a user-facing message**. The backend persists it,
schedules the meeting, returns the meeting link, and later hands the plan to the
Interview / Code Assignment / Inspector agents.

```
   CV (md) + JD + HR notes  ─────▶  [ Planning Agent ]  ─────▶  one InterviewPlan
                                                                      │
                                          drives ◀────────────────────┤
                                          Interview Agent ────────────┤
                                          Code Assignment Agent ──────┤
                                          Inspector Agent ────────────┘
```

---

## 2. Core concepts (read this before the diagrams)

These four ideas are the whole mental model. Everything below is an elaboration.

### 2.1 "Agent" = MAF `Agent` (a model + a tool loop)

We use the **Microsoft Agent Framework** (`agent_framework`, abbreviated **MAF**).
A MAF `Agent` bundles three things:

1. a **chat client** (the LLM "brain"),
2. **system instructions** (the persona + workflow), and
3. a list of **tools** (plain Python functions the model may call).

When you call `agent.run(prompt)`, MAF runs the **tool loop** for you: it sends
the prompt to the model; if the model emits a tool call, MAF executes the Python
function, feeds the result back, and repeats until the model returns a final
answer. **We never hand-roll this loop** — that is MAF's job.

### 2.2 The brain is provider-agnostic (OpenAI-compatible)

The chat client is `OpenAIChatCompletionClient` pointed at any
**OpenAI-compatible** endpoint. Endpoint, model name, and key all come from
`.env` (see [§6](#6-configuration)), so the *same code* runs against the company
Gemma/MaaS gateway, a self-hosted vLLM, or a local Ollama.

> **Why `OpenAIChatCompletionClient` and not `OpenAIChatClient`?** The latter
> calls `/v1/responses`, a route many OpenAI-compatible gateways (incl. VNG MaaS)
> do not implement — it returns a misleading `404 "model not found"`.
> `OpenAIChatCompletionClient` calls the universally-supported
> `/v1/chat/completions`. This choice is load-bearing; do not "simplify" it.

### 2.3 Hybrid grounding: **tools = facts, LLM = reasoning**

This is the central design decision. We split the work by *what each side is good
at and bad at*:

| Job | Owner | Why |
| --- | --- | --- |
| Pull skills / level / domain out of the JD | `extract_requirements` (deterministic) | Fast, no extra LLM round-trip, can't hallucinate a requirement the JD never stated. |
| Confirm which skills *actually* appear in the CV | `match_skills` (deterministic) | Stops the LLM "remembering" a skill the CV never mentions. The **gaps** become probe targets. |
| Supply a coding problem with **runnable** test cases | `search_problem_bank` (deterministic) | The Code Assignment grader later *executes* these tests; the LLM must not invent unverified ones. |
| Competencies, weights, topics, questions, rubric, summary | **LLM brain** | This is the real tailoring — generic templates would not reflect *this* CV/JD. |

The "intelligence" lives in the LLM reading the **actual** CV + JD and tailoring
the plan. The tools only nail down the parts that are *easy for an LLM to get
wrong*. The rejected alternative — tools that emit question/topic *templates* —
produces generic questions disconnected from the candidate; the hybrid split
keeps the agent specific.

> ⚠️ Today's tools implement these facts with **rule-based regex / substring**
> logic. That is deliberate (deterministic, offline-testable, no extra LLM calls)
> but **fragile** — see [tools-logic-and-scaling.md](tools-logic-and-scaling.md)
> for exactly how, and [roadmap.md](roadmap.md) for where the tool layer is going.

### 2.4 Structured output (with a graceful fallback)

The agent must return a **schema-valid** `InterviewPlan`, not prose. The
preferred mechanism is `response_format=InterviewPlan`: MAF forces the model to
emit JSON conforming to `InterviewPlan.model_json_schema()` and parses it into
`result.value`. Because not every gateway supports that feature, there is a
**fallback** that embeds the schema in the prompt and parses the returned text.
Both paths return a *validated* `InterviewPlan`. See [§5](#5-the-two-output-paths).

---

## 3. The big picture

```
                         ┌───────────┐         ┌───────────────────────────┐
   HR (browser)  ──────▶ │ frontend  │ ──────▶ │  backend  (persistence,   │
                         │  (React)  │         │  scheduling, meeting link) │
                         └───────────┘         └─────────────┬─────────────┘
                                                             │ POST /api/v1/planning/plan
                                                             │ PlanRequest (CV md, JD, ...)
                                                             ▼
   ╔═══════════════════════════════ ai-services (port 8001) ═══════════════════════════════╗
   ║                                                                                         ║
   ║   ┌──────────────────────────┐                                                          ║
   ║   │ planning_router          │  validates body → PlanRequest                            ║
   ║   │ POST /api/v1/planning/plan│                                                          ║
   ║   └────────────┬─────────────┘                                                          ║
   ║                │ run_planning_agent(req)                                                ║
   ║                ▼                                                                         ║
   ║   ┌──────────────────────────────────────────────────────────────────────────────┐    ║
   ║   │  agent_framework.Agent  ("PlanningAgent")                                      │    ║
   ║   │  ───────────────────────────────────────────────────────────────────────────  │    ║
   ║   │  brain  : OpenAIChatCompletionClient(model, base_url, api_key)  ◀── .env       │    ║
   ║   │  prompt : _PLANNING_INSTRUCTIONS (workflow) + _build_user_prompt(req)          │    ║
   ║   │  tools  : extract_requirements · match_skills · search_problem_bank            │    ║
   ║   │           (deterministic grounding — no LLM inside the tools)                  │    ║
   ║   │  output : response_format=InterviewPlan  (PATH 1)                              │    ║
   ║   │           └─ on failure ─▶ JSON-in-prompt fallback (PATH 2)                     │    ║
   ║   └────────────────────────────────────┬─────────────────────────────────────────┘    ║
   ║                                         │ validated InterviewPlan                        ║
   ║   ┌─────────────────────────────────────┘                                                ║
   ║   │ also mounted on the same app, SEPARATE subsystem:                                    ║
   ║   │   /mcp/*  ← MCP/SSE tools the *Interview* agent uses live (interview_tools.py)        ║
   ║   └──────────────────────────────────────────────────────────────────────────────────  ║
   ║                                                                                         ║
   ║   observability: setup_observability() at import time → OTel spans → Arize Phoenix      ║
   ╚═════════════════════════════════════════│═══════════════════════════════════════════════╝
                                              │ 200 InterviewPlan
                                              ▼
                                        backend (stores plan, returns meeting link)
```

---

## 4. Components (source map)

All paths are under `ai-services/`.

| Symbol / file | Role |
| --- | --- |
| `app/main.py` | Service entrypoint. One FastAPI app on **port 8001** with two surfaces (REST + MCP). Calls `setup_observability()` **before** any agent is built. |
| `app/api/planning_router.py` → `create_plan()` | The REST route `POST /api/v1/planning/plan`. Validates the body into `PlanRequest`, calls the agent, returns the plan. Currently maps **any** error to HTTP 500 (see [known-issues](known-issues.md) #2). |
| `app/agents/planning_agent.py` | The heart of the subsystem. See the breakdown below. |
| `app/schemas/plan.py` | `PlanRequest` (input) and `InterviewPlan` + nested models (output) — the public contract. See [schema.md](schema.md). |
| `app/skills/jd_analysis/scripts/jd_tools.py` | `extract_requirements` tool. |
| `app/skills/interview_planning/scripts/planning_tools.py` | `match_skills`, `search_problem_bank` tools + the in-code `_CODING_PROBLEMS` bank. |
| `app/config.py` → `settings` | All configuration (model, endpoint, temperature, token cap, OTel). Pydantic-settings, read from `.env`. |
| `app/observability.py` → `setup_observability()` | Wires MAF's OTel instrumentation to an OTLP exporter (Arize Phoenix). |
| `app/mcp/interview_tools.py` | **Separate subsystem** — the live-interview tools (see [§7](#7-the-second-surface-mcp-tools-for-the-interview-agent)). |

### Inside `planning_agent.py`

- **`_PLANNING_INSTRUCTIONS`** — the system prompt. Two parts: a **grounding
  workflow** ("call tools first, then reason") and **generation guidance** (be
  specific, derive competencies from the JD, reference the real CV, honour HR
  special requirements, copy test cases verbatim).
- **`_build_user_prompt(req)`** — assembles the user turn from
  position / JD / CV / special requirements.
- **`_build_agent()`** — constructs the MAF `Agent`: builds the
  `OpenAIChatCompletionClient` from `settings` (never hardcoded), attaches the
  instructions and the three tools.
- **`_parse_plan(text)`** — tolerant text→`InterviewPlan` parser: strips a
  ```` ```json ```` fence if present, slices from the first `{` to the last `}`,
  then `InterviewPlan.model_validate_json`. Used by the fallback path.
- **`run_planning_agent(req)`** — the orchestration entrypoint. Runs the agent,
  selects between the two output paths, returns a validated `InterviewPlan`.

---

## 5. The two output paths

`run_planning_agent` is **defensive** about gateways that don't fully implement
OpenAI features (the company Gemma gateway is the constraint we design around).

```
   run_planning_agent(req)
        │  build agent + base prompt
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ PATH 1 — structured output (preferred)                         │
   │   agent.run(prompt, options={                                  │
   │       response_format: InterviewPlan,                          │
   │       temperature, max_tokens })                               │
   │   • MAF forces schema-valid JSON, parsed into result.value     │
   │   • if result.value is an InterviewPlan ........... RETURN it   │
   │   • else if result.text exists .......... _parse_plan(text)    │
   └───────────────────────────────┬──────────────────────────────┘
                                    │ on ChatClientException / any Exception
                                    │ (gateway rejected response_format)
                                    ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ PATH 2 — JSON-in-prompt fallback                               │
   │   • append InterviewPlan JSON schema to the prompt             │
   │   • re-run the SAME agent (tools still available)              │
   │   • _parse_plan(result.text) ..................... RETURN it    │
   └───────────────────────────────┬──────────────────────────────┘
                                    │ still no valid JSON
                                    ▼
                          raise ValueError(text_head=...)
```

The fallback **keeps the agent agentic** — it re-runs the same agent (tools
intact), only dropping the unsupported `response_format` feature and forcing JSON
through the prompt instead.

> ⚠️ Two known weaknesses live here: PATH 2 currently re-runs on **every**
> exception, including a 429 rate-limit (amplifying load), and there is no
> retry/backoff. See [known-issues](known-issues.md) #1 and #3, and
> [roadmap.md](roadmap.md) §"Resilience". For the request lifecycle in full, see
> [data-flow.md](data-flow.md).

---

## 6. Configuration

All in `app/config.py` (`Settings`). Non-secret defaults are read from
`configs/ai-services.yml`; `OPENAI_API_KEY` is read from `.env` or process env.
Nothing is hardcoded.

| Setting | Source | Default | Meaning |
| --- | --- | --- | --- |
| `openai_api_key` | `.env` / process env | `""` | Key for the LLM gateway. |
| `openai_base_url` | YAML / process env | VNG MaaS URL | OpenAI-compatible endpoint. |
| `planning_model` | YAML / process env | `google/gemma-4-31b-it` | Model name as the provider exposes it. |
| `planning_temperature` | YAML / process env | `0.4` | Low → stable, fact-anchored plans. |
| `planning_max_tokens` | YAML / process env | `8192` | Output ceiling — must fit a full plan or JSON truncates (see #7 in known-issues). |
| `mcp_host` / `mcp_port` | YAML / process env | `0.0.0.0` / `8001` | Bind for the uvicorn server. |
| `backend_url` | YAML / process env | `http://localhost:8000` | Used by the MCP interview tools. |
| `otel_*` | YAML / process env | (see [observability](observability.md)) | Tracing switches. |

---

## 7. The second surface: MCP tools for the Interview Agent

`app/main.py` serves **two unrelated surfaces on the same port 8001**:

- `/api/v1/planning/plan` — REST, **this** subsystem (backend → Planning Agent).
- `/mcp/*` — MCP/SSE tools that the **live Interview Agent** (a different agent,
  running elsewhere) calls during an actual interview.

The MCP tools (`app/mcp/interview_tools.py`, a `FastMCP` server) are thin HTTP
proxies to the backend's `/api/v1/interviews` API. They let the live interviewer
observe and drive a session: `list_active_interviews`, `get_interview_context`,
`get_transcript`, `get_candidate_code`, `get_code_run_logs`, `switch_mode`
(interview ↔ code), `send_message_to_candidate`, and `get_live_snapshot`.

> This surface is **out of scope** for the Planning Agent docs — it is documented
> here only so you understand what else lives in the same process. The Planning
> Agent does not call it, and it does not call the Planning Agent.

---

## 8. Observability

`setup_observability()` runs once at startup, **before** any agent is built, so
every LLM call, tool call, and agent run is traced. MAF auto-instruments with
OpenTelemetry; this service only wires an OTLP exporter that ships spans to
**Arize Phoenix** (local UI). It is idempotent, a no-op when disabled, and
degrades gracefully if the OTel deps are missing.

> ⚠️ `otel_sensitive` defaults to `True`, which logs full prompt/response content
> — and the prompt contains the candidate's CV (PII). Fine for local dev, **must
> be off in production**. See [observability.md](observability.md) and
> [known-issues](known-issues.md) #6.

---

## 9. Service boundaries (invariants to preserve)

- **`frontend → backend → ai-services`.** The frontend never calls the agent
  directly; the backend is the only caller of `POST /api/v1/planning/plan`.
- **The agent returns data, not UX.** Persistence, scheduling, and the meeting
  link are the backend's responsibility.
- **`ai-services` holds no database.** Grounding data that needs a store (the
  problem bank, candidate memory) is owned outside this service — a constraint
  that shapes the [roadmap](roadmap.md).
- **Tools stay deterministic and grounded.** They surface facts the LLM can
  trust; they must never invent skills, requirements, or test cases. Every extra
  LLM call inside a tool is another round-trip against a rate-limited gateway.

---

## 10. Where to go next

| You want to… | Read |
| --- | --- |
| Trace one request end-to-end (incl. error behaviour) | [data-flow.md](data-flow.md) |
| Know every field of the request/response contract | [schema.md](schema.md) |
| Understand the three tools and the `skills/` layout | [tools-and-skills.md](tools-and-skills.md) |
| See *exactly* how each tool's rule-based logic works and why it's fragile | [tools-logic-and-scaling.md](tools-logic-and-scaling.md) |
| See the forward-looking plan to make the whole system production-grade | [roadmap.md](roadmap.md) |
| Configure tracing | [observability.md](observability.md) |
| See the open code-review findings | [known-issues.md](known-issues.md) |
