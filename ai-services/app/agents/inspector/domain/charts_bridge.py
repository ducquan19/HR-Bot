"""Chọn & render bộ biểu đồ theo track từ một ScoreCard.

Tách khỏi report.py để report chỉ lo layout, còn đây lo "scorecard → PNG nào".
Gọi thẳng skill ``inspector_report`` (deterministic, không LLM).
"""

from app.schemas.evaluation import ScoreCard, Track
from app.skills.inspector_report.scripts import charts

# Khuyến nghị → nhãn NGẮN cho gauge.
_GAUGE_LABEL = {
    "strong_hire": "RẤT NÊN TUYỂN",
    "hire": "TUYỂN",
    "lean_hire": "CÂN NHẮC",
    "no_hire": "KHÔNG TUYỂN",
    "strong_no_hire": "KHÔNG TUYỂN",
}


def render_for(sc: ScoreCard) -> dict:
    """Trả dict tên→PNG bytes. Chart phụ thuộc track có thể vắng mặt."""
    figs: dict = {}

    figs["gauge"] = charts.overall_gauge(
        sc.overall_score, label=_GAUGE_LABEL.get(sc.recommendation.value, "")
    )

    names = [c.name for c in sc.competencies]
    scores = [c.score for c in sc.competencies]
    figs["radar"] = charts.competency_radar(names, scores)
    figs["bars"] = charts.score_breakdown_barh(
        [{"name": c.name, "score": c.score, "weight": c.weight} for c in sc.competencies]
    )

    if sc.track == Track.tech and sc.coding_eval:
        ce = sc.coding_eval
        figs["coding"] = charts.coding_dimensions(
            {
                "Đúng đắn": ce.correctness,
                "Chất lượng code": ce.code_quality,
                "Tư duy": ce.problem_solving,
                "Giao tiếp": ce.communication,
            }
        )
        if ce.tests_total:
            figs["donut"] = charts.test_pass_donut(
                ce.tests_passed or 0, ce.tests_total
            )

    return figs
