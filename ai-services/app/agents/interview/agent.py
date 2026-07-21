import asyncio
import json
import logging
import os
import random
import time
from pathlib import Path

from livekit.agents import (
    AgentSession,
    JobContext,
    TurnHandlingOptions,
    WorkerOptions,
    cli,
)
from livekit.plugins import silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from app.agents.interview.workflow import build_interviewer_agent
from app.agents.interview.lifecycle import load_mock_session, prepare_session
from app.config import settings
from app.agents.interview.domain.pacing import PacingClock, is_terminal, signal_instruction
from app.agents.interview.domain.session_config import SessionConfig
from app.agents.interview.domain.transcript_log import TranscriptLog
from app.infra.backend_client import BackendClient
from app.infra.llm import build_llm
from app.infra.mcp_client import build_mcp_server
from app.infra.stt import build_stt
from app.infra.tts import build_tts

logger = logging.getLogger("interview-agent")


async def entrypoint(ctx: JobContext) -> None:
    metadata = json.loads(ctx.job.metadata) if ctx.job.metadata else {}
    backend = BackendClient(settings.backend_url)

    if metadata.get("interview_id"):
        plan, config = await prepare_session(
            metadata, backend.fetch_interview_context
        )
        mcp_servers = [build_mcp_server(settings.mcp_sse_url)]
    else:
        # No dispatch metadata (e.g. `python -m app.main console`): run a bundled
        # mock plan with MCP disabled so the worker starts fully standalone. The
        # session language comes from settings (LANGUAGE=vi runs a Vietnamese
        # console interview); the real path gets it from dispatch metadata.
        console_meta = {
            **metadata,
            "config": {"language": settings.language, **(metadata.get("config") or {})},
        }
        plan, config = load_mock_session(
            settings.mock_plan_path or None, metadata=console_meta
        )
        mcp_servers = []
        logger.warning(
            "no dispatch metadata; dev/console mode — mock plan, MCP disabled "
            "(interview %s)",
            config.interview_id,
        )
    logger.info("prepared session for interview %s", config.interview_id)

    agent = build_interviewer_agent(plan, config, mcp_servers=mcp_servers)

    session = AgentSession(
        stt=build_stt(settings, config.language),
        llm=build_llm(settings),
        tts=build_tts(settings, config.language),
        vad=silero.VAD.load(),
        turn_handling=_build_turn_handling(config),
        mcp_servers=mcp_servers,
    )

    transcript = TranscriptLog()
    clock = _build_clock(config)

    # Stop pacing the moment the session closes (e.g. participant disconnect);
    # otherwise generate_reply raises "AgentSession isn't running".
    closed = asyncio.Event()

    @session.on("close")
    def _on_close(_ev) -> None:  # noqa: ANN001 (livekit event type)
        closed.set()

    _wire_transcript(session, backend, config.interview_id, transcript, clock)

    await ctx.connect()
    await session.start(agent=agent, room=ctx.room)

    # Shared flag: set while a proctoring reminder (say + resume reply) is
    # in progress so the pacing loop skips its own generate_reply and the two
    # producers never race on the session's speech pipeline.
    reminding = asyncio.Event()

    _wire_proctoring(
        session, ctx, closed, reminding, backend, config.interview_id, config.language
    )
    _wire_end_control(ctx, closed)

    # Intro spoken verbatim (no LLM, no token cap). Language matches the
    # session: "vi" → Vietnamese variants, anything else → English variants.
    _intro_lang = "vi" if str(config.language or "").lower().startswith("vi") else "en"
    await session.say(random.choice(_INTRO_DATA[_intro_lang]))
    # After the intro the LLM knows the candidate's name and role from
    # interview_brief in the system prompt; it addresses them directly and
    # asks the first question. tool_choice="none" avoids the MCP-loop delay.
    await session.generate_reply(
        instructions="You just introduced yourself. "
        "If the candidate has already said something (e.g. 'Hi', 'Hello', 'Ready'), "
        "acknowledge it warmly with one short phrase before continuing. "
        "Then address the candidate by name from your context, briefly acknowledge "
        "the role they are applying for, and ask your very first interview question "
        "— one concise question — then stop and wait for their answer. "
        "Do NOT repeat the introduction.",
        tool_choice="none",
    )

    clock.start()
    await _run_pacing(session, clock, closed, reminding)


