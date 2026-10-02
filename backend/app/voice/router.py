"""``WS /ws/voice`` -- the Urja voice pipeline endpoint (B12).

Message protocol (JSON over the WebSocket, kept simple/text-first so it is
testable without a live STT/TTS key): the client sends
``{"text": "...", "language": "hi"|"en"|"hinglish"}`` (a transcript -- from
real audio via Sarvam STT when ``SARVAM_API_KEY`` is configured, or typed
directly in a text-first client/test); the server replies with
``{"reply_text": "...", "grounded": bool, "audio_url": "/api/v1/consumers/messages/{id}/audio"}``.
Urja is read-only: she is built from the same ``AskAgent`` + read-only tool
layer as the dashboard's typed Ask feature (B11), so she structurally cannot
approve/reject/dispatch anything.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.agents.ask_agent import AskAgent, llm_client_from_env
from app.api.v1.consumers import register_message_text
from app.services.deps import get_grid_service
from app.services.service import GridService
from app.tools.grid_tools import build_tool_functions
from app.tools.schemas import TOOL_SCHEMAS
from app.voice.voice_prompt import build_system_prompt

router = APIRouter(tags=["voice"])


def build_ask_agent(service: GridService, language: str = "en") -> AskAgent:
    return AskAgent(
        client=llm_client_from_env(),
        tools=build_tool_functions(service),
        tool_schemas=TOOL_SCHEMAS,
        system_prompt=build_system_prompt(language),
    )


@router.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket, service: GridService = Depends(get_grid_service)) -> None:
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            text = payload.get("text", "")
            language = payload.get("language", "en")
            agent = build_ask_agent(service, language)
            result = agent.ask(text)
            message_id = f"msg_{uuid.uuid4().hex[:8]}"
            register_message_text(message_id, result["text"] or "")
            await websocket.send_json(
                {
                    "reply_text": result["text"],
                    "grounded": result["grounded"],
                    "audio_url": f"/api/v1/consumers/messages/{message_id}/audio",
                }
            )
    except WebSocketDisconnect:
        return


__all__ = ["router", "build_ask_agent"]
