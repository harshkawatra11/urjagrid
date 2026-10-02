from app.grid.baseline import ShedLedger, rotate_shedding_roster


def test_rotate_shedding_roster_round_robin() -> None:
    feeders = ["f1", "f2", "f3", "f4"]
    assert rotate_shedding_roster(feeders, cycle_index=0, n_to_shed=2) == ["f1", "f2"]
    assert rotate_shedding_roster(feeders, cycle_index=1, n_to_shed=2) == ["f3", "f4"]
    assert rotate_shedding_roster(feeders, cycle_index=2, n_to_shed=2) == ["f1", "f2"]


def test_rotate_shedding_roster_empty() -> None:
    assert rotate_shedding_roster([], cycle_index=0, n_to_shed=2) == []
    assert rotate_shedding_roster(["f1"], cycle_index=0, n_to_shed=0) == []


def test_rotate_shedding_roster_n_to_shed_exceeds_count() -> None:
    assert rotate_shedding_roster(["f1", "f2"], cycle_index=0, n_to_shed=5) == ["f1", "f2"]


def test_shed_ledger_tracks_burden() -> None:
    ledger = ShedLedger()
    ledger.record("f1", 2.0)
    ledger.record("f1", 1.0)
    ledger.record("f2", 0.5)
    assert ledger.burden("f1") == 3.0
    assert ledger.burden("f2") == 0.5
    assert ledger.burden("f3") == 0.0


def test_shed_ledger_least_burdened_picks_fairly() -> None:
    ledger = ShedLedger()
    ledger.record("f1", 5.0)
    ledger.record("f2", 1.0)
    ledger.record("f3", 3.0)
    picked = ledger.least_burdened(["f1", "f2", "f3"], n=2)
    assert picked == ["f2", "f3"]


def test_shed_ledger_least_burdened_ties_broken_by_id() -> None:
    ledger = ShedLedger()
    picked = ledger.least_burdened(["fz", "fa", "fm"], n=2)
    assert picked == ["fa", "fm"]
