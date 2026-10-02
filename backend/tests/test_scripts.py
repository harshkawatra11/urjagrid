import importlib.util
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"


def _load(module_name: str, filename: str):
    spec = importlib.util.spec_from_file_location(module_name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def test_export_fixtures_writes_json_files(tmp_path) -> None:
    module = _load("export_fixtures_test_module", "export_fixtures.py")
    written = module.export_fixtures(tmp_path, n_intervals=3)
    assert "subdivisions" in written
    assert "manifest" in written
    for name in written:
        assert (tmp_path / f"{name}.json").exists()


def test_latency_sweep_reports_percentiles() -> None:
    module = _load("latency_sweep_test_module", "latency_sweep.py")
    results = module.sweep(n=2)
    assert "subdivisions" in results
    assert results["subdivisions"]["p50_ms"] >= 0.0
    assert results["subdivisions"]["p95_ms"] >= results["subdivisions"]["p50_ms"]


def test_deploy_secrets_helper_never_leaks_values(monkeypatch) -> None:
    module = _load("deploy_secrets_helper_test_module", "deploy_secrets_helper.py")
    monkeypatch.setenv("GEMINI_API_KEY", "super-secret-value")
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    present = module.check_env()
    assert present["GEMINI_API_KEY"] is True
    assert present["SARVAM_API_KEY"] is False
    command = module.build_gcloud_command(present)
    assert "super-secret-value" not in command
    assert "GEMINI_API_KEY" in command
