# Thin shim — PDF builder lives in the inspector_report skill.
from app.skills.inspector_report import build_pdf, build_markdown  # noqa: F401

__all__ = ["build_pdf", "build_markdown"]
