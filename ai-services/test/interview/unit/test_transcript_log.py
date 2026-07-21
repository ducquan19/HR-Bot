"""Behavior tests for TranscriptLog.

In-domain transcript buffer. Records turns in order, validates roles, and
supports incremental flushing (so the worker can stream turns to the backend
and stay idempotent across retries / crashes).
"""

import pytest

from app.agents.interview.domain.transcript_log import TranscriptLog


def test_append_and_read_turns_in_order():
    log = TranscriptLog()
    log.append("agent", "Welcome, shall we begin?", ts=1.0)
    log.append("candidate", "Yes, ready.", ts=2.0)

    turns = log.turns()

    assert [(t.role, t.content) for t in turns] == [
        ("agent", "Welcome, shall we begin?"),
        ("candidate", "Yes, ready."),
    ]


def test_rejects_unknown_role():
    log = TranscriptLog()

    with pytest.raises(ValueError):
        log.append("system", "nope", ts=1.0)


def test_incremental_flush_tracks_pending():
    log = TranscriptLog()
    log.append("agent", "q1", ts=1.0)
    log.append("candidate", "a1", ts=2.0)
    log.append("agent", "q2", ts=3.0)

    # Three unflushed turns.
    assert [t.content for t in log.pending()] == ["q1", "a1", "q2"]

    log.mark_flushed(2)         # backend accepted the first two
    assert [t.content for t in log.pending()] == ["q2"]

    log.append("candidate", "a2", ts=4.0)
    assert [t.content for t in log.pending()] == ["q2", "a2"]
