"""
Monitoring cho agents — OpenTelemetry export sang Arize Phoenix UI (local).

MAF (agent_framework) đã instrument sẵn mọi LLM call, tool call và agent run bằng
OpenTelemetry. Ta chỉ cần cấu hình providers + exporter để trace chảy về Phoenix.

Cách dùng:
  1. Chạy Phoenix local (UI ở http://localhost:6006):
       pip install arize-phoenix
       python -m phoenix.server.main serve
     hoặc docker:
       docker run -p 6006:6006 arizephoenix/phoenix:latest
  2. Đặt OTEL_ENABLED=true trong .env rồi khởi động ai-services.
  3. Gọi POST /api/v1/planning/plan → xem trace (LLM, tool, latency, token) ở Phoenix.

Idempotent: gọi nhiều lần cũng chỉ cấu hình một lần.
"""

import logging

from app.config import settings

logger = logging.getLogger(__name__)

_CONFIGURED = False


def setup_observability() -> None:
    """Bật OpenTelemetry + đẩy trace tới Phoenix nếu settings.otel_enabled.

    No-op khi tắt hoặc khi đã cấu hình rồi — an toàn để gọi ở startup.
    """
    global _CONFIGURED
    if _CONFIGURED or not settings.otel_enabled:
        return

    try:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from agent_framework.observability import (
            configure_otel_providers,
            enable_instrumentation,
        )
    except ImportError as exc:  # thiếu dep → cảnh báo, không làm chết app
        logger.warning("Observability deps missing, tracing disabled: %s", exc)
        return

    exporter = OTLPSpanExporter(endpoint=settings.otel_otlp_endpoint)
    configure_otel_providers(
        exporters=[exporter],
        enable_sensitive_data=settings.otel_sensitive,
        enable_console_exporters=settings.otel_console,
    )
    enable_instrumentation(enable_sensitive_data=settings.otel_sensitive)

    _CONFIGURED = True
    logger.info(
        "Observability ON → exporting traces to %s", settings.otel_otlp_endpoint
    )
