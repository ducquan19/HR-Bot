from typing import Literal

from pydantic import BaseModel, Field


class AssistantMessage(BaseModel):
    """One turn in the candidate ↔ assistant conversation."""

    role: Literal["user", "assistant"]
    content: str


class CodeAssistRequest(BaseModel):
    """Payload the backend forwards to the coding-assistant agent."""

    messages: list[AssistantMessage] = Field(
        default_factory=list,
        description="Full chat history so far, oldest first",
    )
    code: str | None = Field(
        default=None,
        description="Candidate's current editor code, attached as context",
    )
    problem_statement: str | None = Field(
        default=None,
        description="The coding assignment statement, for grounding",
    )
    language: str = Field(default="python")


class CodeAssistResponse(BaseModel):
    reply: str = Field(description="Assistant's answer, may contain markdown code blocks")
    prompt: str = Field(default="", description="Full prompt sent to the LLM")
    model: str = Field(default="", description="Model that produced the reply")
    tokens_input: int = Field(default=0)
    tokens_output: int = Field(default=0)
