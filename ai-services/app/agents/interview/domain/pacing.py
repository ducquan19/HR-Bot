"""Pacing clock for the interview.

Design doc 6.3: *code owns the clock, not the LLM.* This class tracks real
elapsed time (with pause/resume for reconnects), and emits a single most-urgent
pacing signal each tick. Time is injected via ``now`` so it is fully testable
without sleeping.
"""

from collections.abc import Callable
from enum import Enum


class PacingSignal(Enum):
    ON_TRACK = "on_track"
    WRAP_SOON = "wrap_soon"          # T-3: start steering toward the end
    WRAP_UP_NOW = "wrap_up_now"      # target reached / grace zone: cover high-weight, close
    FORCE_END = "force_end"          # hard cap: close immediately, non-negotiable
    DEAD_AIR = "dead_air"            # candidate silent after a question: re-prompt
    ABANDON = "abandon"              # absolute silence too long: end as abandoned


_INSTRUCTIONS: dict[PacingSignal, str] = {
    PacingSignal.WRAP_SOON: (
        "Time check: begin to wrap toward the end. Only ask a follow-up if it "
        "would surface high-value information."
    ),
    PacingSignal.WRAP_UP_NOW: (
        "Time is up. Wrap up now: cover any high-weight competency you have not "
        "yet asked about, then move to closing."
    ),
    PacingSignal.DEAD_AIR: (
        "The candidate has gone quiet. Gently re-engage: rephrase or simplify "
        "your last question, or offer a prompt to help them start."
    ),
    PacingSignal.FORCE_END: (
        "Hard time limit reached. Give a brief, warm closing (about 30 seconds), "
        "thank the candidate, and end the interview now."
    ),
    PacingSignal.ABANDON: (
        "The candidate has been silent too long. Close the session and mark it "
        "abandoned."
    ),
}

_TERMINAL = {PacingSignal.FORCE_END, PacingSignal.ABANDON}


def signal_instruction(signal: PacingSignal) -> str | None:
    """Map a pacing signal to the instruction injected into the agent.

    Returns None when no action is needed (ON_TRACK).
    """
    return _INSTRUCTIONS.get(signal)


def is_terminal(signal: PacingSignal) -> bool:
    """Whether this signal means the session must end."""
    return signal in _TERMINAL


class PacingClock:
    def __init__(
        self,
        duration_minutes: int,
        grace_minutes: int,
        dead_air_prompt_sec: int,
        max_silence_end_min: int,
        wrap_soon_minutes: int,
        now: Callable[[], float],
    ) -> None:
        self._duration_sec = duration_minutes * 60
        self._grace_sec = grace_minutes * 60
        self._dead_air_sec = dead_air_prompt_sec
        self._max_silence_sec = max_silence_end_min * 60
        self._wrap_soon_sec = wrap_soon_minutes * 60
        self._now = now
        self._start: float | None = None
        self._last_activity: float | None = None
        self._paused_total = 0.0
        self._paused_at: float | None = None

    def _clock_now(self) -> float:
        """Active wall-clock time, excluding any paused (reconnect) intervals."""
        raw = self._now()
        paused = self._paused_total
        if self._paused_at is not None:
            paused += raw - self._paused_at
        return raw - paused

    def start(self) -> None:
        self._start = self._clock_now()
        self._last_activity = self._start

    def note_activity(self) -> None:
        """Record that the candidate spoke / produced audio (resets silence)."""
        self._last_activity = self._clock_now()

    def pause(self) -> None:
        """Stop the clock while the candidate is away (mic drop / reconnect)."""
        if self._paused_at is None:
            self._paused_at = self._now()

    def resume(self) -> None:
        if self._paused_at is not None:
            self._paused_total += self._now() - self._paused_at
            self._paused_at = None

    def elapsed(self) -> float:
        if self._start is None:
            return 0.0
        return self._clock_now() - self._start

    def _silence(self) -> float:
        if self._last_activity is None:
            return 0.0
        return self._clock_now() - self._last_activity

    def signal(self) -> PacingSignal:
        elapsed = self.elapsed()
        hard_cap = self._duration_sec + self._grace_sec

        # Hard cap is non-negotiable and outranks everything.
        if elapsed >= hard_cap:
            return PacingSignal.FORCE_END

        silence = self._silence()
        if silence >= self._max_silence_sec:
            return PacingSignal.ABANDON
        if silence >= self._dead_air_sec:
            return PacingSignal.DEAD_AIR

        if elapsed >= self._duration_sec:
            return PacingSignal.WRAP_UP_NOW
        if elapsed >= self._duration_sec - self._wrap_soon_sec:
            return PacingSignal.WRAP_SOON
        return PacingSignal.ON_TRACK
