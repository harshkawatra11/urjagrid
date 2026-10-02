import numpy as np

from app.grid.dr_model import BetaBernoulliDrModel, DrAcceptanceRegistry


def test_beta_bernoulli_prior_mean_is_half() -> None:
    model = BetaBernoulliDrModel()
    assert model.mean() == 0.5


def test_beta_bernoulli_updates_toward_observed_rate() -> None:
    model = BetaBernoulliDrModel()
    for _ in range(20):
        model.update(accepted=True)
    for _ in range(5):
        model.update(accepted=False)
    assert model.mean() == (1.0 + 20) / (1.0 + 20 + 1.0 + 5)
    assert model.mean() > 0.7


def test_beta_bernoulli_variance_shrinks_with_data() -> None:
    model = BetaBernoulliDrModel()
    initial_var = model.variance()
    for _ in range(100):
        model.update(accepted=True)
    assert model.variance() < initial_var


def test_beta_bernoulli_sample_is_deterministic_for_seeded_rng() -> None:
    model = BetaBernoulliDrModel(alpha=3.0, beta=2.0)
    rng_a = np.random.default_rng(7)
    rng_b = np.random.default_rng(7)
    assert model.sample(rng_a) == model.sample(rng_b)


def test_dr_acceptance_registry_tracks_segments_independently() -> None:
    registry = DrAcceptanceRegistry()
    for _ in range(10):
        registry.record("t1_household", accepted=True)
    for _ in range(10):
        registry.record("t2_shop", accepted=False)
    t1_prob = registry.acceptance_probability("t1_household")
    t2_prob = registry.acceptance_probability("t2_shop")
    assert t1_prob > t2_prob


def test_dr_acceptance_registry_unseen_segment_starts_at_prior() -> None:
    registry = DrAcceptanceRegistry()
    assert registry.acceptance_probability("new_segment") == 0.5
