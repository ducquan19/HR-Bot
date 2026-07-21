"""
AI Services entrypoint — chạy cả FastAPI (REST) và FastMCP (MCP/SSE) trên cùng port.

Port 8001:
  /api/v1/planning/plan  ← REST, backend gọi để tạo interview plan
  /mcp/*                 ← MCP/SSE, Interview Agent (LLM) gọi để conduct interview
"""

from fastapi import FastAPI

from app.api.inspector_router import router as inspector_router
from app.api.planning_router import router as planning_router
from app.config import settings
from app.mcp.interview_tools import mcp
from app.observability import setup_observability

# Bật OpenTelemetry → Phoenix (no-op nếu OTEL_ENABLED=false). Gọi trước khi
# tạo agent để mọi LLM/tool call đều được trace.
setup_observability()

app = FastAPI(
    title="HR Bot AI Services",
    description="Planning Agent (REST) + Interview Agent tools (MCP)",
    version="0.1.0",
)

# REST endpoints cho backend
app.include_router(planning_router)
app.include_router(inspector_router)

# MCP server mount — Interview Agent dùng SSE transport tại /mcp/sse.
# The child app is already mounted at /mcp, so keep FastMCP's internal mount
# path at root. Passing /mcp here makes the SSE message endpoint /mcp/mcp/messages.
app.mount("/mcp", mcp.sse_app(mount_path="/"))


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ai-services"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.mcp_host,
        port=settings.mcp_port,
        reload=True,
    )
