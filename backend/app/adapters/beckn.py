"""Beckn/UEI (Unified Energy Interface) adapter (WIRED) for peer-to-peer
storage-discharge trade confirmation (Flex Plan lever 4, storage settlement).

Beckn is a decentralised discovery/order protocol (search -> on_search ->
select -> init -> confirm -> on_confirm). This module builds the
``confirm``/``on_confirm`` message shapes a real Beckn/UEI energy-trading
network would exchange when UrjaGrid settles a P2P storage-discharge
transaction, at ``P2P_CHARGE_RS_PER_KWH``.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from app.adapters.ledger import MessageDirection, MessageStatus, ProtocolLedger
from app.grid.constants import P2P_CHARGE_RS_PER_KWH


@dataclass
class TradeConfirmRequest:
    seller_asset_id: str
    buyer_dt_id: str
    energy_kwh: float
    rate_rs_per_kwh: float = P2P_CHARGE_RS_PER_KWH

    @property
    def total_rs(self) -> float:
        return round(self.energy_kwh * self.rate_rs_per_kwh, 2)

    def to_confirm_message(self, transaction_id: str) -> dict:
        return {
            "context": {
                "domain": "energy:uei",
                "action": "confirm",
                "transaction_id": transaction_id,
                "timestamp": datetime.now(UTC).isoformat(),
            },
            "message": {
                "order": {
                    "provider": {"id": self.seller_asset_id},
                    "items": [
                        {
                            "id": "storage_discharge",
                            "quantity": {"measure": {"value": self.energy_kwh, "unit": "kWh"}},
                        }
                    ],
                    "billing": {"name": self.buyer_dt_id},
                    "quote": {
                        "price": {"currency": "INR", "value": str(self.total_rs)},
                        "breakup": [
                            {
                                "title": "p2p_storage_discharge",
                                "price": {"currency": "INR", "value": str(self.total_rs)},
                            }
                        ],
                    },
                }
            },
        }


class BecknGateway:
    """In-process Beckn BPP (seller-side gateway): confirms a trade and
    returns the ``on_confirm`` acknowledgement, logged to the ledger.
    """

    def __init__(self, ledger: ProtocolLedger) -> None:
        self.ledger = ledger

    def confirm_trade(self, request: TradeConfirmRequest) -> dict:
        transaction_id = f"txn_{uuid.uuid4().hex[:10]}"
        confirm_msg = request.to_confirm_message(transaction_id)
        self.ledger.record(
            "beckn",
            MessageDirection.OUTBOUND,
            confirm_msg,
            status=MessageStatus.SENT,
            correlation_id=transaction_id,
        )
        on_confirm = {
            "context": {**confirm_msg["context"], "action": "on_confirm"},
            "message": {"order": {**confirm_msg["message"]["order"], "state": "Completed"}},
        }
        self.ledger.record(
            "beckn",
            MessageDirection.INBOUND,
            on_confirm,
            status=MessageStatus.ACKED,
            correlation_id=transaction_id,
        )
        return on_confirm


__all__ = ["TradeConfirmRequest", "BecknGateway"]