def _build_turn_handling(config: SessionConfig) -> TurnHandlingOptions:
    """Build turn-taking knobs from per-session config.

    The LiveKit multilingual turn detector currently reports Vietnamese as
    unsupported at runtime. For Vietnamese sessions, use VAD endpointing and a
    slightly longer silence window so the agent does not answer a partial STT
    transcript. Also disable preemptive generation; with Vietnamese STT errors,
    preemptive LLM turns caused the agent to start repeating the previous
    question and then get interrupted as the real answer arrived.
    """
    lang = str(config.language or "en").lower()
    silence_sec = max(0.3, config.silence_threshold_ms / 1000.0)
    opts: TurnHandlingOptions = TurnHandlingOptions(
        endpointing={"min_delay": silence_sec, "max_delay": max(3.0, silence_sec + 1.5)},
        interruption={
            "enabled": bool(config.barge_in),
            "mode": "vad",
            "min_duration": 0.8,
            "resume_false_interruption": False,
        },
        preemptive_generation={"enabled": False},
    )

    if config.endpointing_mode == "vad" or lang.startswith("vi"):
        opts["turn_detection"] = "vad"
        return opts

    try:
        opts["turn_detection"] = MultilingualModel()
    except Exception as exc:
        logger.warning(
            "turn-detector model unavailable (%s); using VAD endpointing", exc
        )
        opts["turn_detection"] = "vad"
    return opts


def _build_clock(config: SessionConfig) -> PacingClock:
    return PacingClock(
        duration_minutes=config.duration_minutes,
        grace_minutes=config.grace_minutes,
        dead_air_prompt_sec=config.dead_air_prompt_sec,
        max_silence_end_min=config.max_silence_end_min,
        wrap_soon_minutes=config.wrap_soon_minutes,
        now=time.monotonic,
    )


def _wire_transcript(
    session: AgentSession,
    backend: BackendClient,
    interview_id: str,
    transcript: TranscriptLog,
    clock: PacingClock,
) -> None:
    """Record each finalized turn and flush it incrementally to the backend."""
    flush_lock = asyncio.Lock()

    @session.on("conversation_item_added")
    def _on_item(ev) -> None:  # noqa: ANN001 (livekit event type)
        # The event also fires for non-message items (e.g. AgentHandoff), which
        # have no role/text — skip anything that isn't a chat message turn.
        item_role = getattr(ev.item, "role", None)
        if item_role not in ("user", "assistant"):
            return
        role = "candidate" if item_role == "user" else "agent"
        content = getattr(ev.item, "text_content", None) or ""
        if role == "candidate":
            clock.note_activity()
        transcript.append(role, content, ts=time.time())
        asyncio.create_task(
            _flush(backend, interview_id, transcript, flush_lock)
        )


# Pre-written reminder lines live in data/sample-reminder.json so they can be
# edited/localized without touching code. Each is spoken VERBATIM via
# session.say() (TTS only, no LLM round-trip) so the warning lands the instant
# the agent barges in — generating the line through the LLM left a long,
# unnatural silence after the interrupt.
_REMINDER_DATA_PATH = (
    Path(__file__).resolve().parent / "data" / "sample-reminder.json"
)
with _REMINDER_DATA_PATH.open(encoding="utf-8") as _fh:
    _REMINDER_DATA = json.load(_fh)

_INTRO_DATA_PATH = (
    Path(__file__).resolve().parent / "data" / "sample-intro.json"
)
with _INTRO_DATA_PATH.open(encoding="utf-8") as _fh:
    _INTRO_DATA = json.load(_fh)

