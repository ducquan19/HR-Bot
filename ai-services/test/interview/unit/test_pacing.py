"""Behavior tests for PacingClock.

Principle (design doc 6.3): *code owns the clock, not the LLM.* Time is
injected so tests run instantly and deterministically — no real sleeping. The
clock emits a single most-urgent pacing signal each tick; the worker pumps that
signal into the agent.
"""

from app.agents.interview.domain.pacing import (
    PacingClock,
    PacingSignal,
    is_terminal,
    signal_instruction,
)


class FakeClock:
    """Controllable monotonic clock in seconds."""

    def __init__(self) -> None:
        self.t = 0.0

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


def _clock(**kwargs) -> tuple[PacingClock, FakeClock]:
    fake = FakeClock()
    defaults = dict(
        duration_minutes=15,
        grace_minutes=3,
        dead_air_prompt_sec=20,
        max_silence_end_min=3,
        now=fake,
    )
    defaults.update(kwargs)
    return PacingClock(**defaults), fake


def test_elapsed_tracks_time_since_start():
    clock, fake = _clock()
    clock.start()

    fake.advance(90)

    assert clock.elapsed() == 90


def test_milestone_signals_by_elapsed():
    # 15 min target, 3 min grace -> T-3 = 12:00, target = 15:00, hard cap = 18:00.
    clock, fake = _clock()
    clock.start()

    # Candidate is actively talking, so silence never triggers.
    def signal_at(minute: float) -> PacingSignal:
        fake.t = minute * 60
        clock.note_activity()
        return clock.signal()

    assert signal_at(5) is PacingSignal.ON_TRACK
    assert signal_at(12) is PacingSignal.WRAP_SOON
    assert signal_at(15) is PacingSignal.WRAP_UP_NOW
    assert signal_at(17) is PacingSignal.WRAP_UP_NOW
    assert signal_at(18) is PacingSignal.FORCE_END


def test_zero_grace_forces_end_at_target():
    clock, fake = _clock(grace_minutes=0)
    clock.start()

    fake.t = 15 * 60
    clock.note_activity()

    assert clock.signal() is PacingSignal.FORCE_END


def test_pause_freezes_elapsed_during_reconnect():
    clock, fake = _clock()
    clock.start()

    fake.advance(60)
    clock.pause()       # candidate dropped
    fake.advance(120)   # time passes while away — must not count
    clock.resume()
    fake.advance(30)

    assert clock.elapsed() == 90


def test_dead_air_after_silence_threshold():
    clock, fake = _clock()
    clock.start()
    fake.advance(100)
    clock.note_activity()       # candidate last spoke here

    fake.advance(25)            # 25s silence: >= 20s dead-air, < 3min abandon

    assert clock.signal() is PacingSignal.DEAD_AIR


def test_abandon_after_absolute_silence():
    clock, fake = _clock()
    clock.start()
    clock.note_activity()

    fake.advance(3 * 60)        # 3 min of total silence

    assert clock.signal() is PacingSignal.ABANDON


def test_on_track_has_no_instruction():
    assert signal_instruction(PacingSignal.ON_TRACK) is None


def test_pacing_signals_map_to_agent_instructions():
    assert "wrap" in signal_instruction(PacingSignal.WRAP_SOON).lower()
    assert "wrap up" in signal_instruction(PacingSignal.WRAP_UP_NOW).lower()
    assert signal_instruction(PacingSignal.DEAD_AIR)   # re-engage prompt
    assert signal_instruction(PacingSignal.FORCE_END)  # closing prompt


def test_terminal_signals():
    assert is_terminal(PacingSignal.FORCE_END) is True
    assert is_terminal(PacingSignal.ABANDON) is True
    assert is_terminal(PacingSignal.WRAP_UP_NOW) is False
    assert is_terminal(PacingSignal.ON_TRACK) is False
