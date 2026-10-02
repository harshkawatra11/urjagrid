"""Consumer channel gateway (WIRED): WhatsApp / IVR / SMS, bilingual (hi/en),
mock transport by default, optional Twilio sandbox transport behind an env
flag (``LIFELINE_TWILIO_ENABLED``). Every message -- outbound notice, DR ask,
cap warning, or inbound reply -- is logged to the ``ProtocolLedger``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

from app.adapters.ledger import MessageDirection, MessageStatus, ProtocolLedger

CHANNEL_NAMES: tuple[str, ...] = ("whatsapp", "ivr", "sms")

# Bilingual (Hindi first, per spec "Hindi notices"; English second) message
# templates, keyed by template name. ``{}``-style placeholders are filled by
# ``ChannelGateway.render``.
TEMPLATES: dict[str, dict[str, str]] = {
    "dr_ask": {
        "hi": (
            "LifelineGrid: Aaj shaam {start_time} se {end_time} tak bijli kam ho sakti hai. "
            "Apna AC/geyser thoda kam istemal karein aur Rs {rebate}/unit bachat kamayein."
        ),
        "en": (
            "LifelineGrid: Power may be tight from {start_time} to {end_time} this evening. "
            "Reduce AC/geyser use and earn a Rs {rebate}/unit bill rebate."
        ),
    },
    "cap_notice": {
        "hi": (
            "LifelineGrid: {start_time} baje se aapke connection par {limit_w}W ki simit lagai "
            "jayegi jo {end_time} baje tak rahegi. Zaroori upkaran chalte rahenge."
        ),
        "en": (
            "LifelineGrid: From {start_time}, your connection will be limited to {limit_w}W "
            "until {end_time}. Essential appliances will keep working."
        ),
    },
    "outage_notice": {
        "hi": "LifelineGrid: Maintenance ke karan {start_time} se {end_time} tak bijli band rahegi.",  # noqa: E501
        "en": "LifelineGrid: Power will be off for maintenance from {start_time} to {end_time}.",
    },
    "relief_confirmed": {
        "hi": "LifelineGrid: Dhanyavaad! Aapke sahyog se {relief_kwh} kWh ki bachat hui. Rebate credited.",  # noqa: E501
        "en": "LifelineGrid: Thank you! Your cooperation saved {relief_kwh} kWh. Rebate credited.",
    },
}


@dataclass
class OutboundMessage:
    channel: str
    recipient_id: str
    template: str
    language: str
    text: str
    consumer_id: str | None = None


class Transport(Protocol):
    def send(self, message: OutboundMessage) -> bool: ...


class MockTransport:
    """Default transport: no network I/O, always "delivers"."""

    def send(self, message: OutboundMessage) -> bool:  # noqa: ARG002
        return True


class TwilioSandboxTransport:
    """Optional Twilio WhatsApp-sandbox transport, only constructed when
    ``LIFELINE_TWILIO_ENABLED=true`` and Twilio credentials are configured;
    otherwise ``ChannelGateway`` falls back to ``MockTransport``.
    """

    def __init__(self, account_sid: str, auth_token: str, from_number: str) -> None:
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    def send(self, message: OutboundMessage) -> bool:
        try:
            from twilio.rest import Client  # type: ignore[import-not-found]
        except ImportError:
            return False
        client = Client(self.account_sid, self.auth_token)
        client.messages.create(body=message.text, from_=self.from_number, to=message.recipient_id)
        return True


def transport_from_env(ledger: ProtocolLedger | None = None) -> Transport:  # noqa: ARG001
    """Build the transport to use: Twilio sandbox if explicitly enabled and
    configured, else the mock transport (the default in every test/demo run).
    """
    if os.environ.get("LIFELINE_TWILIO_ENABLED", "").lower() in ("1", "true", "yes"):
        sid = os.environ.get("TWILIO_ACCOUNT_SID")
        token = os.environ.get("TWILIO_AUTH_TOKEN")
        from_number = os.environ.get("TWILIO_FROM_NUMBER")
        if sid and token and from_number:
            return TwilioSandboxTransport(sid, token, from_number)
    return MockTransport()


class ChannelGateway:
    """Renders bilingual templates and sends/logs them over a channel."""

    def __init__(self, ledger: ProtocolLedger, transport: Transport | None = None) -> None:
        self.ledger = ledger
        self.transport = transport or MockTransport()

    def render(self, template: str, language: str, **kwargs: object) -> str:
        if template not in TEMPLATES:
            raise ValueError(f"unknown template {template!r}")
        if language not in ("hi", "en"):
            raise ValueError("language must be 'hi' or 'en'")
        return TEMPLATES[template][language].format(**kwargs)

    def send_one(
        self,
        channel: str,
        recipient_id: str,
        template: str,
        language: str = "hi",
        consumer_id: str | None = None,
        **kwargs: object,
    ) -> bool:
        if channel not in CHANNEL_NAMES:
            raise ValueError(f"unknown channel {channel!r}; must be one of {CHANNEL_NAMES}")
        text = self.render(template, language, **kwargs)
        message = OutboundMessage(
            channel=channel,
            recipient_id=recipient_id,
            template=template,
            language=language,
            text=text,
            consumer_id=consumer_id,
        )
        delivered = self.transport.send(message)
        self.ledger.record(
            channel,
            MessageDirection.OUTBOUND,
            {
                "recipient_id": recipient_id,
                "template": template,
                "language": language,
                "text": text,
            },
            status=MessageStatus.SENT if delivered else MessageStatus.FAILED,
            correlation_id=consumer_id,
        )
        return delivered

    def broadcast(
        self,
        channel: str,
        recipient_ids: list[str],
        template: str,
        language: str = "hi",
        **kwargs: object,
    ) -> dict[str, bool]:
        return {
            recipient_id: self.send_one(
                channel, recipient_id, template, language, consumer_id=recipient_id, **kwargs
            )
            for recipient_id in recipient_ids
        }

    def reply(self, channel: str, sender_id: str, text: str) -> None:
        """Log an inbound reply (e.g. a consumer accepting a DR ask over IVR/WhatsApp)."""
        if channel not in CHANNEL_NAMES:
            raise ValueError(f"unknown channel {channel!r}; must be one of {CHANNEL_NAMES}")
        self.ledger.record(
            channel,
            MessageDirection.INBOUND,
            {"sender_id": sender_id, "text": text},
            status=MessageStatus.ACKED,
            correlation_id=sender_id,
        )


__all__ = [
    "CHANNEL_NAMES",
    "TEMPLATES",
    "OutboundMessage",
    "Transport",
    "MockTransport",
    "TwilioSandboxTransport",
    "transport_from_env",
    "ChannelGateway",
]
