"""Application configuration.

LifelineGrid's backend settings, loaded from environment variables / .env via
pydantic-settings. Lane A engines never read ``Settings`` directly (they are
pure and take explicit arguments); this module exists for Lane B's app
factory (``app/main.py``) and for anything in Lane A that needs a path to
on-disk data (model artifacts, seed network, weather archives).
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables or .env."""

    model_config = SettingsConfigDict(env_prefix="LIFELINE_", env_file=".env", extra="ignore")

    env: str = "local"
    time_scale: int = 60
    admin_enabled: bool = True
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    data_dir: Path = BACKEND_ROOT / "data"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
