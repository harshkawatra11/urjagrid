"""Speech-to-text integration point: Sarvam AI ``saaras:v3-realtime``, behind
an ``SttClient`` protocol so the voice pipeline runs identically whether or
not ``SARVAM_API_KEY`` is configured (same approach as ``tts.py``).
"""

from __future__ import annotations

import os
from typing import Protocol

SARVAM_STT_MODEL = "saaras:v3-realtime"
SARVAM_STT_ENDPOINT = "https://api.sarvam.ai/speech-to-text"


class SttClient(Protocol):
    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> str: ...


class MockSttClient:
    """No-network stub: real audio bytes never arrive without a live STT
    key, so the mock simply reports that no live transcription happened
    (callers falling back to a WebSocket text message instead, see
    ``voice/router.py``).
    """

    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> str:  # noqa: ARG002
        return ""


class SarvamSttClient:
    """Real Sarvam AI ``saaras:v3-realtime`` client. Network calls happen
    lazily inside ``transcribe``.
    """

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> str:
        import httpx

        response = httpx.post(
            SARVAM_STT_ENDPOINT,
            headers={"API-Subscription-Key": self.api_key},
            files={"file": ("audio.wav", audio_bytes, "audio/wav")},
            data={
                "model": SARVAM_STT_MODEL,
                "language_code": "hi-IN" if language == "hi" else "en-IN",
            },
            timeout=20.0,
        )
        response.raise_for_status()
        return response.json().get("transcript", "")


def stt_client_from_env() -> SttClient:
    api_key = os.environ.get("SARVAM_API_KEY")
    if api_key:
        return SarvamSttClient(api_key)
    return MockSttClient()


__all__ = [
    "SARVAM_STT_MODEL",
    "SttClient",
    "MockSttClient",
    "SarvamSttClient",
    "stt_client_from_env",
]