# Minimum seconds between two spoken proctoring reminders, so the agent does
# not talk over itself. Short enough that while a violation PERSISTS (the browser
# re-reports it every ~15-20s) the agent keeps nudging until it stops.
_PROCTOR_REMINDER_COOLDOWN = float(settings.proctoring_cooldown_seconds)
# After this many high-severity warnings for the same behaviour, the agent gives
# a final notice and leaves the meeting (ends the interview).
_PROCTOR_END_AFTER = int(settings.proctoring_max_violations)
# Whether to allow candidate to interrupt the proctoring reminder.
_PROCTOR_ALLOW_INTERRUPTIONS = settings.proctoring_allow_interruptions
_PROCTOR_MIC_ACK_TIMEOUT = 0.4


def _proctor_line(kind: str, count: int, language: str) -> tuple[str | None, bool]:
    """Pick the verbatim reminder line for ``kind`` at occurrence ``count``.

    Returns ``(line, ending)`` where ``ending`` is True once the count reaches
    ``_PROCTOR_END_AFTER`` (final notice before leaving). ``line`` is None for an
    unknown kind, which the caller ignores.
    """
    lang = "vi" if str(language or "").lower().startswith("vi") else "en"
    interjections = _REMINDER_DATA.get("interjections", {}).get(lang)

    if count >= _PROCTOR_END_AFTER:
        line = _REMINDER_DATA["final_notice"][lang].get(kind)
        if line and interjections:
            line = f"{random.choice(interjections)} {line}"
        return line, True

    levels = _REMINDER_DATA["reminders"][lang].get(kind)
    if not levels:
        return None, False
    line = levels[min(count, len(levels)) - 1]
    # Lead with a varied attention-grabbing interjection so the barge-in sounds
    # natural and human, not like a canned alarm firing the same words each time.
    if interjections:
        line = f"{random.choice(interjections)} {line}"
    return line, False


def _wire_end_control(ctx: JobContext, closed: asyncio.Event) -> None:
    """Leave the meeting when the backend broadcasts ``control:end``.

    The agent ends the interview by calling the ``end_interview`` MCP tool, which
    hits the backend ``/end`` endpoint; the backend then broadcasts ``control:end``
    to the room. Setting ``closed`` stops the pacing loop, the entrypoint returns,
    and the worker disconnects — i.e. the agent leaves the meeting.
    """

    @ctx.room.on("data_received")
    def _on_control(packet) -> None:  # noqa: ANN001 (livekit DataPacket)
        try:
            msg = json.loads(bytes(packet.data).decode())
        except Exception:  # noqa: BLE001 - ignore non-JSON / unrelated packets
            return
        if msg.get("type") == "control:end":
            logger.info("control:end received — leaving the meeting")
            closed.set()


