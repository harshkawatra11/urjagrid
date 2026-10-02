"""Domain exceptions shared across every LifelineGrid backend module.

``LifelineGridError`` is the root of the hierarchy so Lane B's FastAPI
exception handlers can catch one base type and still report the correct
HTTP status via ``ApiError.status_code``.
"""


class LifelineGridError(Exception):
    """Base class for all LifelineGrid domain errors."""


class NotFoundError(LifelineGridError):
    """Raised when a referenced entity (DT, feeder, plan, consumer, ...) does not exist."""

    def __init__(self, entity: str, entity_id: str) -> None:
        self.entity = entity
        self.entity_id = entity_id
        super().__init__(f"{entity} '{entity_id}' not found")


class InvalidTransitionError(LifelineGridError):
    """Raised on an illegal state-machine transition (e.g. approving a dispatched plan)."""

    def __init__(self, entity: str, from_state: str, to_state: str) -> None:
        self.entity = entity
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(f"cannot transition {entity} from '{from_state}' to '{to_state}'")


class ApiError(LifelineGridError):
    """Raised by application code that wants a specific HTTP status surfaced by the API.

    Lane A's pure engines should not raise this (they have no notion of HTTP); it exists
    here because Lane B's exception handlers need a single well-known type to catch for
    "respond with this status and message" errors, and every other exception in this
    module should remain importable without pulling in FastAPI.
    """

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)
