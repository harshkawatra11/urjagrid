"""OCPP 1.6J ``SetChargingProfile`` adapter (WIRED) for e-rickshaw/EV managed
charging hubs (Flex Plan lever 2).

Builds the real OCPP 1.6J Central-System-to-Charge-Point ``SetChargingProfile.req``
message shape and validates every outgoing payload against a JSON Schema
(via ``jsonschema``) before it is logged to the ``ProtocolLedger`` -- a
malformed payload never reaches "the wire" (the in-process ``MockChargePoint``).
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass

import jsonschema

from app.adapters.ledger import MessageDirection, MessageStatus, ProtocolLedger

SET_CHARGING_PROFILE_SCHEMA: dict = {
    "type": "object",
    "required": ["connectorId", "csChargingProfiles"],
    "properties": {
        "connectorId": {"type": "integer", "minimum": 0},
        "csChargingProfiles": {
            "type": "object",
            "required": [
                "chargingProfileId",
                "stackLevel",
                "chargingProfilePurpose",
                "chargingProfileKind",
                "chargingSchedule",
            ],
            "properties": {
                "chargingProfileId": {"type": "integer"},
                "stackLevel": {"type": "integer", "minimum": 0},
                "chargingProfilePurpose": {
                    "type": "string",
                    "enum": ["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"],
                },
                "chargingProfileKind": {
                    "type": "string",
                    "enum": ["Absolute", "Recurring", "Relative"],
                },
                "chargingSchedule": {
                    "type": "object",
                    "required": ["chargingRateUnit", "chargingSchedulePeriod"],
                    "properties": {
                        "duration": {"type": "integer", "minimum": 0},
                        "startSchedule": {"type": "string"},
                        "chargingRateUnit": {"type": "string", "enum": ["W", "A"]},
                        "chargingSchedulePeriod": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                                "type": "object",
                                "required": ["startPeriod", "limit"],
                                "properties": {
                                    "startPeriod": {"type": "integer", "minimum": 0},
                                    "limit": {"type": "number", "minimum": 0},
                                    "numberPhases": {"type": "integer"},
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

_profile_id_counter = itertools.count(1)


@dataclass
class ChargingProfileRequest:
    hub_id: str
    connector_id: int
    limit_w: float
    duration_seconds: int
    start_schedule_iso: str

    def to_ocpp_payload(self) -> dict:
        profile_id = next(_profile_id_counter)
        return {
            "connectorId": self.connector_id,
            "csChargingProfiles": {
                "chargingProfileId": profile_id,
                "stackLevel": 0,
                "chargingProfilePurpose": "TxDefaultProfile",
                "chargingProfileKind": "Absolute",
                "chargingSchedule": {
                    "duration": self.duration_seconds,
                    "startSchedule": self.start_schedule_iso,
                    "chargingRateUnit": "W",
                    "chargingSchedulePeriod": [
                        {"startPeriod": 0, "limit": self.limit_w},
                    ],
                },
            },
        }


def validate_set_charging_profile(payload: dict) -> None:
    """Raise ``jsonschema.ValidationError`` if ``payload`` doesn't match the
    OCPP 1.6J ``SetChargingProfile.req`` shape.
    """
    jsonschema.validate(instance=payload, schema=SET_CHARGING_PROFILE_SCHEMA)


class MockChargePoint:
    """Simulated OCPP charge point: validates and acknowledges a charging
    profile, logging every exchange to the ``ProtocolLedger``.
    """

    def __init__(self, ledger: ProtocolLedger) -> None:
        self.ledger = ledger
        self.active_profiles: dict[str, dict] = {}

    def set_charging_profile(self, request: ChargingProfileRequest, correlation_id: str) -> bool:
        payload = request.to_ocpp_payload()
        validate_set_charging_profile(payload)
        self.ledger.record(
            "ocpp", MessageDirection.OUTBOUND, payload,
            status=MessageStatus.SENT, correlation_id=correlation_id,
        )
        self.active_profiles[request.hub_id] = payload
        self.ledger.record(
            "ocpp",
            MessageDirection.INBOUND,
            {"hub_id": request.hub_id, "status": "Accepted"},
            status=MessageStatus.ACKED,
            correlation_id=correlation_id,
        )
        return True


__all__ = [
    "SET_CHARGING_PROFILE_SCHEMA",
    "ChargingProfileRequest",
    "validate_set_charging_profile",
    "MockChargePoint",
]