def _wire_proctoring(
    session: AgentSession,
    ctx: JobContext,
    closed: asyncio.Event,
    reminding: asyncio.Event,
    backend: BackendClient,
    interview_id: str,
    language: str,
) -> None:
    """React to anti-cheat signals the candidate's browser broadcasts.

    The backend forwards each proctoring violation into the room as a
    ``{"type": "proctor:violation", ...}`` message. The browser RE-REPORTS a
    violation that persists, so on each high-severity signal the agent speaks a
    short, pre-written reminder, escalating as it recurs. After
    ``_PROCTOR_END_AFTER`` warnings for the same behaviour it gives a final
    notice and ENDS the interview (leaves the meeting). It naturally stops once
    the candidate corrects the behaviour (the events stop arriving).

    Proctoring warnings must not be interrupted by the candidate, but playing
    them over an active microphone can create loud full-duplex artifacts. The
    agent asks the browser to mute the candidate mic, clears the in-flight user
    turn, waits for any current agent audio to finish interrupting, and only
    then plays the warning. It does not schedule a follow-up ``generate_reply``;
    the candidate's next answer drives the normal reply flow.
    """
    last_reminder = 0.0
    total_violations: int = 0  # Count ALL violations together, regardless of type
    mic_ack_waiters: dict[str, asyncio.Future[bool]] = {}
    # Single-flight guard: never run two reminders at once, and keep a strong ref
    # so the task isn't GC'd. Stacking speech calls can hang the session.
    reminder_task: asyncio.Task | None = None

    async def _publish_mic_control(action: str, lock_id: str) -> None:
        payload = json.dumps(
            {
                "type": "control:mic",
                "action": action,
                "reason": "proctoring_warning",
                "lock_id": lock_id,
            }
        )
        await ctx.room.local_participant.publish_data(
            payload,
            reliable=True,
            destination_identities=[f"candidate-{interview_id}"],
        )

    async def _mute_candidate(lock_id: str) -> None:
        fut = asyncio.get_running_loop().create_future()
        mic_ack_waiters[lock_id] = fut
        try:
            await _publish_mic_control("mute", lock_id)
            try:
                await asyncio.wait_for(fut, timeout=_PROCTOR_MIC_ACK_TIMEOUT)
                logger.info("proctoring mic muted: %s", lock_id)
            except asyncio.TimeoutError:
                logger.info("proctoring mic mute ack timed out: %s", lock_id)
        except Exception as exc:  # noqa: BLE001 - warning must still land
            logger.info("proctoring mic mute skipped: %s", str(exc)[:120])
        finally:
            mic_ack_waiters.pop(lock_id, None)

    async def _restore_candidate_mic(lock_id: str) -> None:
        try:
            await _publish_mic_control("restore", lock_id)
        except Exception as exc:  # noqa: BLE001 - best-effort
            logger.info("proctoring mic restore skipped: %s", str(exc)[:120])

    def _clear_user_audio_turn() -> None:
        try:
            session.clear_user_turn()
        except Exception as exc:  # noqa: BLE001 - no in-flight turn is fine
            logger.info("proctoring clear user turn skipped: %s", str(exc)[:120])

    @ctx.room.on("data_received")
    def _on_data(packet) -> None:  # noqa: ANN001 (livekit DataPacket)
        nonlocal last_reminder, reminder_task, total_violations
        try:
            msg = json.loads(bytes(packet.data).decode())
        except Exception:  # noqa: BLE001 - ignore non-JSON / unrelated packets
            return
        if msg.get("type") == "control:mic_ack":
            lock_id = str(msg.get("lock_id") or "")
            fut = mic_ack_waiters.get(lock_id)
            if fut is not None and not fut.done():
                fut.set_result(bool(msg.get("ok", False)))
            return
        if msg.get("type") != "proctor:violation":
            return

        kind = msg.get("kind")
        logger.info("proctoring violation: %s (%s)", kind, msg.get("severity"))
        if msg.get("severity") != "high":
            return

        now = time.monotonic()
        if closed.is_set() or now - last_reminder < _PROCTOR_REMINDER_COOLDOWN:
            return
        # A reminder is still being spoken — don't stack another speech call.
        if reminder_task is not None and not reminder_task.done():
            return

        # Count ANY violation toward the total - don't distinguish between types
        total_violations += 1
        count = total_violations
        line, ending = _proctor_line(kind, count, language)
        if not line:
            return  # unknown kind — nothing to say
        last_reminder = now

        async def _act() -> None:
            # Block pacing while the warning itself is queued so it does not
            # race the speech pipeline. Do not generate a resume turn here;
            # the candidate's next answer should drive the next normal reply.
            lock_id = f"proctor-{time.time_ns()}"
            reminding.set()
            try:
                await _mute_candidate(lock_id)
                _clear_user_audio_turn()
                try:
                    await session.interrupt(force=True)
                except Exception:  # noqa: BLE001 - nothing to interrupt is fine
                    pass
                logger.info(
                    "proctoring reminder speaking: %s allow_interruptions=%s",
                    lock_id,
                    _PROCTOR_ALLOW_INTERRUPTIONS,
                )
                handle = session.say(
                    line, allow_interruptions=_PROCTOR_ALLOW_INTERRUPTIONS
                )
                await handle.wait_for_playout()
                _clear_user_audio_turn()

            except Exception as exc:  # noqa: BLE001 - best-effort
                logger.info("proctoring reminder skipped: %s", str(exc)[:120])
            finally:
                await _restore_candidate_mic(lock_id)
                reminding.clear()

            if ending:
                # Mark the interview ended, then close the session so the agent
                # actually leaves the meeting (closed → pacing loop exits →
                # entrypoint returns → worker disconnects).
                logger.warning(
                    "ending interview %s after %d proctoring violations (%s)",
                    interview_id, count, kind,
                )
                try:
                    await backend.end_interview(interview_id)
                except Exception:  # noqa: BLE001 - leave regardless
                    logger.exception("backend end_interview failed")
                closed.set()

        reminder_task = asyncio.create_task(_act())


