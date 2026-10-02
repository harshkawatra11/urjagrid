"""``/api/v1/consumers`` -- consumer directory + message audio (B9/B12 tie-in)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.grid.views import consumers_sample_view
from app.services.deps import get_grid_service
from app.services.service import GridService
from app.voice.tts import tts_client_from_env

router = APIRouter(prefix="/api/v1/consumers", tags=["consumers"])

# In-memory store of outbound message texts, keyed by message id, so the
# audio endpoint has something to synthesise (populated by the channel
# gateway / dispatcher in a full wiring; seeded here for the demo/API).
_MESSAGE_TEXTS: dict[str, str] = {}

_CHANNEL_PROTOCOLS = ("whatsapp", "ivr", "sms")


def register_message_text(message_id: str, text: str) -> None:
    _MESSAGE_TEXTS[message_id] = text


class ReportOutageRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    dt_id: str | None = None
    description: str = ""


@router.get("")
async def list_consumers(
    subdivision_id: str | None = None,
    limit: int = 50,
    service: GridService = Depends(get_grid_service),
) -> list[dict]:
    return consumers_sample_view(
        service.scenario.network, subdivision_id=subdivision_id, limit=limit
    )


@router.get("/messages")
async def list_messages(
    subdivision_id: str | None = None, service: GridService = Depends(get_grid_service)
) -> dict:
    """Consumer-facing WhatsApp/IVR/SMS traffic, reshaped from the real
    ``ProtocolLedger`` (every channel send in the demo is logged there --
    see ``adapters/channels.py``) rather than a separate message store.
    ``subdivision_id`` cannot filter the ledger itself (entries don't carry
    one), so this instead cross-references the correlation id against the
    consumer directory when present; absent that, all channel traffic is
    returned.
    """
    network = service.scenario.network
    consumer_sub: dict[str, str] = {}
    consumers = getattr(network, "consumers", None)
    if consumers is not None:
        for i in range(len(consumers)):
            consumer_sub[str(consumers.consumer_ids[i])] = str(consumers.subdivision_ids[i])

    rows: list[dict] = []
    for entry in service.ledger.all():
        if entry.protocol not in _CHANNEL_PROTOCOLS:
            continue
        consumer_id = entry.correlation_id or ""
        sub_id = consumer_sub.get(consumer_id, subdivision_id or "")
        if subdivision_id is not None and sub_id != subdivision_id:
            continue
        rows.append(
            {
                "id": str(entry.id),
                "consumerId": consumer_id,
                "subdivisionId": sub_id,
                "channel": entry.protocol,
                "direction": entry.direction.value,
                "bodyHi": str(entry.payload.get("body_hi", entry.payload.get("text_hi", ""))),
                "bodyEn": str(entry.payload.get("body_en", entry.payload.get("text_en", ""))),
                "timestampIso": entry.timestamp.isoformat(),
                "audioUrl": f"/api/v1/consumers/messages/{entry.id}/audio"
                if entry.protocol in ("whatsapp", "ivr")
                else None,
            }
        )
    return {"messages": rows}


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


@router.post("/{consumer_id}/report-outage")
async def report_outage_for_consumer(
    consumer_id: str,
    body: ReportOutageRequest,
    service: GridService = Depends(get_grid_service),
) -> dict:
    """Bridges the consumer phone app's outage report (D27) into the same
    in-memory outage store the field app (D28) reads/writes -- see
    ``app.api.v1.field`` -- so a consumer-reported outage shows up on the
    field worker's queue for real, rather than being a dead-end write.
    """
    from app.api.v1 import field as field_api

    network = service.scenario.network
    subdivision_id = ""
    consumers = getattr(network, "consumers", None)
    if consumers is not None:
        for i in range(len(consumers)):
            if str(consumers.consumer_ids[i]) == consumer_id:
                subdivision_id = str(consumers.subdivision_ids[i])
                break

    row = {
        "id": f"out_{field_api.uuid.uuid4().hex[:8]}",
        "consumer_id": consumer_id,
        "dt_id": body.dt_id,
        "subdivision_id": subdivision_id,
        "description": body.description,
        "status": "reported",
        "created_at": field_api.datetime.now(field_api.UTC).isoformat(),
    }
    field_api._outages.append(row)  # noqa: SLF001
    return {"id": row["id"]}


__all__ = ["router", "register_message_text"]
