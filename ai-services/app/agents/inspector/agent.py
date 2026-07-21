"""Inspector (Judge) Agent — chấm điểm buổi phỏng vấn + sinh report cao cấp.

Luồng (tool-based agentic):
  1. Suy ``track`` (tech/nontech) từ assignment.
  2. Tính integrity DETERMINISTIC từ proctor_events (không để LLM bịa).
  3. Tạo 7 tools qua ``make_inspector_tools(req, integrity)``; agent tự pull
     data (transcript, coding, brief...) qua tools và ghi điểm từng competency
     bằng ``score_competency()``, cuối cùng gọi ``finalize_scorecard()``.
  4. Ghi đè định danh + backfill test từ last_run_result.
  5. Render charts theo track → build PDF + markdown.

ai-services không giữ DB/đĩa → trả PDF base64 trong EvaluationResponse; backend
tự lưu file và bản ghi.
"""

import base64
import logging

from agent_framework import Agent
from agent_framework.openai import OpenAIChatCompletionClient

from app.agents.inspector.domain import report as report_builder
from app.agents.inspector.domain.prompts import build_instructions, build_user_prompt
from app.agents.inspector.domain.tools import make_inspector_tools

from app.config import settings
from app.schemas.evaluation import (
    EvaluationRequest,
    EvaluationResponse,
    IntegritySummary,
    ScoreCard,
    Track,
)

logger = logging.getLogger(__name__)


def _derive_track(req: EvaluationRequest) -> str:
    if req.track in ("tech", "nontech"):
        return req.track
    asg = req.assignment or {}
    if asg.get("type") == "coding":
        return "tech"
    if asg.get("type") == "cognitive":
        return "nontech"
    res = req.assignment_result or {}
    if res.get("type") == "coding" or req.last_run_result:
        return "tech"
    return "tech"


def _summarize_integrity(events: list[dict] | None) -> IntegritySummary:
    """Cuộn proctor_events thành mức rủi ro — thuần deterministic."""
    events = events or []
    counts: dict[str, int] = {}
    high = 0
    for ev in events:
        kind = (ev or {}).get("kind", "unknown")
        counts[kind] = counts.get(kind, 0) + 1
        if (ev or {}).get("severity") == "high":
            high += 1
    total = len(events)
    if total == 0:
        risk, note = "clean", "No anomalies detected during the session."
    elif high >= 2 or total >= 6:
        risk, note = "high", "Multiple signals or high-severity events — review the recording."
    elif high >= 1 or total >= 3:
        risk, note = "medium", "Some notable signals observed."
    else:
        risk, note = "low", "Scattered low-severity signals."
    return IntegritySummary(
        total_violations=total,
        high_severity_count=high,
        counts_by_kind=counts,
        risk=risk,
        note=note,
    )


def _build_agent(tools: list, language: str) -> Agent:
    model = settings.inspector_model or settings.planning_model
    client = OpenAIChatCompletionClient(
        model=model,
        api_key=settings.openai_api_key or None,
        base_url=settings.openai_base_url or None,
    )
    return Agent(
        client, build_instructions(language), name="InspectorAgent", tools=tools
    )


def _backfill(sc: ScoreCard, req: EvaluationRequest, track: str) -> ScoreCard:
    """Ghi đè định danh + bổ sung số test từ last_run_result (nguồn tin cậy hơn LLM)."""
    sc.candidate_name = req.candidate_name or sc.candidate_name
    sc.position = req.position or sc.position
    sc.track = Track.tech if track == "tech" else Track.nontech
    run = req.last_run_result or {}
    if sc.coding_eval and run.get("tests_total") is not None:
        sc.coding_eval.tests_passed = run.get("tests_passed")
        sc.coding_eval.tests_total = run.get("tests_total")
    return sc


async def run_inspector_agent(req: EvaluationRequest) -> EvaluationResponse:
    """Chấm điểm + sinh report. Raise nếu agent không gọi finalize_scorecard()."""
    track = _derive_track(req)
    integrity = _summarize_integrity(req.proctor_events)

    tools, result = make_inspector_tools(req, integrity)
    agent = _build_agent(tools, req.language)

    prompt = build_user_prompt(req, track)
    await agent.run(
        prompt,
        options={
            "temperature": settings.inspector_temperature,
            "max_tokens": settings.inspector_max_tokens,
        },
    )

    sc: ScoreCard | None = result.get("scorecard")
    if sc is None:
        raise ValueError(
            "Inspector Agent did not call finalize_scorecard(). "
            "Check that the LLM supports tool/function calling."
        )

    sc = _backfill(sc, req, track)

    # Agent should have called generate_report(); fallback if it skipped the step.
    pdf_bytes: bytes = result.get("pdf_bytes") or report_builder.build_pdf(
        sc, integrity, req.language
    )
    markdown: str = result.get("markdown") or report_builder.build_markdown(
        sc, integrity, req.language
    )

    report_dict = sc.model_dump(mode="json")
    report_dict["integrity"] = integrity.model_dump(mode="json")
    report_dict["is_mock"] = False

    logger.info(
        "inspector: scored %s (%s) overall=%.1f rec=%s — PDF %d bytes",
        sc.candidate_name,
        track,
        sc.overall_score,
        sc.recommendation.value,
        len(pdf_bytes),
    )

    return EvaluationResponse(
        interview_id=req.interview_id,
        report=report_dict,
        report_markdown=markdown,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        source="inspector-agent",
    )
