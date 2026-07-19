import json

import httpx
from mcp.server.fastmcp import FastMCP
from openai import AsyncOpenAI

from app.config import settings

BACKEND_URL = settings.backend_url

mcp = FastMCP(
    name="temis-interview-agent-tools",
    instructions=(
        "You are an AI interviewer observing and conducting a technical interview "
        "on the Temis platform. Use these tools to watch the candidate in real time, "
        "ask follow-up questions, and switch between interview and code modes."
    ),
    host=settings.mcp_host,
    port=settings.mcp_port,
)

API = BACKEND_URL.rstrip("/") + "/api/v1/interviews"

# Header sent on endpoints that require HR-or-service auth.
_SERVICE_HEADERS = (
    {"X-Service-Key": settings.internal_service_key}
    if settings.internal_service_key
    else {}
)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get(path: str, *, auth: bool = False) -> dict:
    headers = _SERVICE_HEADERS if auth else {}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{API}/{path}", headers=headers)
        r.raise_for_status()
        return r.json()


async def _post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{API}/{path}", json=body)
        r.raise_for_status()
        return r.json()


async def _put(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.put(f"{API}/{path}", json=body)
        r.raise_for_status()
        return r.json()


# ── Tools ────────────────────────────────────────────────────────────────────

@mcp.tool()
async def list_active_interviews() -> list:
    """List all interviews that are currently in progress.
    Use this only for discovery/admin flows. A room-bound interview agent must
    use the interview_id provided in its system prompt instead of selecting from
    this list.
    Returns candidate name, position, status, and interview_id for each active session."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(API, headers=_SERVICE_HEADERS)
        r.raise_for_status()
        all_interviews = r.json()
    return [
        {
            "interview_id": iv.get("id"),
            "candidate_name": iv.get("candidate_name"),
            "position": iv.get("position"),
            "status": iv.get("status"),
            "created_at": iv.get("created_at"),
        }
        for iv in all_interviews
        if iv.get("status") == "in_progress"
    ]


@mcp.tool()
async def get_interview_context(interview_id: str) -> dict:
    """Get complete context for an interview: candidate info, JD, and the
    structured interview plan (topics, questions, coding assignment).
    Call this first before starting to conduct the interview."""
    return await _get(interview_id)


@mcp.tool()
async def get_transcript(interview_id: str) -> dict:
    """Get the full conversation transcript so far.
    Returns every turn between the agent and the candidate, in order.
    Use this to understand what has already been asked and answered."""
    return await _get(f"{interview_id}/transcript")


@mcp.tool()
async def get_problem_statement(interview_id: str) -> dict:
    """Get the assignment problem statement so you can EXPLAIN it to the candidate.

    Call this immediately after switch_mode('code') — before the candidate starts
    typing. Read the title, difficulty, and statement, then VERBALLY walk the
    candidate through the problem: restate it in plain language, clarify the
    input/output, and give an example. Do NOT read raw markdown aloud; paraphrase
    naturally as you would in a spoken interview.

    Returns: title, difficulty, statement, function signature, and any examples."""
    data = await _get(interview_id)
    plan = data.get("plan") or {}
    assignment = data.get("assignment") or {}
    coding = (assignment.get("coding") or plan.get("coding_assignment") or {})
    return {
        "interview_id": interview_id,
        "title": coding.get("title", ""),
        "difficulty": coding.get("difficulty", ""),
        "mode": coding.get("mode", "dsa"),
        "statement": coding.get("statement") or coding.get("assignment_brief") or coding.get("coding_brief") or "",
        "function_name": coding.get("function_name", ""),
        "starter_code": coding.get("starter_code", ""),
    }


@mcp.tool()
async def get_candidate_code(interview_id: str) -> dict:
    """Get the candidate's current code in the editor.
    The frontend syncs code to the backend every few seconds, so this reflects
    what the candidate is actively writing. Use to review their approach before
    asking a follow-up question about it."""
    data = await _get(interview_id)
    return {
        "interview_id": interview_id,
        "current_code": data.get("current_code"),
        "coding_problem": (
            (data.get("plan") or {})
            .get("coding_assignment", {})
        ),
    }


@mcp.tool()
async def get_code_run_logs(interview_id: str) -> dict:
    """Get the results of the candidate's most recent code execution.
    Includes test results (passed/failed), stdout, stderr, and whether it timed out.
    Use to evaluate code correctness and decide on follow-up questions."""
    data = await _get(interview_id)
    return {
        "interview_id": interview_id,
        "last_run_result": data.get("last_run_result"),
    }


@mcp.tool()
async def switch_mode(interview_id: str, mode: str) -> dict:
    """Switch the candidate's interview room between 'interview' and 'code' mode.

    - 'interview': voice-only screen, candidate answers spoken questions
    - 'code':      Monaco editor + problem statement visible

    The candidate CANNOT switch screens themselves — only you can, through this
    tool. The assignment is ready from the start of the session, so you may
    switch to 'code' whenever you reach the coding part of the plan.

    The backend sends the switch command to the candidate's browser via LiveKit.
    Call this when transitioning from Q&A to the coding assignment.

    Switching back to 'code' restores the candidate's saved work — it never
    resets the editor. Once the candidate has SUBMITTED the assignment the
    response includes "finished": true; after that the assignment is locked
    read-only, so do NOT switch back to 'code' to have them edit again — move on
    to wrap-up or the next part instead."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{API}/{interview_id}/switch-mode",
            params={"mode": mode},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool()
async def end_interview(interview_id: str) -> dict:
    """End the interview and LEAVE the meeting.

    Call this when the interview is fully complete — you have finished the Q&A
    AND the assignment and said your short closing remarks — or when you must
    stop the session early. It marks the interview completed, generates the
    evaluation report, and closes the room; you will leave right after. Say your
    goodbye BEFORE calling this, then call it once."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{API}/{interview_id}/end")
        r.raise_for_status()
        return r.json()


@mcp.tool()
async def send_message_to_candidate(interview_id: str, message: str) -> dict:
    """Send a message to the candidate that appears on their screen as the
    interviewer's voice/question.

    Use this to:
    - Ask follow-up questions based on their code or previous answers
    - Give clarification or hints during the coding section
    - Acknowledge answers and transition to the next topic

    The message is delivered via LiveKit and also saved to the transcript."""
    return await _post(f"{interview_id}/send-agent-message", {"message": message})


@mcp.tool()
async def append_transcript_turn(
    interview_id: str,
    role: str,
    content: str,
    ts: float | None = None,
) -> dict:
    """Append a single turn to the interview transcript, incrementally.

    The voice interview agent calls this after every turn so the inspector can
    score in near real time and the transcript survives a mid-session crash.

    - role: 'agent' (the interviewer's spoken turn) or 'candidate' (their reply)
    - content: the text of that turn
    - ts: optional epoch seconds when the turn happened
    """
    if role not in ("agent", "candidate"):
        raise ValueError("role must be 'agent' or 'candidate'")
    body: dict = {"role": role, "content": content}
    if ts is not None:
        body["ts"] = ts
    return await _post(f"{interview_id}/transcript/append", body)


@mcp.tool()
async def set_coding_assistant(interview_id: str, enabled: bool) -> dict:
    """Enable or disable the candidate's coding assistant (the in-editor AI chat).

    - enabled=True:  candidate may ask the AI for coding help during the task
    - enabled=False: the assistant chat is locked out on their screen

    Use this to control whether the candidate gets AI assistance — e.g. disable
    it for a section you want to evaluate unaided, then re-enable it later.
    The change is pushed to the candidate's browser in real time via LiveKit."""
    return await _post(f"{interview_id}/set-assistant", {"enabled": enabled})


@mcp.tool()
async def get_live_snapshot(interview_id: str) -> dict:
    """Get a complete real-time snapshot of the interview in one call.
    Returns: candidate info, conversation transcript, current code, and
    last test run results. Use when you need full context to make a decision."""
    data = await _get(interview_id)
    transcript = await _get(f"{interview_id}/transcript")
    return {
        "candidate_name": data.get("candidate_name"),
        "position": data.get("position"),
        "status": data.get("status"),
        "conversation_history": transcript.get("conversation_history", []),
        "current_code": data.get("current_code"),
        "last_run_result": data.get("last_run_result"),
        "plan_summary": {
            "topics": [
                t.get("title")
                for t in ((data.get("plan") or {}).get("interview_topics") or [])
            ],
            "coding_assignment": (
                (data.get("plan") or {}).get("coding_assignment", {}) or {}
            ).get("title"),
        },
    }


@mcp.tool()
async def get_sandbox_files(interview_id: str) -> dict:
    """Get all files the candidate is currently editing in the React sandbox.

    In project mode the candidate works across multiple files (App.js,
    styles.css, etc.). The frontend syncs every 5 seconds, so this reflects
    their near-real-time code. Returns a dict of filename -> file content.

    Use this (instead of get_candidate_code) when the assignment mode is
    'project' — e.g. before asking a follow-up question about their component
    structure, state management, or styling choices."""
    data = await _get(interview_id)
    sandbox_files = data.get("sandbox_files") or {}
    assignment = data.get("assignment") or {}
    coding = (assignment.get("coding") or {})
    return {
        "interview_id": interview_id,
        "mode": coding.get("mode"),
        "title": coding.get("title"),
        "files": sandbox_files,
        "file_count": len(sandbox_files),
    }


@mcp.tool()
async def analyze_candidate_code(interview_id: str, focus: str = "") -> dict:
    """Analyze the candidate's current code and return a structured assessment.

    Reads the sandbox files (project mode) or current_code (DSA mode), then
    runs a focused code review via LLM and returns:
    - summary: 1-2 sentences on overall approach and quality
    - issues: up to 4 specific problems found in the code
    - strengths: up to 3 notable positives
    - suggested_questions: 2-3 follow-up questions you can ask the candidate

    Use `focus` to steer the analysis, e.g. "state management", "component
    structure", "performance", "error handling". Leave empty for a general review.

    Call this before a follow-up code question so your question is grounded in
    what they actually wrote, not a generic probe."""
    data = await _get(interview_id)
    assignment = data.get("assignment") or {}
    coding = assignment.get("coding") or {}
    mode = coding.get("mode", "dsa")

    if mode == "project":
        files = data.get("sandbox_files") or {}
        if not files:
            return {"error": "No sandbox files synced yet — candidate may not have started coding."}
        code_block = "\n\n".join(
            f"// === {path} ===\n{content}"
            for path, content in files.items()
        )
    else:
        code_block = data.get("current_code") or ""
        if not code_block.strip():
            return {"error": "No code found — candidate has not written anything yet."}

    title = coding.get("title", "coding assignment")
    statement = coding.get("statement", "")
    focus_hint = f" Focus especially on: {focus}." if focus else ""

    prompt = f"""You are a senior engineer reviewing a candidate's code submission for: "{title}".

Assignment brief:
{statement[:800]}

Candidate's code:
{code_block[:3000]}

Provide a concise code review.{focus_hint}

Return ONLY valid JSON matching this schema exactly:
{{
  "summary": "1-2 sentence overall assessment",
  "issues": ["issue 1", "issue 2"],
  "strengths": ["strength 1"],
  "suggested_questions": ["question 1", "question 2"]
}}
Max 4 issues, 3 strengths, 3 questions. Be specific — reference actual code, not generic advice."""

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url or None,
    )
    response = await client.chat.completions.create(
        model=settings.openai_model or settings.assignment_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
    raw = (response.choices[0].message.content or "").strip()
    # Strip markdown fences if the model wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw_analysis": raw}
