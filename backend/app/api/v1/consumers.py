"""``/api/v1/consumers`` -- consumer directory + message audio (B9/B12 tie-in)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.grid.views import consumers_sample_view
from app.services.deps import get_grid_service
from app.services.service import GridService
from app.voice.tts import tts_client_from_env

router = APIRouter(prefix="/api/v1/consumers", tags=["consumers"])

# In-memory store of outbound message texts, keyed by message id, so the
# audio endpoint has something to synthesise (populated by the channel
# gateway / dispatcher in a full wiring; seeded here for the demo/API).
_MESSAGE_TEXTS: dict[str, str] = {}


def register_message_text(message_id: str, text: str) -> None:
    _MESSAGE_TEXTS[message_id] = text


@router.get("")
async def list_consumers(
    subdivision_id: str | None = None,
    limit: int = 50,
    service: GridService = Depends(get_grid_service),
) -> list[dict]:
    return consumers_sample_view(
        service.scenario.network, subdivision_id=subdivision_id, limit=limit
    )


@router.get("/messages/{message_id}/audio")
async def get_message_audio(message_id: str) -> Response:
    """TTS playback for a consumer-facing message (IVR audio / WhatsApp voice
    note). Real synthesis uses Sarvam ``bulbul:v3``; without ``SARVAM_API_KEY``
    configured this returns a valid (silent) WAV so the endpoint contract and
    plumbing are exercised end-to-end regardless of live-key availability.
    """
    text = _MESSAGE_TEXTS.get(message_id, "LifelineGrid notice.")
    client = tts_client_from_env()
    wav_bytes = client.synthesize(text, language="hi")
    return Response(content=wav_bytes, media_type="audio/wav")


__all__ = ["router", "register_message_text"]
