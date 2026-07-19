import json
from pathlib import Path

import pytest

from app.mcp import assignment_tools
from app.schemas.assignment import (
    Assignment,
    AssignmentType,
    CodingMode,
)

_MOCK_DIR = Path(__file__).resolve().parents[2] / "mock"


@pytest.mark.parametrize(
    "filename,expected_type,expected_mode",
    [
        ("assignment_dsa.json", AssignmentType.coding, CodingMode.dsa),
        ("assignment_project.json", AssignmentType.coding, CodingMode.project),
        ("assignment_cognitive.json", AssignmentType.cognitive, None),
    ],
)
def test_mock_fixtures_validate(filename, expected_type, expected_mode):
    data = json.loads((_MOCK_DIR / filename).read_text())
    a = Assignment.model_validate(data)

    assert a.type == expected_type
    if expected_type == AssignmentType.coding:
        assert a.coding is not None and a.cognitive is None
        assert a.coding.mode == expected_mode
        # DSA disables the assistant; project enables it.
        assert a.coding.ai_assistant_enabled == (expected_mode == CodingMode.project)
    else:
        assert a.cognitive is not None and a.coding is None
        assert len(a.cognitive.questions) == 10
        assert all(len(q.options) == 4 for q in a.cognitive.questions)


@pytest.fixture
def captured_toggle(monkeypatch):
    calls: list[tuple[str, bool]] = []

    async def fake_toggle(interview_id: str, enabled: bool) -> dict:
        calls.append((interview_id, enabled))
        return {"interview_id": interview_id, "enabled": enabled}

    monkeypatch.setattr(assignment_tools, "_toggle", fake_toggle)
    return calls


async def test_enable_coding_assistant_toggles_true(captured_toggle):
    await assignment_tools.enable_coding_assistant("iv-1")
    assert captured_toggle == [("iv-1", True)]


async def test_disable_coding_assistant_toggles_false(captured_toggle):
    await assignment_tools.disable_coding_assistant("iv-1")
    assert captured_toggle == [("iv-1", False)]
