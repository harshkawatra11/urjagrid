"""HES/DLMS-COSEM load-limiter adapter (WIRED).

Real DLMS/COSEM load limiting is done via the ``Disconnect Control`` /
``Limiter`` IC (Class ID 71) on a smart meter, addressed through the DISCOM's
Head-End System (HES). This module builds spec-shaped JSON payloads that
mirror that object model's key attributes (``normal_value_w``,
``emergency_profile``) closely enough to be a believable "what the HES would
send" artefact, without a real HES/MDM integration (PILOT, not built).

Every load-limit command carries an explicit ``expires_at`` and must be
issued at least ``NOTICE_MIN_CAPS`` minutes before ``effective_at`` -- both
are hard safety invariants (see ``tests/test_invariants.py``) enforced here,
not just downstream, so no caller can construct a non-compliant command.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime

from app.adapters.ledger import MessageDirection, MessageStatus, ProtocolLedger
from app.grid.constants import HES_ACK_PROB, LIFELINE_FLOOR_W, NOTICE_MIN_CAPS


class LoadLimitError(ValueError):
    """Raised when a load-limit command would violate a hard safety invariant."""


@dataclass
class LoadLimitCommand:
    target_id: str
    limit_w: float
    effective_at: datetime
    expires_at: datetime
    issued_at: datetime
    tier: str = "t1"

    def to_dlms_payload(self) -> dict:
        """DLMS/COSEM-shaped payload: Limiter IC (class_id=71) attributes."""
        return {
            "class_id": 71,
            "obis_code": "0.0.17.0.0.255",
            "target_id": self.target_id,
            "attributes": {
                "normal_value_w": self.limit_w,
                "emergency_profile_active": True,
                "effective_at": self.effective_at.isoformat(),
                "expires_at": self.expires_at.isoformat(),
            },
            "issued_at": self.issued_at.isoformat(),
        }


def build_load_limit_command(
    target_id: str,
    limit_w: float,
    effective_at: datetime,
    expires_at: datetime,
    issued_at: datetime,
    tier: str = "t1",
) -> LoadLimitCommand:
    """Construct a ``LoadLimitCommand``, enforcing the lifeline-floor and
    minimum-notice hard safety invariants before a command can even be built.
    """
    if tier in ("t1", "t2") and limit_w < LIFELINE_FLOOR_W:
        raise LoadLimitError(
            f"load limit {limit_w}W for tier {tier!r} is below the "
            f"{LIFELINE_FLOOR_W}W lifeline floor"
        )
    if tier == "t0":
        raise LoadLimitError("T0 critical/life-support consumers may never be capped")
    notice_minutes = (effective_at - issued_at).total_seconds() / 60.0
    if notice_minutes < NOTICE_MIN_CAPS:
        raise LoadLimitError(
            f"load-limit notice is {notice_minutes:.0f} min; "
            f"minimum required is {NOTICE_MIN_CAPS} min"
        )
    if expires_at <= effective_at:
        raise LoadLimitError("expires_at must be after effective_at")
    return LoadLimitCommand(
        target_id=target_id,
        limit_w=limit_w,
        effective_at=effective_at,
        expires_at=expires_at,
        issued_at=issued_at,
        tier=tier,
    )


class MockHes:
    """Simulated HES gateway: accepts a ``LoadLimitCommand`` and probabilistically
    acknowledges it (``HES_ACK_PROB``), logging every exchange to the ledger.
    """

    def __init__(
        self,
        ledger: ProtocolLedger,
        ack_probability: float = HES_ACK_PROB,
        rng: random.Random | None = None,
    ) -> None:
        self.ledger = ledger
        self.ack_probability = ack_probability
        self._rng = rng or random.Random(0)

    def send_load_limit(self, command: LoadLimitCommand, correlation_id: str) -> bool:
        payload = command.to_dlms_payload()
        self.ledger.record(
            "dlms_hes",
            MessageDirection.OUTBOUND,
            payload,
            status=MessageStatus.SENT,
            correlation_id=correlation_id,
        )
        acked = self._rng.random() < self.ack_probability
        self.ledger.record(
            "dlms_hes",
            MessageDirection.INBOUND,
            {"target_id": command.target_id, "acked": acked},
            status=MessageStatus.ACKED if acked else MessageStatus.FAILED,
            correlation_id=correlation_id,
        )
        return acked

    def clear_load_limit(self, target_id: str, correlation_id: str) -> None:
        self.ledger.record(
            "dlms_hes",
            MessageDirection.OUTBOUND,
            {"class_id": 71, "target_id": target_id, "action": "clear_limit"},
            status=MessageStatus.SENT,
            correlation_id=correlation_id,
        )


__all__ = ["LoadLimitError", "LoadLimitCommand", "build_load_limit_command", "MockHes"]
