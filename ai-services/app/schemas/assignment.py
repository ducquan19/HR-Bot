from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.plan import TestCase


class AssignmentType(str, Enum):
    """Drives which UI the frontend renders for the candidate."""

    coding = "coding"        # Monaco code editor + run/test panel
    cognitive = "cognitive"  # ABCD multiple-choice quiz


class CodingMode(str, Enum):
    """Two flavours of a coding challenge with opposite AI-assist policy."""

    dsa = "dsa"          # algorithmic problem — AI coding assistant DISABLED
    project = "project"  # applied build task  — AI coding assistant ALLOWED


class MCQQuestion(BaseModel):
    prompt: str
    # Exactly four options, rendered as A/B/C/D in order.
    options: list[str] = Field(min_length=4, max_length=4)
    answer: str = Field(description="Correct option letter: 'A', 'B', 'C', or 'D'")
    explanation: str | None = None


class CodingChallenge(BaseModel):
    mode: CodingMode
    title: str
    difficulty: str = Field(default="medium")
    statement: str
    function_name: str = Field(default="solution")
    starter_code: str = Field(default="def solution():\n    pass\n")
    # PROJECT mode: multi-file starter for the browser sandbox (Sandpack).
    # Keys are filenames (e.g. "App.js", "styles.css"); values are file contents.
    # DSA mode: leave empty — starter_code is used instead.
    starter_files: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Multi-file starter code for project mode. "
            "Minimum: {'App.js': '...', 'styles.css': '...'}. "
            "Empty for DSA mode."
        ),
    )
    # DSA: graded against these verbatim. project: acceptance checks (may be empty).
    test_cases: list[TestCase] = Field(default_factory=list)
    # Derived from mode: dsa -> False, project -> True. The runtime flips the
    # in-machine coding assistant to match (see app/mcp/assignment_tools.py).
    ai_assistant_enabled: bool = Field(
        description="Whether the candidate may use the AI coding assistant"
    )
    allowed_resources: list[str] = Field(default_factory=list)


class CognitiveTest(BaseModel):
    topic: str
    # Always 10 ABCD questions for a non-tech candidate.
    questions: list[MCQQuestion] = Field(min_length=10, max_length=10)


class Assignment(BaseModel):
    """Structured output of the Assignment Agent."""

    type: AssignmentType
    summary: str
    coding: CodingChallenge | None = None
    cognitive: CognitiveTest | None = None
    source: str = Field(
        default="assignment-agent",
        description="Origin of the assignment: 'assignment-agent' or 'mock'",
    )


class AssignmentRequest(BaseModel):
    """Payload the backend sends to the Assignment Agent."""

    interview_id: str
    position: str | None = None
    jd_text: str = ""
    cv_markdown: str = ""
    level: str | None = Field(
        default=None, description="junior / mid / senior (agent infers if omitted)"
    )
    track: str | None = Field(
        default=None,
        description="'tech' -> coding challenge, 'nontech' -> cognitive test. "
        "Agent decides from JD/CV if omitted.",
    )
    coding_mode: str | None = Field(
        default=None,
        description="'dsa' or 'project' for tech track. Agent decides if omitted.",
    )
    assignment_brief: str = Field(
        default="",
        description="The Planning Agent's assignment_brief. Its first line is an "
        "ASSIGNMENT DIRECTIVE (type/mode/ai_assistant/difficulty) the agent should "
        "honor when choosing the assignment type and AI-assistant setting.",
    )
    special_requirements: str | None = None


class AssignmentRecord(BaseModel):
    """Persistence envelope: the generated assignment plus the candidate's
    answer and grading result, filled in as the session progresses.

    ``interview_answer`` is a code string for a coding challenge, or a list of
    chosen option letters for a cognitive test. ``result`` is a list of test-case
    results (coding) or per-question correctness (cognitive)."""

    id: str = ""
    interview_id: str = ""
    assignments: Assignment
    interview_answer: str | list | None = None
    result: list = Field(default_factory=list)