async def _flush(
    backend: BackendClient,
    interview_id: str,
    transcript: TranscriptLog,
    flush_lock: asyncio.Lock,
) -> None:
    async with flush_lock:
        pending = transcript.pending()
        flushed = 0
        for turn in pending:
            ok = await backend.append_transcript_turn(
                interview_id, turn.role, turn.content, turn.ts
            )
            if not ok:
                break
            flushed += 1
        transcript.mark_flushed(flushed)


async def _run_pacing(
    session: AgentSession,
    clock: PacingClock,
    closed: asyncio.Event,
    reminding: asyncio.Event,
) -> None:
    """Tick the clock; pump pacing instructions; end on a terminal signal.

    Stops promptly when the session closes (participant disconnect) so we never
    call generate_reply on a dead session.  Skips pacing nudges while a
    proctoring reminder is in progress to avoid racing on the speech pipeline.
    """
    last = None
    while not closed.is_set():
        try:
            # Wake every second, but exit immediately if the session closes.
            await asyncio.wait_for(closed.wait(), timeout=1.0)
            break
        except asyncio.TimeoutError:
            pass
        signal = clock.signal()
        if signal == last:
            continue
        last = signal
        instruction = signal_instruction(signal)
        if instruction:
            # Skip this nudge if a proctoring reminder + resume is in flight;
            # the reminder's own generate_reply already re-establishes the turn.
            if reminding.is_set():
                continue
            # tool_choice="none": pacing nudges are system-driven, never need
            # MCP tools; offering them makes the LLM loop to max steps.
            try:
                await session.generate_reply(
                    instructions=instruction, tool_choice="none"
                )
            except RuntimeError:
                logger.info("session no longer running; stopping pacing")
                break
        if is_terminal(signal):
            logger.info("terminal pacing signal %s — ending session", signal)
            break


def _bridge_livekit_env() -> None:
    """Expose LiveKit credentials to the LiveKit CLI.

    ``config.Settings`` loads the repo-root ``.env`` into our settings object,
    but the LiveKit CLI reads ``LIVEKIT_*`` straight from ``os.environ`` and does
    not load that file. Bridge the values across so a single ``.env`` stays the
    source of truth. ``console`` mode runs fully local (mic/speakers) and never
    dials the server, so fall back to dev placeholders to keep it zero-config.
    """
    os.environ.setdefault(
        "LIVEKIT_URL", settings.livekit_url or "ws://localhost:7880"
    )
    os.environ.setdefault(
        "LIVEKIT_API_KEY", settings.livekit_api_key or "devkey"
    )
    os.environ.setdefault(
        "LIVEKIT_API_SECRET", settings.livekit_api_secret or "devsecret"
    )


def _start_health_server() -> None:
    """Minimal HTTP server on PORT (default 8080) for AgentBase liveness probe.

    AgentBase Runtime requires GET /health → 200 on port 8080 before marking
    the runtime ACTIVE. The LiveKit worker doesn't expose HTTP, so we spin up
    a tiny server in a daemon thread that stays alive for the worker's lifetime.
    """
    import http.server
    import threading

    port = int(os.environ.get("PORT", 8080))

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/health":
                body = b'{"status":"ok","service":"interview-agent"}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, *_) -> None:  # suppress per-request stdout noise
            pass

    server = http.server.HTTPServer(("0.0.0.0", port), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    logger.info("health server listening on :%d", port)


if __name__ == "__main__":
    _bridge_livekit_env()
    _start_health_server()
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint, agent_name=settings.agent_name)
    )
