"""Beta-Bernoulli demand-response acceptance learning model.

Each consumer segment (or consumer) gets a Beta(alpha, beta) belief over its
DR-ask acceptance probability, updated after every observed accept/decline.
This is the standard conjugate-prior online-learning model for a Bernoulli
rate, chosen so the engine's acceptance estimate improves over the demo
without ever needing an LLM or external model.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class BetaBernoulliDrModel:
    alpha: float = 1.0
    beta: float = 1.0

    def update(self, accepted: bool) -> None:
        if accepted:
            self.alpha += 1.0
        else:
            self.beta += 1.0

    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    def variance(self) -> float:
        total = self.alpha + self.beta
        return (self.alpha * self.beta) / (total**2 * (total + 1))

    def sample(self, rng: np.random.Generator) -> float:
        return float(rng.beta(self.alpha, self.beta))


@dataclass
class DrAcceptanceRegistry:
    """Per-segment ``BetaBernoulliDrModel`` instances, created on first use."""

    models: dict[str, BetaBernoulliDrModel] = field(default_factory=dict)

    def get(self, segment_id: str) -> BetaBernoulliDrModel:
        if segment_id not in self.models:
            self.models[segment_id] = BetaBernoulliDrModel()
        return self.models[segment_id]

    def record(self, segment_id: str, accepted: bool) -> None:
        self.get(segment_id).update(accepted)

    def acceptance_probability(self, segment_id: str) -> float:
        return self.get(segment_id).mean()
