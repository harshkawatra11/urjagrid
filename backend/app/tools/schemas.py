"""OpenAI function-calling-dialect schemas for the 15 read-only grid tools
(B11). ``TOOL_SCHEMAS`` is consumed directly by the Gemini typed Ask agent
(Gemini's function-calling tool-schema shape is a near-superset of OpenAI's,
and ``google-genai`` accepts this dialect) and by any evaluation harness
that needs to list what Urja/Ask can look up.
"""

from __future__ import annotations

TOOL_SCHEMAS: list[dict] = [
    {
        "name": "resolve_entity",
        "description": "Fuzzy-resolve a spoken/typed name (e.g. 'Subhash Nagar') to a canonical grid entity id.",  # noqa: E501
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "list_subdivisions",
        "description": "List every sub-division with its feeder/transformer counts.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "list_feeders",
        "description": "List feeders, optionally filtered by sub-division id.",
        "parameters": {
            "type": "object",
            "properties": {"subdivision_id": {"type": "string"}},
        },
    },
    {
        "name": "list_transformers",
        "description": "List distribution transformers, optionally filtered by sub-division id.",
        "parameters": {
            "type": "object",
            "properties": {"subdivision_id": {"type": "string"}},
        },
    },
    {
        "name": "get_transformer",
        "description": "Get one transformer's static details by id.",
        "parameters": {
            "type": "object",
            "properties": {"dt_id": {"type": "string"}},
            "required": ["dt_id"],
        },
    },
    {
        "name": "list_critical_facilities",
        "description": "List T0 critical/life-support consumers (never capped, asked, or shed).",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_forecast",
        "description": "Get the 36h demand/supply/gap forecast bundle for a sub-division.",
        "parameters": {
            "type": "object",
            "properties": {"subdivision_id": {"type": "string"}},
            "required": ["subdivision_id"],
        },
    },
    {
        "name": "list_plans",
        "description": "List Flex Plans, optionally filtered by sub-division id.",
        "parameters": {
            "type": "object",
            "properties": {"subdivision_id": {"type": "string"}},
        },
    },
    {
        "name": "get_plan",
        "description": "Get one Flex Plan's full detail by id.",
        "parameters": {
            "type": "object",
            "properties": {"plan_id": {"type": "string"}},
            "required": ["plan_id"],
        },
    },
    {
        "name": "get_kpis",
        "description": "Get current aggregate reliability/relief KPIs for the running scenario.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_risk_ranking",
        "description": "Get DTs ranked by current thermal/forecast risk.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_protocol_summary",
        "description": "Get a summary of recent protocol-adapter traffic (HES/OCPP/OpenADR/Beckn/channels).",  # noqa: E501
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_lever_status",
        "description": "Get which Flex Plan levers (DR/hub/storage/caps) are currently active, and where.",  # noqa: E501
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_unit_economics",
        "description": "Get the current unit-economics estimate (software fee, DR rebate cost, avoided-shedding value).",  # noqa: E501
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_scenario_names",
        "description": "List the names of the built-in weather scenarios available in the Scenario Lab.",  # noqa: E501
        "parameters": {"type": "object", "properties": {}},
    },
]

CONSUMER_TOOL_SCHEMAS: list[dict] = [
    {
        "name": "get_my_connection_status",
        "description": "Get the calling consumer's current meter state (normal/DR-active/capped/shed).",  # noqa: E501
        "parameters": {
            "type": "object",
            "properties": {"consumer_id": {"type": "string"}},
            "required": ["consumer_id"],
        },
    },
    {
        "name": "get_my_cap_status",
        "description": "Get whether the calling consumer currently has an active lifeline cap, and its expiry.",  # noqa: E501
        "parameters": {
            "type": "object",
            "properties": {"consumer_id": {"type": "string"}},
            "required": ["consumer_id"],
        },
    },
    {
        "name": "get_my_dr_history",
        "description": "Get the calling consumer's recent demand-response participation and rebate earned.",  # noqa: E501
        "parameters": {
            "type": "object",
            "properties": {"consumer_id": {"type": "string"}},
            "required": ["consumer_id"],
        },
    },
    {
        "name": "get_my_messages",
        "description": "Get the calling consumer's recent WhatsApp/IVR/SMS messages from LifelineGrid.",  # noqa: E501
        "parameters": {
            "type": "object",
            "properties": {"consumer_id": {"type": "string"}},
            "required": ["consumer_id"],
        },
    },
]

__all__ = ["TOOL_SCHEMAS", "CONSUMER_TOOL_SCHEMAS"]
