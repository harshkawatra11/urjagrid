"""OpenADR 3 REST adapter (WIRED) for shiftable public loads (water pumps,
telecom towers -- Flex Plan lever 3).

OpenADR 3 is REST/JSON (unlike 2.0b's XML/EiEvent push model): a VTN
(Virtual Top Node, the DISCOM) exposes ``programs``/``events``/``reports``
resources that a VEN (Virtual End Node, the pump/tower controller) polls.
This module builds the ``event`` resource shape a real OpenADR 3 VTN would
serve, and a ``MockVen`` that polls for it and "subscribes" (pauses/resumes)
accordingly, logged through the ``ProtocolLedger``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.adapters.ledger import MessageDirection, MessageStatus, ProtocolLedger


@dataclass
class OpenAdrEvent:
    event_id: str
    program_id: str
    target_ids: list[str]
    start: datetime
    duration_minutes: int
    value: float = 0.0  # 0 = full curtailment (pause), 1 = no curtailment

    def to_resource(self) -> dict:
        return {
            "id": self.event_id,
            "programID": self.program_id,
            "eventName": "lifelinegrid-shed-event",
            "intervalPeriod": {
                "start": self.start.isoformat(),
                "durationMinutes": self.duration_minutes,
            },
            "targets": [{"type": "ASSET_ID", "values": [t]} for t in self.target_ids],
            "intervals": [
                {"id": 0, "payloads": [{"type": "SIMPLE", "values": [self.value]}]},
            ],
        }


@dataclass
class OpenAdrProgram:
    program_id: str
    program_name: str = "lifelinegrid-shiftable-loads"
    events: list[OpenAdrEvent] = field(default_factory=list)


class OpenAdrVtn:
    """In-process VTN: holds programs/events, served to polling VENs."""

    def __init__(self, ledger: ProtocolLedger) -> None:
        self.ledger = ledger
        self.programs: dict[str, OpenAdrProgram] = {}

    def publish_event(self, program_id: str, event: OpenAdrEvent, correlation_id: str) -> None:
        program = self.programs.setdefault(program_id, OpenAdrProgram(program_id=program_id))
        program.events.append(event)
        self.ledger.record(
            "openadr",
            MessageDirection.OUTBOUND,
            event.to_resource(),
            status=MessageStatus.SENT,
            correlation_id=correlation_id,
        )

    def poll_events(self, program_id: str, ven_target_id: str) -> list[dict]:
        program = self.programs.get(program_id)
        if program is None:
            return []
        matching = [e.to_resource() for e in program.events if ven_target_id in e.target_ids]
        self.ledger.record(
            "openadr",
            MessageDirection.INBOUND,
            {"ven_target_id": ven_target_id, "polled_events": len(matching)},
            status=MessageStatus.ACKED,
        )
        return matching


class MockVen:
    """Simulated shiftable-load controller: polls the VTN and tracks whether
    it is currently paused (curtailed) by the most recent event.
    """

    def __init__(self, vtn: OpenAdrVtn, target_id: str) -> None:
        self.vtn = vtn
        self.target_id = target_id
        self.paused = False

    def poll(self, program_id: str) -> bool:
        events = self.vtn.poll_events(program_id, self.target_id)
        if events:
            latest = events[-1]
            value = latest["intervals"][0]["payloads"][0]["values"][0]
            self.paused = value <= 0.0
        return self.paused


__all__ = ["OpenAdrEvent", "OpenAdrProgram", "OpenAdrVtn", "MockVen"]
