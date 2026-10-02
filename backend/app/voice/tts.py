"""Text-to-speech integration point: Sarvam AI ``bulbul:v3`` (speaker
"simran"), behind a ``TtsClient`` protocol so the voice pipeline and the
``GET /api/v1/consumers/messages/{id}/audio`` endpoint run identically
whether or not ``SARVAM_API_KEY`` is configured.
"""

from __future__ import annotations

import io
import math
import os
import struct
import wave
from typing import Protocol

SARVAM_TTS_MODEL = "bulbul:v3"
SARVAM_TTS_SPEAKER = "simran"
SARVAM_TTS_ENDPOINT = "https://api.sarvam.ai/text-to-speech"

_SAMPLE_RATE = 8000


class TtsClient(Protocol):
    def synthesize(self, text: str, language: str = "hi") -> bytes: ...


def _silent_wav(duration_seconds: float = 0.5, sample_rate: int = _SAMPLE_RATE) -> bytes:
    """A valid, playable (silent) mono 16-bit PCM WAV -- used whenever no
    live TTS key is configured, so the audio endpoint's contract (a real
    WAV byte stream) is always honoured.
    """
    n_samples = int(duration_seconds * sample_rate)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(struct.pack(f"<{n_samples}h", *([0] * n_samples)))
    return buffer.getvalue()


def _tone_wav(
    frequency_hz: float, duration_seconds: float, sample_rate: int = _SAMPLE_RATE
) -> bytes:
    """A simple sine-tone WAV -- used by the mock client so different texts
    produce audibly distinguishable (if not intelligible) mock audio.
    """
    n_samples = int(duration_seconds * sample_rate)
    samples = [
        int(3000 * math.sin(2 * math.pi * frequency_hz * i / sample_rate)) for i in range(n_samples)
    ]
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(struct.pack(f"<{n_samples}h", *samples))
    return buffer.getvalue()


class MockTtsClient:
    """Default, no-network TTS client: deterministic tone-per-text-length WAV."""

    def synthesize(self, text: str, language: str = "hi") -> bytes:  # noqa: ARG002
        if not text:
            return _silent_wav()
        duration = min(0.25 + 0.02 * len(text), 4.0)
        frequency = 220.0 + (hash(text) % 200)
        return _tone_wav(frequency, duration)


class SarvamTtsClient:
    """Real Sarvam AI ``bulbul:v3`` client. Only constructed when
    ``SARVAM_API_KEY`` is set; network calls happen lazily inside
    ``synthesize`` so importing/constructing this class never requires
    network access (only calling it does).
    """

    def __init__(self, api_key: str, speaker: str = SARVAM_TTS_SPEAKER) -> None:
        self.api_key = api_key
        self.speaker = speaker

    def synthesize(self, text: str, language: str = "hi") -> bytes:
        import httpx

        response = httpx.post(
            SARVAM_TTS_ENDPOINT,
            headers={"API-Subscription-Key": self.api_key},
            json={
                "inputs": [text],
                "target_language_code": "hi-IN" if language == "hi" else "en-IN",
                "speaker": self.speaker,
                "model": SARVAM_TTS_MODEL,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        import base64

        audio_b64 = response.json()["audios"][0]
        return base64.b64decode(audio_b64)


def tts_client_from_env() -> TtsClient:
    """Build the TTS client to use: real Sarvam client if ``SARVAM_API_KEY``
    is set, else the mock client -- the default in every test/demo run
    without live credentials.
    """
    api_key = os.environ.get("SARVAM_API_KEY")
    if api_key:
        return SarvamTtsClient(api_key)
    return MockTtsClient()


__all__ = [
    "SARVAM_TTS_MODEL",
    "SARVAM_TTS_SPEAKER",
    "TtsClient",
    "MockTtsClient",
    "SarvamTtsClient",
    "tts_client_from_env",
]
