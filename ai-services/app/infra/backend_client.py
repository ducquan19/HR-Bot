"""Thin async HTTP client for the backend interview API.

Used at startup to fetch the interview context (plan + CV) and to flush
transcript turns. Transcript flush degrades gracefully if the backend endpoint
does not exist yet (see design doc section 12).
"""

import logging

import httpx

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self, backend_url: str, timeout: float = 10.0) -> None:
        self._base = backend_url.rstrip("/") + "/ai/interviews"
        self._timeout = timeout

    async def fetch_interview_context(self, interview_id: str) -> dict:
        """Return the interview detail (includes the ``plan`` key)."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(f"{self._base}/{interview_id}/context")
            r.raise_for_status()
            return r.json()

    async def end_interview(self, interview_id: str) -> bool:
        """End the interview (mark completed + generate the report). Best-effort."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(f"{self._base}/{interview_id}/end")
                r.raise_for_status()
            return True
        except Exception as exc:  # noqa: BLE001 - caller leaves regardless
            logger.warning("end interview failed: %s", exc)
            return False

    async def append_transcript_turn(
        self,
        interview_id: str,
        role: str,
        content: str,
        ts: float | None = None,
    ) -> bool:
        """Flush a single transcript turn. Returns False (degraded) on 404."""
        body: dict = {"role": role, "content": content}
        if ts is not None:
            body["ts"] = ts
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(
                    f"{self._base}/{interview_id}/transcripts", json=body
                )
                r.raise_for_status()
            return True
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.warning(
                    "transcript append endpoint missing (404); buffering only"
                )
                return False
            raise
        except httpx.RequestError as exc:
            # Backend unreachable (e.g. console/dev run with no backend up):
            # degrade gracefully and keep buffering instead of crashing the turn.
            logger.warning(
                "transcript append failed (%s); buffering only",
                exc.__class__.__name__,
            )
            return False
