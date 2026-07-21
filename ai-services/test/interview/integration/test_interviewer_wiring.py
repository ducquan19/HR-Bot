"""Integration tests for agent wiring (requires livekit-agents installed).

These exercise the seam between our domain prompt and the LiveKit Agent object,
without a live room or audio.
"""

import asyncio
import json

from app.agents.interview.workflow import build_interviewer_agent
from app.agents.interview.agent import _build_turn_handling, _wire_proctoring
from app.agents.interview.domain.plan_models import InterviewPlan
from app.agents.interview.domain.session_config import SessionConfig


class _Packet:
    def __init__(self, payload: dict) -> None:
        self.data = json.dumps(payload).encode()


class _SpeechHandle:
    def __init__(self, calls: list[str]) -> None:
        self._calls = calls

    async def wait_for_playout(self) -> None:
        self._calls.append("wait_for_playout")


class _FakeSession:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def clear_user_turn(self) -> None:
        self.calls.append("clear_user_turn")

    async def interrupt(self, *, force: bool = False) -> None:
        self.calls.append(f"interrupt:{force}")

    def say(self, line: str, *, allow_interruptions: bool) -> _SpeechHandle:
        self.calls.append(f"say:{allow_interruptions}:{line}")
        return _SpeechHandle(self.calls)


class _FakeLocalParticipant:
    def __init__(self, room: "_FakeRoom", calls: list[str], ack_mute: bool) -> None:
        self._room = room
        self._calls = calls
        self._ack_mute = ack_mute

    async def publish_data(
        self,
        payload: str,
        *,
        reliable: bool,
        destination_identities: list[str],
    ) -> None:
        msg = json.loads(payload)
        self._calls.append(
            f"publish:{msg['action']}:{reliable}:{','.join(destination_identities)}"
        )
        if msg["action"] == "mute" and self._ack_mute:
            self._room.handlers["data_received"](
                _Packet(
                    {
                        "type": "control:mic_ack",
                        "action": "mute",
                        "lock_id": msg["lock_id"],
                        "ok": True,
                    }
                )
            )


class _FakeRoom:
    def __init__(self, calls: list[str], *, ack_mute: bool = True) -> None:
        self.handlers = {}
        self.local_participant = _FakeLocalParticipant(self, calls, ack_mute)

    def on(self, event: str):
        def _decorator(fn):
            self.handlers[event] = fn
            return fn

        return _decorator


class _FakeContext:
    def __init__(self, room: _FakeRoom) -> None:
        self.room = room


class _FakeBackend:
    async def end_interview(self, _interview_id: str) -> None:
        raise AssertionError("first proctoring reminder should not end interview")


async def _wait_for_call(calls: list[str], prefix: str) -> None:
    async def _poll() -> None:
        while not any(call.startswith(prefix) for call in calls):
            await asyncio.sleep(0.001)

    await asyncio.wait_for(_poll(), timeout=1.0)


def test_build_interviewer_agent_embeds_plan_in_instructions():
    plan = InterviewPlan(
        interview_brief="Candidate worked on Kafka internals. Ask: Explain ISR.",
        evaluation_brief="Score Kafka depth.",
        assignment_brief="Build a small streaming dashboard.",
    )
    cfg = SessionConfig(interview_id="iv")

    agent = build_interviewer_agent(plan, cfg, mcp_servers=[])

    assert "Kafka internals" in agent.instructions
    assert "Explain ISR." in agent.instructions
    assert "English" in agent.instructions

def test_vietnamese_turn_handling_uses_vad_and_configured_silence():
    cfg = SessionConfig(
        interview_id="iv",
        language="vi",
        silence_threshold_ms=1500,
        barge_in=True,
    )

    opts = _build_turn_handling(cfg)

    assert opts["turn_detection"] == "vad"
    assert opts["endpointing"]["min_delay"] == 1.5
    assert opts["interruption"]["enabled"] is True
    assert opts["preemptive_generation"]["enabled"] is False


async def test_proctoring_warning_mutes_mic_before_speaking():
    session = _FakeSession()
    room = _FakeRoom(session.calls)
    ctx = _FakeContext(room)
    closed = asyncio.Event()
    reminding = asyncio.Event()

    _wire_proctoring(
        session, ctx, closed, reminding, _FakeBackend(), "iv-1", "vi"
    )

    room.handlers["data_received"](
        _Packet({"type": "proctor:violation", "kind": "phone_detected", "severity": "high"})
    )
    await _wait_for_call(session.calls, "publish:restore")

    assert session.calls[0] == "publish:mute:True:candidate-iv-1"
    assert session.calls[1] == "clear_user_turn"
    assert session.calls[2] == "interrupt:True"
    assert session.calls[3].startswith("say:False:")
    assert session.calls[4] == "wait_for_playout"
    assert session.calls[5] == "clear_user_turn"
    assert session.calls[6] == "publish:restore:True:candidate-iv-1"


async def test_proctoring_warning_continues_when_mic_ack_times_out(monkeypatch):
    import app.agents.interview.agent as agent_module

    monkeypatch.setattr(agent_module, "_PROCTOR_MIC_ACK_TIMEOUT", 0.001)
    session = _FakeSession()
    room = _FakeRoom(session.calls, ack_mute=False)
    ctx = _FakeContext(room)

    _wire_proctoring(
        session, ctx, asyncio.Event(), asyncio.Event(), _FakeBackend(), "iv-1", "vi"
    )

    room.handlers["data_received"](
        _Packet({"type": "proctor:violation", "kind": "phone_detected", "severity": "high"})
    )
    await _wait_for_call(session.calls, "publish:restore")

    assert any(call.startswith("say:False:") for call in session.calls)
    assert session.calls[-1] == "publish:restore:True:candidate-iv-1"
