"""Tests for the interview MCP tools.

We mock the HTTP layer (``_post``) so these run without a live backend, and
assert each tool calls the agreed backend path with the right body.
"""

import pytest

from app.mcp import interview_tools


@pytest.fixture
def captured_post(monkeypatch):
    """Replace interview_tools._post with a capturing async stub."""
    calls: list[tuple[str, dict]] = []

    async def fake_post(path: str, body: dict) -> dict:
        calls.append((path, body))
        return {"ok": True}

    monkeypatch.setattr(interview_tools, "_post", fake_post)
    return calls


async def test_append_transcript_turn_posts_to_backend(captured_post):
    result = await interview_tools.append_transcript_turn(
        "iv-1", "candidate", "My answer", ts=12.5
    )

    assert result == {"ok": True}
    assert captured_post == [
        ("iv-1/transcript/append", {"role": "candidate", "content": "My answer", "ts": 12.5})
    ]


async def test_append_transcript_turn_omits_ts_when_absent(captured_post):
    await interview_tools.append_transcript_turn("iv-1", "agent", "Welcome")

    path, body = captured_post[0]
    assert path == "iv-1/transcript/append"
    assert body == {"role": "agent", "content": "Welcome"}


async def test_append_transcript_turn_rejects_unknown_role(captured_post):
    with pytest.raises(ValueError):
        await interview_tools.append_transcript_turn("iv-1", "system", "nope")

    assert captured_post == []
