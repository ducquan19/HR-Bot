"""Inspector report PDF builder — single-language (EN or VI per `language`).

Skill-level module: no agent logic, pure rendering.

Design contract
───────────────
- Every chart is sandwiched: section title above + caption box below.
  A bare chart without text is never allowed.
- Two locked templates (section order never changes):
    Tech:     header → badge → kpi → score gauge → summary → competency profile
              → coding assessment → strengths & concerns → competency table
              → integrity → next steps
    Non-tech: same without the "coding assessment" section.
- Language: the whole report renders in ONE language — `build_pdf`/`build_markdown`
  take a ``language`` arg ('en' | 'vi', the value HR picked in the UI). Static
  labels come from the ``_L`` table; narrative text is already in that language
  because the Inspector Agent was prompted to write it so.
- Deterministic: ScoreCard numbers → charts → PDF. No LLM involved here.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF
from PIL import Image

from app.schemas.evaluation import IntegritySummary, ScoreCard, Track
from app.skills.inspector_report.scripts import charts

# ── Palette (RGB, mirrors charts.py) ─────────────────────────────────────────
INK        = (15, 23, 42)
MUTED      = (100, 116, 139)
GRID       = (226, 232, 240)
LIGHT      = (248, 250, 252)
ACCENT     = (16, 185, 129)
ACCENT_DK  = (4, 120, 87)
RED        = (239, 68, 68)
AMBER      = (245, 158, 11)
TEAL       = (20, 184, 166)
WHITE      = (255, 255, 255)

_FONT      = "DejaVu"
_PAGE_W    = 210.0
_MARGIN    = 16.0
_CW        = _PAGE_W - 2 * _MARGIN   # content width

# Recommendation: EN label · VI label · badge RGB
_REC: dict[str, tuple[str, str, tuple]] = {
    "strong_hire":    ("STRONG HIRE",       "Rất nên tuyển",           ACCENT_DK),
    "hire":           ("HIRE",              "Nên tuyển",               ACCENT),
    "lean_hire":      ("LEAN HIRE",         "Cân nhắc",                AMBER),
    "no_hire":        ("NO HIRE",           "Không tuyển",             RED),
    "strong_no_hire": ("STRONG NO HIRE",    "Không tuyển — rõ rệt",    (185, 28, 28)),
}
# Short gauge labels (all-caps EN, fits inside the needle dial)
_GAUGE_LABEL: dict[str, str] = {
    "strong_hire": "STRONG HIRE", "hire": "HIRE",
    "lean_hire": "LEAN HIRE", "no_hire": "NO HIRE",
    "strong_no_hire": "NO HIRE",
}
_TRACK: dict[str, tuple[str, str]] = {
    "tech":    ("Technical",     "Kỹ thuật"),
    "nontech": ("Non-Technical", "Phi kỹ thuật"),
}
_RISK: dict[str, tuple[str, str, tuple]] = {
    "clean":  ("Clean",       "Sạch",         ACCENT),
    "low":    ("Low Risk",    "Thấp",         TEAL),
    "medium": ("Medium Risk", "Trung bình",   AMBER),
    "high":   ("High Risk",   "Cao",          RED),
}
# Short gauge labels in Vietnamese (mirror _GAUGE_LABEL, kept compact for the dial)
_GAUGE_LABEL_VI: dict[str, str] = {
    "strong_hire": "RẤT NÊN TUYỂN", "hire": "NÊN TUYỂN",
    "lean_hire": "CÂN NHẮC", "no_hire": "KHÔNG TUYỂN",
    "strong_no_hire": "KHÔNG TUYỂN",
}

# ── i18n: every static label in the report, keyed by language ──────────────────
# Section titles are stored in natural case; the PDF upper-cases them, markdown
# uses them as-is. Captions with {…} placeholders are filled via str.format().
_L: dict[str, dict[str, str]] = {
    "en": {
        "report_title":  "CANDIDATE EVALUATION REPORT",
        "brand_line":    "GreenTemis  ·  AI Hiring Platform",
        "footer":        "GreenTemis  ·  Candidate Evaluation Report  ·  Page",
        "date_fmt":      "%B %d, %Y",
        "track":         "Track",
        "kpi_total":     "Total Score",
        "kpi_comps":     "Competencies Assessed",
        "kpi_integrity": "Integrity",
        "sec_overall":   "Overall Score",
        "sec_summary":   "Executive Summary",
        "sec_profile":   "Competency Profile",
        "sec_coding":    "Coding Assessment",
        "sec_strconc":   "Strengths & Concerns",
        "sec_detail":    "Competency Detail",
        "sec_integrity": "Interview Integrity",
        "sec_next":      "Next Steps",
        "sub_strengths": "Strengths",
        "sub_concerns":  "Concerns",
        "sub_redflags":  "Red Flags",
        "th_competency": "Competency",
        "th_score":      "Score",
        "th_weight":     "Weight",
        "th_assessment": "Assessment & Evidence",
        "risk_level":    "Risk Level:",
        "signals":       "Total signals:",
        "high_sev":      "High-severity:",
        "breakdown":     "Breakdown",
        "tests_passed":  "Tests passed",
        "dim_correctness": "Correctness",
        "dim_quality":     "Code Quality",
        "dim_problem":     "Problem-Solving",
        "dim_comm":        "Communication",
        "md_title":        "Candidate Evaluation Report",
        "md_position":     "Position",
        "md_rec":          "Recommendation",
        "md_overall":      "Overall Score",
        "md_dimension":    "Dimension",
        "cap_gauge": (
            "Composite weighted score across {n} assessed competencies on a 0–5 "
            "scale. Colour bands: red (<2.0) · amber (2.0–3.0) · teal (3.0–4.0) "
            "· emerald (≥4.0)."
        ),
        "cap_radar": (
            "Relative strength profile. Each axis represents one assessed "
            "competency; distance from centre reflects the score on that area."
        ),
        "cap_bars": (
            "Competencies ranked by score (low → high). Priority weight is shown "
            "per item where specified."
        ),
        "cap_coding": (
            "Four-axis evaluation of the coding challenge. Correctness: solution "
            "accuracy and test results. Code Quality: readability, naming, and "
            "structure. Problem-Solving: approach, edge-case handling, and "
            "debugging. Communication: verbal explanation during the exercise."
        ),
        "cap_donut": (
            "Automated test pass rate: {passed} of {total} tests passed ({pct})."
        ),
    },
    "vi": {
        "report_title":  "BÁO CÁO ĐÁNH GIÁ ỨNG VIÊN",
        "brand_line":    "GreenTemis  ·  Nền tảng tuyển dụng AI",
        "footer":        "GreenTemis  ·  Báo cáo đánh giá ứng viên  ·  Trang",
        "date_fmt":      "%d/%m/%Y",
        "track":         "Lĩnh vực",
        "kpi_total":     "Điểm tổng",
        "kpi_comps":     "Số năng lực đánh giá",
        "kpi_integrity": "Liêm chính",
        "sec_overall":   "Điểm tổng quan",
        "sec_summary":   "Tóm tắt điều hành",
        "sec_profile":   "Bản đồ năng lực",
        "sec_coding":    "Đánh giá lập trình",
        "sec_strconc":   "Điểm mạnh & Lưu ý",
        "sec_detail":    "Chi tiết năng lực",
        "sec_integrity": "Liêm chính buổi thi",
        "sec_next":      "Bước tiếp theo",
        "sub_strengths": "Điểm mạnh",
        "sub_concerns":  "Điểm lưu ý",
        "sub_redflags":  "Cảnh báo",
        "th_competency": "Năng lực",
        "th_score":      "Điểm",
        "th_weight":     "Trọng số",
        "th_assessment": "Nhận định & Bằng chứng",
        "risk_level":    "Mức rủi ro:",
        "signals":       "Tổng tín hiệu:",
        "high_sev":      "Mức nghiêm trọng:",
        "breakdown":     "Phân loại",
        "tests_passed":  "Số test đạt",
        "dim_correctness": "Đúng đắn",
        "dim_quality":     "Chất lượng code",
        "dim_problem":     "Giải quyết VĐ",
        "dim_comm":        "Giao tiếp",
        "md_title":        "Báo cáo đánh giá ứng viên",
        "md_position":     "Vị trí",
        "md_rec":          "Khuyến nghị",
        "md_overall":      "Điểm tổng",
        "md_dimension":    "Trục đánh giá",
        "cap_gauge": (
            "Điểm tổng hợp có trọng số trên {n} năng lực được đánh giá, thang 0–5. "
            "Dải màu: đỏ (<2.0) · hổ phách (2.0–3.0) · teal (3.0–4.0) "
            "· emerald (≥4.0)."
        ),
        "cap_radar": (
            "Hồ sơ năng lực tương đối. Mỗi trục là một năng lực được đánh giá; "
            "càng xa tâm thì điểm năng lực đó càng cao."
        ),
        "cap_bars": (
            "Năng lực xếp hạng theo điểm (thấp → cao). Trọng số ưu tiên hiển thị "
            "ở mỗi mục khi có."
        ),
        "cap_coding": (
            "Đánh giá phần coding theo 4 trục. Đúng đắn: độ chính xác lời giải và "
            "kết quả test. Chất lượng code: dễ đọc, đặt tên, cấu trúc. Giải quyết "
            "vấn đề: cách tiếp cận, xử lý biên, gỡ lỗi. Giao tiếp: giải thích bằng "
            "lời trong lúc làm bài."
        ),
        "cap_donut": (
            "Tỉ lệ test tự động: {passed}/{total} test đạt ({pct})."
        ),
    },
}


def _norm_lang(language: str | None) -> str:
    """Chuẩn hóa về 'en' | 'vi' (cùng quy ước với Interview/Inspector prompt)."""
    return "vi" if str(language or "").lower().startswith("vi") else "en"


# ── Helpers ───────────────────────────────────────────────────────────────────
def _score_color(score: float, mx: float = 5.0) -> tuple:
    r = score / mx if mx else 0.0
    if r < 0.40: return RED
    if r < 0.60: return AMBER
    if r < 0.80: return TEAL
    return ACCENT


def _track_val(sc: ScoreCard) -> str:
    return sc.track.value if hasattr(sc.track, "value") else str(sc.track)


# ── FPDF subclass ─────────────────────────────────────────────────────────────
class _Doc(FPDF):
    def __init__(self, lang: str = "en") -> None:
        super().__init__(format="A4")
        self.lang = lang
        fd = Path(__file__).resolve().parents[3] / "infra" / "fonts"
        self.add_font(_FONT, "",   str(fd / "DejaVuSans.ttf"))
        self.add_font(_FONT, "B",  str(fd / "DejaVuSans-Bold.ttf"))
        self.add_font(_FONT, "I",  str(fd / "DejaVuSans-Oblique.ttf"))
        self.add_font(_FONT, "BI", str(fd / "DejaVuSans-BoldOblique.ttf"))
        self.set_margins(_MARGIN, _MARGIN, _MARGIN)
        self.set_auto_page_break(True, margin=18)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font(_FONT, "", 7.5)
        self.set_text_color(*MUTED)
        self.cell(
            0, 6,
            f"{_L[self.lang]['footer']} {self.page_no()}",
            align="C",
        )


# ── Layout primitives ─────────────────────────────────────────────────────────
def _img_h(png: bytes, w_mm: float) -> float:
    im = Image.open(io.BytesIO(png))
    iw, ih = im.size
    return w_mm * ih / iw


def _place_image(
    doc: _Doc, png: bytes, w_mm: float, *, center: bool = True
) -> None:
    h = _img_h(png, w_mm)
    if doc.get_y() + h > doc.h - 20:
        doc.add_page()
    x = (_PAGE_W - w_mm) / 2 if center else _MARGIN
    doc.image(io.BytesIO(png), x=x, y=doc.get_y(), w=w_mm)
    doc.set_y(doc.get_y() + h + 1)


def _section_title(doc: _Doc, en: str, vi: str = "") -> None:
    """Section heading: EN bold + thin rule. VI subtitle rendered only when provided."""
    bar_h = 14 if vi else 9
    if doc.get_y() + bar_h + 10 > doc.h - 20:
        doc.add_page()
    doc.ln(4)
    y = doc.get_y()
    doc.set_fill_color(*ACCENT_DK)
    doc.rect(_MARGIN, y, 3.5, bar_h, "F")
    doc.set_xy(_MARGIN + 7, y)
    doc.set_font(_FONT, "B", 12.5)
    doc.set_text_color(*INK)
    doc.cell(0, 7, en, ln=1)
    if vi:
        doc.set_x(_MARGIN + 7)
        doc.set_font(_FONT, "I", 9)
        doc.set_text_color(*MUTED)
        doc.cell(0, 5.5, vi, ln=1)
    doc.set_draw_color(*GRID)
    doc.set_line_width(0.25)
    doc.line(_MARGIN, doc.get_y(), _PAGE_W - _MARGIN, doc.get_y())
    doc.ln(3)
    doc.set_text_color(*INK)


def _caption(doc: _Doc, en: str, vi: str = "") -> None:
    """Light-gray callout box below a chart. Left accent strip, EN + VI text.

    Always call this after _place_image — never leave a chart without a caption.
    """
    inner_w = _CW - 9

    doc.set_font(_FONT, "", 9)
    en_lines = doc.multi_cell(inner_w, 5.5, en, dry_run=True, output="LINES")
    en_h = len(en_lines) * 5.5

    vi_h = 0.0
    if vi:
        doc.set_font(_FONT, "I", 8.5)
        vi_lines = doc.multi_cell(inner_w, 5.0, vi, dry_run=True, output="LINES")
        vi_h = len(vi_lines) * 5.0 + 2.0  # gap between EN and VI blocks

    box_h = en_h + vi_h + 8.0  # 4 top + 4 bottom padding

    y = doc.get_y() + 1
    if y + box_h > doc.h - 20:
        doc.add_page()
        y = doc.get_y()

    # Background + left accent
    doc.set_fill_color(*LIGHT)
    doc.rect(_MARGIN, y, _CW, box_h, "F")
    doc.set_fill_color(*ACCENT)
    doc.rect(_MARGIN, y, 3, box_h, "F")

    # EN text
    doc.set_xy(_MARGIN + 6, y + 4)
    doc.set_font(_FONT, "", 9)
    doc.set_text_color(*INK)
    doc.multi_cell(inner_w, 5.5, en)

    # VI text
    if vi:
        doc.ln(2)
        doc.set_x(_MARGIN + 6)
        doc.set_font(_FONT, "I", 8.5)
        doc.set_text_color(*MUTED)
        doc.multi_cell(inner_w, 5.0, vi)

    doc.set_y(y + box_h + 4)
    doc.set_text_color(*INK)


def _bullets(doc: _Doc, items: list[str], dot: tuple) -> None:
    doc.set_font(_FONT, "", 10.5)
    doc.set_text_color(*INK)
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        y = doc.get_y()
        if y + 7 > doc.h - 20:
            doc.add_page()
            y = doc.get_y()
        doc.set_fill_color(*dot)
        doc.rect(_MARGIN + 1.5, y + 2.6, 2.2, 2.2, "F")
        doc.set_xy(_MARGIN + 7, y)
        doc.multi_cell(_CW - 8, 5.6, text)
        doc.ln(0.6)


def _sub_heading(doc: _Doc, en: str, vi: str = "", color: tuple = INK) -> None:
    """Sub-section label. VI suffix omitted when vi is empty."""
    doc.set_font(_FONT, "B", 9.5)
    doc.set_text_color(*color)
    label = f"{en}  ·  {vi}" if vi else en
    doc.cell(0, 6.5, label, ln=1)
    doc.set_text_color(*INK)


def _paragraph(doc: _Doc, text: str, size: float = 10.5) -> None:
    doc.set_font(_FONT, "", size)
    doc.set_text_color(*INK)
    doc.multi_cell(_CW, 5.6, str(text).strip())
    doc.ln(2)


# ── Page-level blocks ─────────────────────────────────────────────────────────
def _header(doc: _Doc, sc: ScoreCard, lang: str) -> None:
    t = _L[lang]
    idx = 1 if lang == "vi" else 0
    track_lbl = _TRACK.get(_track_val(sc), ("Technical", "Kỹ thuật"))[idx]
    doc.set_fill_color(*ACCENT_DK)
    doc.rect(0, 0, _PAGE_W, 44, "F")
    doc.set_text_color(*WHITE)

    doc.set_xy(_MARGIN, 7)
    doc.set_font(_FONT, "B", 16)
    doc.cell(0, 8, t["report_title"], ln=1)

    doc.set_xy(_MARGIN, 17)
    doc.set_font(_FONT, "I", 9.5)
    doc.cell(0, 5, t["brand_line"], ln=1)

    doc.set_xy(_MARGIN, 24)
    doc.set_font(_FONT, "B", 11.5)
    doc.cell(0, 6, f"{sc.candidate_name}  ·  {sc.position or '—'}", ln=1)

    doc.set_xy(_MARGIN, 32)
    doc.set_font(_FONT, "", 8.5)
    today = datetime.now(timezone.utc).strftime(t["date_fmt"])
    doc.cell(0, 5, f"{today}  ·  {t['track']}: {track_lbl}", ln=1)
    doc.set_y(52)
    doc.set_text_color(*INK)


def _badge(doc: _Doc, sc: ScoreCard, lang: str) -> None:
    idx = 1 if lang == "vi" else 0
    en_vi = _REC.get(sc.recommendation.value, ("—", "—", MUTED))
    label, color = en_vi[idx], en_vi[2]
    doc.set_font(_FONT, "B", 12)
    bw = doc.get_string_width(label) + 18
    x = (_PAGE_W - bw) / 2
    y = doc.get_y()
    doc.set_fill_color(*color)
    try:
        doc.rect(x, y, bw, 11, "F", round_corners=True, corner_radius=3)
    except TypeError:
        doc.rect(x, y, bw, 11, "F")
    doc.set_xy(x, y)
    doc.set_text_color(*WHITE)
    doc.cell(bw, 11, label, align="C")
    doc.set_y(y + 15)
    doc.set_text_color(*INK)


def _kpi_strip(doc: _Doc, sc: ScoreCard, integ: IntegritySummary, lang: str) -> None:
    """Three KPI boxes: Total Score · Competencies · Integrity."""
    t = _L[lang]
    idx = 1 if lang == "vi" else 0
    en_vi = _RISK.get(integ.risk, ("—", "—", MUTED))
    risk_lbl, risk_col = en_vi[idx], en_vi[2]
    cells = [
        (f"{sc.overall_score:.1f} / 5", t["kpi_total"],     _score_color(sc.overall_score)),
        (str(len(sc.competencies)),      t["kpi_comps"],     INK),
        (risk_lbl,                       t["kpi_integrity"], risk_col),
    ]
    gap = 4.0
    w = (_CW - 2 * gap) / 3
    y = doc.get_y()
    for i, (big, small, col) in enumerate(cells):
        x = _MARGIN + i * (w + gap)
        doc.set_fill_color(*LIGHT)
        try:
            doc.rect(x, y, w, 23, "F", round_corners=True, corner_radius=2)
        except TypeError:
            doc.rect(x, y, w, 23, "F")
        doc.set_xy(x, y + 4)
        doc.set_font(_FONT, "B", 15)
        doc.set_text_color(*col)
        doc.cell(w, 8, big, align="C")
        doc.set_xy(x, y + 14)
        doc.set_font(_FONT, "", 8.5)
        doc.set_text_color(*MUTED)
        doc.cell(w, 5, small, align="C")
    doc.set_y(y + 27)
    doc.set_text_color(*INK)


def _competency_table(doc: _Doc, sc: ScoreCard, lang: str) -> None:
    """Striped table: Competency | Score | Weight | Assessment & Evidence."""
    t = _L[lang]
    col_w = [74, 18, 20, _CW - 112]
    headers = [t["th_competency"], t["th_score"], t["th_weight"], t["th_assessment"]]

    # Header row
    doc.set_font(_FONT, "B", 9)
    doc.set_fill_color(*INK)
    doc.set_text_color(*WHITE)
    for i, (h, cw) in enumerate(zip(headers, col_w)):
        doc.cell(cw, 8, f"  {h}", border=0, fill=True, ln=(1 if i == 3 else 0))

    for idx, comp in enumerate(sc.competencies):
        fill = LIGHT if idx % 2 == 0 else WHITE
        ev_w = col_w[3] - 4
        body = comp.rationale or ""
        if comp.evidence:
            body = f"{body}\n\"{comp.evidence}\""

        doc.set_font(_FONT, "", 8.8)
        lines = doc.multi_cell(ev_w, 4.6, body, dry_run=True, output="LINES")
        row_h = max(9.0, len(lines) * 4.6 + 4)

        y0 = doc.get_y()
        if y0 + row_h > doc.h - 20:
            doc.add_page()
            y0 = doc.get_y()

        doc.set_fill_color(*fill)
        doc.rect(_MARGIN, y0, _CW, row_h, "F")

        # Competency name
        doc.set_xy(_MARGIN + 2, y0 + 2)
        doc.set_font(_FONT, "B", 9.5)
        doc.set_text_color(*INK)
        doc.multi_cell(70, 4.6, comp.name)

        # Score (colored)
        doc.set_xy(_MARGIN + 74, y0)
        doc.set_font(_FONT, "B", 11)
        doc.set_text_color(*_score_color(comp.score))
        doc.cell(18, row_h, f"{comp.score:.1f}", align="C")

        # Weight
        doc.set_xy(_MARGIN + 92, y0)
        doc.set_font(_FONT, "", 9)
        doc.set_text_color(*MUTED)
        doc.cell(20, row_h, f"{comp.weight:.0%}" if comp.weight else "—", align="C")

        # Assessment text
        doc.set_xy(_MARGIN + 112, y0 + 2)
        doc.set_font(_FONT, "", 8.8)
        doc.set_text_color(*INK)
        doc.multi_cell(ev_w, 4.6, body)

        doc.set_y(y0 + row_h)
    doc.ln(2)


def _integrity_section(doc: _Doc, integ: IntegritySummary, lang: str) -> None:
    t = _L[lang]
    idx = 1 if lang == "vi" else 0
    _section_title(doc, t["sec_integrity"].upper())
    en_vi = _RISK.get(integ.risk, ("—", "—", MUTED))
    risk_lbl, risk_col = en_vi[idx], en_vi[2]

    doc.set_font(_FONT, "B", 10.5)
    doc.set_text_color(*risk_col)
    doc.cell(0, 6.5, f"{t['risk_level']}  {risk_lbl}", ln=1)

    doc.set_font(_FONT, "", 10.5)
    doc.set_text_color(*INK)
    doc.cell(
        0, 6,
        f"{t['signals']} {integ.total_violations}   ·   "
        f"{t['high_sev']} {integ.high_severity_count}",
        ln=1,
    )

    if integ.counts_by_kind:
        kinds = ",  ".join(f"{k}: {v}" for k, v in integ.counts_by_kind.items())
        doc.set_font(_FONT, "", 9.5)
        doc.set_text_color(*MUTED)
        doc.set_x(_MARGIN)
        doc.multi_cell(_CW, 5.0, f"{t['breakdown']} — {kinds}")

    if integ.note:
        doc.set_font(_FONT, "I", 9.5)
        doc.set_text_color(*MUTED)
        doc.set_x(_MARGIN)
        doc.multi_cell(_CW, 5.0, integ.note)

    doc.ln(1)
    doc.set_text_color(*INK)


# ── Chart rendering (inlined from charts_bridge to keep skill self-contained) ─
def _render_charts(sc: ScoreCard, lang: str) -> dict[str, bytes]:
    """Deterministic chart selection + render by track. Returns name→PNG bytes."""
    t = _L[lang]
    gauge_lbl = (_GAUGE_LABEL_VI if lang == "vi" else _GAUGE_LABEL).get(
        sc.recommendation.value, ""
    )
    figs: dict[str, bytes] = {}

    figs["gauge"] = charts.overall_gauge(sc.overall_score, label=gauge_lbl)
    names  = [c.name for c in sc.competencies]
    scores = [c.score for c in sc.competencies]
    figs["radar"] = charts.competency_radar(names, scores)
    figs["bars"]  = charts.score_breakdown_barh(
        [{"name": c.name, "score": c.score, "weight": c.weight}
         for c in sc.competencies],
        language=lang,
    )
    if sc.track == Track.tech and sc.coding_eval:
        ce = sc.coding_eval
        figs["coding"] = charts.coding_dimensions({
            t["dim_correctness"]: ce.correctness,
            t["dim_quality"]:     ce.code_quality,
            t["dim_problem"]:     ce.problem_solving,
            t["dim_comm"]:        ce.communication,
        })
        if ce.tests_total:
            figs["donut"] = charts.test_pass_donut(
                ce.tests_passed or 0, ce.tests_total, language=lang
            )
    return figs


# ── Public API ────────────────────────────────────────────────────────────────
def build_pdf(sc: ScoreCard, integ: IntegritySummary, language: str = "en") -> bytes:
    """Render a professional single-language PDF from ScoreCard + IntegritySummary.

    ``language`` ('en' | 'vi') is the value HR picked in the UI; it drives every
    static label. Tech template — 8 sections incl. Coding Assessment; Non-tech —
    same minus Coding Assessment. Section order is fixed; no section is ever empty
    (charts always captioned).
    """
    lang = _norm_lang(language)
    t    = _L[lang]
    figs = _render_charts(sc, lang)
    n    = len(sc.competencies)
    track = _track_val(sc)

    doc = _Doc(lang)
    doc.add_page()

    # ── Header + badge + headline ─────────────────────────────────────────────
    _header(doc, sc, lang)
    _badge(doc, sc, lang)

    doc.set_font(_FONT, "I", 11)
    doc.set_text_color(*INK)
    doc.multi_cell(_CW, 6.5, f'"{sc.headline}"', align="C")
    doc.ln(3)

    _kpi_strip(doc, sc, integ, lang)

    # ── 1. Overall Score ──────────────────────────────────────────────────────
    _section_title(doc, t["sec_overall"].upper())
    if figs.get("gauge"):
        _place_image(doc, figs["gauge"], 95)
        _caption(doc, t["cap_gauge"].format(n=n))

    # ── 2. Executive Summary ──────────────────────────────────────────────────
    _section_title(doc, t["sec_summary"].upper())
    _paragraph(doc, sc.summary)

    # ── 3. Competency Profile ─────────────────────────────────────────────────
    _section_title(doc, t["sec_profile"].upper())
    if figs.get("radar"):
        _place_image(doc, figs["radar"], 118)
        _caption(doc, t["cap_radar"])
    if figs.get("bars"):
        _place_image(doc, figs["bars"], _CW, center=False)
        _caption(doc, t["cap_bars"])

    # ── 4. Coding Assessment (tech only) ─────────────────────────────────────
    if track == "tech" and sc.coding_eval:
        ce = sc.coding_eval
        _section_title(doc, t["sec_coding"].upper())

        if figs.get("coding"):
            _place_image(doc, figs["coding"], 148)
            _caption(doc, t["cap_coding"])

        if figs.get("donut") and ce.tests_total:
            pct = (ce.tests_passed or 0) / ce.tests_total
            _place_image(doc, figs["donut"], 68)
            _caption(
                doc,
                t["cap_donut"].format(
                    passed=ce.tests_passed or 0, total=ce.tests_total,
                    pct=f"{pct:.0%}",
                ),
            )

        if ce.notes:
            _paragraph(doc, ce.notes, size=10)

    # ── 5. Strengths & Concerns ───────────────────────────────────────────────
    _section_title(doc, t["sec_strconc"].upper())
    if sc.strengths:
        _sub_heading(doc, t["sub_strengths"], color=ACCENT_DK)
        _bullets(doc, sc.strengths, ACCENT)
        doc.ln(1)
    if sc.concerns:
        _sub_heading(doc, t["sub_concerns"], color=AMBER)
        _bullets(doc, sc.concerns, AMBER)
        doc.ln(1)
    if sc.red_flags:
        _sub_heading(doc, t["sub_redflags"], color=RED)
        _bullets(doc, sc.red_flags, RED)
        doc.ln(1)

    # ── 6. Competency Detail ─────────────────────────────────────────────────
    _section_title(doc, t["sec_detail"].upper())
    _competency_table(doc, sc, lang)

    # ── 7. Interview Integrity ────────────────────────────────────────────────
    _integrity_section(doc, integ, lang)

    # ── 8. Next Steps ─────────────────────────────────────────────────────────
    if sc.next_steps:
        _section_title(doc, t["sec_next"].upper())
        _paragraph(doc, sc.next_steps)

    return bytes(doc.output())


def build_markdown(
    sc: ScoreCard, integ: IntegritySummary, language: str = "en"
) -> str:
    """Markdown report for DB storage, preview, and full-text search.

    Single-language: ``language`` ('en' | 'vi') drives every heading and label.
    """
    lang = _norm_lang(language)
    t    = _L[lang]
    idx  = 1 if lang == "vi" else 0
    rec_lbl   = _REC.get(sc.recommendation.value, ("—", "—", None))[idx]
    track_lbl = _TRACK.get(_track_val(sc), ("Technical", "Kỹ thuật"))[idx]
    risk_lbl  = _RISK.get(integ.risk, ("—", "—", None))[idx]

    lines = [
        f"# {t['md_title']}  —  {sc.candidate_name}",
        f"**{t['md_position']}:** {sc.position or '—'}  ·  "
        f"**{t['track']}:** {track_lbl}  ·  "
        f"**{t['md_rec']}:** {rec_lbl}  ·  "
        f"**{t['md_overall']}:** {sc.overall_score:.1f} / 5",
        "",
        f"> *{sc.headline}*",
        "",
        f"## {t['sec_summary']}",
        sc.summary,
        "",
        f"## {t['sec_profile']}",
        "",
        f"| {t['th_competency']} | {t['th_score']} | {t['th_weight']} | {t['th_assessment']} |",
        "| --- | --- | --- | --- |",
    ]
    for c in sc.competencies:
        body = c.rationale or ""
        if c.evidence:
            body += f'  _"{c.evidence}"_'
        lines.append(
            f"| {c.name} | {c.score:.1f} | "
            f"{'—' if not c.weight else f'{c.weight:.0%}'} | "
            f"{body.replace(chr(10), ' ')} |"
        )

    if sc.coding_eval:
        ce = sc.coding_eval
        lines += [
            "",
            f"## {t['sec_coding']}",
            "",
            f"| {t['md_dimension']} | {t['th_score']} |",
            "| --- | --- |",
            f"| {t['dim_correctness']} | {ce.correctness:.1f} |",
            f"| {t['dim_quality']} | {ce.code_quality:.1f} |",
            f"| {t['dim_problem']} | {ce.problem_solving:.1f} |",
            f"| {t['dim_comm']} | {ce.communication:.1f} |",
        ]
        if ce.tests_total:
            pct = (ce.tests_passed or 0) / ce.tests_total
            lines.append(
                f"\n**{t['tests_passed']}:** "
                f"{ce.tests_passed or 0}/{ce.tests_total} ({pct:.0%})"
            )
        if ce.notes:
            lines.append(f"\n{ce.notes}")

    if sc.strengths or sc.concerns or sc.red_flags:
        lines += ["", f"## {t['sec_strconc']}"]
        if sc.strengths:
            lines += ["", f"**{t['sub_strengths']}:**", *[f"- {s}" for s in sc.strengths]]
        if sc.concerns:
            lines += ["", f"**{t['sub_concerns']}:**", *[f"- {s}" for s in sc.concerns]]
        if sc.red_flags:
            lines += ["", f"**{t['sub_redflags']}:**", *[f"- {s}" for s in sc.red_flags]]

    lines += [
        "",
        f"## {t['sec_integrity']}",
        "",
        f"- **{t['risk_level']}** {risk_lbl}",
        f"- **{t['signals']}** {integ.total_violations}  "
        f"·  **{t['high_sev']}** {integ.high_severity_count}",
    ]
    if integ.counts_by_kind:
        kinds = ",  ".join(f"{k}: {v}" for k, v in integ.counts_by_kind.items())
        lines.append(f"- {t['breakdown']} — {kinds}")
    if integ.note:
        lines.append(f"- _{integ.note}_")

    if sc.next_steps:
        lines += ["", f"## {t['sec_next']}", "", sc.next_steps]

    return "\n".join(lines)
