"""Deploy/secrets helper (B13): checks which environment variables the
backend wants (``core/config.Settings`` + the optional external-service
keys ``GEMINI_API_KEY``/``SARVAM_API_KEY``/Twilio) are set in the current
environment, and prints a ``gcloud run deploy`` command template for Cloud
Run with the ones that ARE set wired through as ``--set-env-vars``.

This never reads or prints a secret's VALUE, only whether it is present --
safe to run and share output from.

Usage (from ``backend/``): ``.venv/Scripts/python scripts/deploy_secrets_helper.py``
"""

from __future__ import annotations

import os

REQUIRED_FOR_CORE = ["LIFELINE_JWT_SECRET"]
OPTIONAL_LIVE_INTEGRATIONS = [
    "GEMINI_API_KEY",
    "SARVAM_API_KEY",
    "LIFELINE_TWILIO_ENABLED",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
]


def check_env() -> dict[str, bool]:
    names = REQUIRED_FOR_CORE + OPTIONAL_LIVE_INTEGRATIONS
    return {name: bool(os.environ.get(name)) for name in names}


def build_gcloud_command(
    present: dict[str, bool], service_name: str = "lifelinegrid-backend"
) -> str:
    set_vars = ",".join(f"{name}=${name}" for name, is_set in present.items() if is_set)
    base = (
        f"gcloud run deploy {service_name} "
        "--source backend --region asia-south1 --port 8080 --memory 1Gi --allow-unauthenticated"
    )
    if set_vars:
        base += f" --set-env-vars {set_vars}"
    return base


def main() -> None:
    present = check_env()
    print("Environment variable presence (values never printed):")
    for name, is_set in present.items():
        tag = "SET" if is_set else "missing (mock/offline fallback will be used where applicable)"
        print(f"  {name}: {tag}")
    print()
    print("Suggested deploy command:")
    print(" ", build_gcloud_command(present))


if __name__ == "__main__":
    main()
