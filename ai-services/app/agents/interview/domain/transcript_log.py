"""In-domain transcript buffer.

Records interview turns in order and supports incremental flushing so the
worker can stream turns to the backend (via the append_transcript_turn MCP
tool) and recover idempotently from retries or crashes.
"""

from dataclasses import dataclass

_VALID_ROLES = {"agent", "candidate"}


@dataclass(frozen=True)
class Turn:
    role: str
    content: str
    ts: float


class TranscriptLog:
    def __init__(self) -> None:
        self._turns: list[Turn] = []
        self._flushed = 0

    def append(self, role: str, content: str, ts: float) -> Turn:
        if role not in _VALID_ROLES:
            raise ValueError(
                f"role must be one of {sorted(_VALID_ROLES)}, got {role!r}"
            )
        turn = Turn(role=role, content=content, ts=ts)
        self._turns.append(turn)
        return turn

    def turns(self) -> list[Turn]:
        return list(self._turns)

    def pending(self) -> list[Turn]:
        """Turns appended but not yet confirmed flushed to the backend."""
        return self._turns[self._flushed:]

    def mark_flushed(self, count: int) -> None:
        """Mark the next ``count`` pending turns as successfully flushed."""
        self._flushed = min(self._flushed + count, len(self._turns))
