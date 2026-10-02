"""Fuzzy name -> id resolution (B11), via ``rapidfuzz``.

Lets a voice/chat user say "Subhash Nagar" or "DT 1 in Subhash Nagar" and
have it resolved to the canonical ``sd_subhashnagar`` / ``dt_sn_01`` id the
rest of the tool layer expects.
"""

from __future__ import annotations

from rapidfuzz import fuzz, process

MIN_SCORE = 60.0


def fuzzy_resolve(query: str, candidates: dict[str, str]) -> tuple[str, float] | None:
    """Resolve ``query`` against ``candidates`` (id -> display name).

    Returns ``(id, score)`` for the best match scoring at or above
    ``MIN_SCORE``, or ``None`` if nothing matches well enough.
    """
    if not query or not candidates:
        return None
    names_by_id = candidates
    choices = list(names_by_id.items())
    best = process.extractOne(query, [name for _id, name in choices], scorer=fuzz.WRatio)
    if best is None:
        return None
    matched_name, score, index = best
    if score < MIN_SCORE:
        return None
    matched_id = choices[index][0]
    return matched_id, float(score)


def fuzzy_resolve_many(
    query: str, candidates: dict[str, str], limit: int = 3
) -> list[tuple[str, float]]:
    """Like ``fuzzy_resolve`` but returns up to ``limit`` candidates, best first."""
    if not query or not candidates:
        return []
    choices = list(candidates.items())
    results = process.extract(
        query, [name for _id, name in choices], scorer=fuzz.WRatio, limit=limit
    )
    return [
        (choices[index][0], float(score)) for _name, score, index in results if score >= MIN_SCORE
    ]


__all__ = ["MIN_SCORE", "fuzzy_resolve", "fuzzy_resolve_many"]
