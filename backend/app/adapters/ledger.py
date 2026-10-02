"""``ProtocolLedger``: a single append-only log of every message UrjaGrid
sends/receives through its 7 protocol adapters, all tagged WIRED (spec-shaped
code against an in-process simulator, not real hardware/production
messaging). The dashboard's ``/protocols`` page (D25) and the fixtures export
(B13) both read this ledger, which is why every adapter in this package
routes its traffic through it rather than logging independently.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

# The 7 protocols, all WIRED.
PROTOCOL_NAMES: tuple[str, ...] = (
    "dlms_hes",
    "ocpp",
    "openadr",
    "beckn",
    "whatsapp",
    "ivr",
    "sms",
)


class MessageDirection(StrEnum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class MessageStatus(StrEnum):
    SENT = "sent"
    ACKED = "acked"
    FAILED = "failed"
    QUEUED = "queued"


@dataclass
class LedgerEntry:
    id: int
    protocol: str
    direction: MessageDirection
    status: MessageStatus
    payload: dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    correlation_id: str | None = None
    note: str | None = None

    def to_view(self) -> dict[str, Any]:
        # `frontend/src/lib/api/types.ts#ProtocolMessageRecord` spells the
        # DLMS/HES protocol "hes" and has no `dlms_` prefix; translate just
        # for the wire label, since `PROTOCOL_NAMES`/adapters elsewhere use
        # the DLMS-accurate "dlms_hes" name throughout the ledger/B7 tests.
        wire_protocol = "hes" if self.protocol == "dlms_hes" else self.protocol
        return {
            "id": self.id,
            "protocol": self.protocol,
            "wireProtocol": wire_protocol,
            "status_tag": "WIRED",
            "statusTag": "WIRED",
            "direction": self.direction.value,
            "status": self.status.value,
            "summary": self.note or f"{wire_protocol} {self.direction.value} ({self.status.value})",
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
            "timestampIso": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id,
            "correlationId": self.correlation_id,
            "note": self.note,
        }


class ProtocolLedger:
    """In-memory, append-only ledger of adapter traffic."""

    def __init__(self) -> None:
        self._entries: list[LedgerEntry] = []
        self._counter = itertools.count(1)

    def record(
        self,
        protocol: str,
        direction: MessageDirection,
        payload: dict[str, Any],
        status: MessageStatus = MessageStatus.SENT,
        correlation_id: str | None = None,
        note: str | None = None,
    ) -> LedgerEntry:
        if protocol not in PROTOCOL_NAMES:
            raise ValueError(f"unknown protocol {protocol!r}; must be one of {PROTOCOL_NAMES}")
        entry = LedgerEntry(
            id=next(self._counter),
            protocol=protocol,
            direction=direction,
            status=status,
            payload=payload,
            correlation_id=correlation_id,
            note=note,
        )
        self._entries.append(entry)
        return entry

    def update_status(self, entry_id: int, status: MessageStatus) -> LedgerEntry:
        for entry in self._entries:
            if entry.id == entry_id:
                entry.status = status
                return entry
        raise KeyError(f"no ledger entry with id {entry_id}")

    def all(self) -> list[LedgerEntry]:
        return list(self._entries)

    def by_protocol(self, protocol: str) -> list[LedgerEntry]:
        return [e for e in self._entries if e.protocol == protocol]

    def by_correlation(self, correlation_id: str) -> list[LedgerEntry]:
        return [e for e in self._entries if e.correlation_id == correlation_id]

    def counts_by_protocol(self) -> dict[str, int]:
        counts = dict.fromkeys(PROTOCOL_NAMES, 0)
        for e in self._entries:
            counts[e.protocol] += 1
        return counts


__all__ = [
    "PROTOCOL_NAMES",
    "MessageDirection",
    "MessageStatus",
    "LedgerEntry",
    "ProtocolLedger",
]
