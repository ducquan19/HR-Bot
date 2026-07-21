"""Markdown → PDF (thuần Python, không cần system lib).

Dùng ``markdown`` để md→HTML rồi ``fpdf2`` (``write_html``) để HTML→PDF. fpdf2
chỉ phụ thuộc Pillow/fonttools (thuần Python) → không cần pango/cairo, chạy được
trong container gọn nhẹ.

Font DejaVu Sans (đủ glyph tiếng Việt) được bundle ngay trong repo và nhúng vào
PDF, nên báo cáo hiển thị đúng tên ứng viên / yêu cầu HR tiếng Việt — core font
latin-1 của PDF sẽ lỗi với các ký tự này.
"""

import logging
from pathlib import Path

import markdown as _markdown
from fpdf import FPDF

logger = logging.getLogger(__name__)

_FONT_DIR = Path(__file__).resolve().parent / "fonts"
_FONT = "DejaVu"


def _new_pdf(title: str) -> FPDF:
    pdf = FPDF()
    pdf.add_font(_FONT, "", str(_FONT_DIR / "DejaVuSans.ttf"))
    pdf.add_font(_FONT, "B", str(_FONT_DIR / "DejaVuSans-Bold.ttf"))
    pdf.add_font(_FONT, "I", str(_FONT_DIR / "DejaVuSans-Oblique.ttf"))
    pdf.add_font(_FONT, "BI", str(_FONT_DIR / "DejaVuSans-BoldOblique.ttf"))
    pdf.set_title(title)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_font(_FONT, size=11)
    return pdf


def markdown_to_pdf(report_markdown: str, title: str = "Interview Evaluation Report") -> bytes:
    """Render báo cáo markdown thành PDF, trả về bytes.

    Raise ``RuntimeError`` nếu fpdf2 không dựng được PDF.
    """
    html = _markdown.markdown(
        report_markdown,
        extensions=["tables", "fenced_code", "sane_lists", "nl2br"],
    )
    try:
        pdf = _new_pdf(title)
        pdf.write_html(html)
        return bytes(pdf.output())
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"PDF render failed: {exc}") from exc
