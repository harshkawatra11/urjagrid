import io
import wave

import pytest

from app.voice.tts import MockTtsClient, SarvamTtsClient, tts_client_from_env


def test_mock_tts_produces_valid_wav_bytes() -> None:
    client = MockTtsClient()
    wav_bytes = client.synthesize("LifelineGrid: bijli mausam update")
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        assert wav_file.getnchannels() == 1
        assert wav_file.getframerate() == 8000


def test_mock_tts_empty_text_still_returns_valid_wav() -> None:
    client = MockTtsClient()
    wav_bytes = client.synthesize("")
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        assert wav_file.getnframes() >= 0


def test_tts_client_from_env_defaults_to_mock_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    client = tts_client_from_env()
    assert isinstance(client, MockTtsClient)


def test_tts_client_from_env_uses_sarvam_when_key_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SARVAM_API_KEY", "fake-key-for-test")
    client = tts_client_from_env()
    assert isinstance(client, SarvamTtsClient)
    assert client.api_key == "fake-key-for-test"


def test_sarvam_client_synthesize_uses_mocked_http(monkeypatch: pytest.MonkeyPatch) -> None:
    import base64

    client = SarvamTtsClient(api_key="fake")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"audios": [base64.b64encode(b"RIFF....fake-wav-bytes").decode()]}

    def fake_post(*args, **kwargs):  # noqa: ANN002, ANN003
        return FakeResponse()

    import httpx

    monkeypatch.setattr(httpx, "post", fake_post)
    audio = client.synthesize("test", language="hi")
    assert audio == b"RIFF....fake-wav-bytes"
