"""Protocol adapters (Lane B, task B3): HES/DLMS, OCPP, OpenADR, Beckn/UEI,
and consumer channels (WhatsApp/IVR/SMS), all logged through a shared
``ProtocolLedger``. Every adapter here is tagged WIRED (docs/SPEC.md honest
status matrix): spec-shaped code paths against an in-process simulator, not
real hardware/production messaging.
"""
