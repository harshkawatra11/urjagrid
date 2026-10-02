# start-demo.ps1 -- starts the UrjaGrid backend for a local demo (Lane B, B13).
#
# Windows dev environment (per docs/SPEC.md). Run from the repo root:
#     .\start-demo.ps1
#
# What it does:
#   1. Verifies backend/.venv exists (built with `py -3.12`, see backend's own setup).
#   2. Runs the backend's test suite as a smoke check (skip with -SkipTests).
#   3. Starts uvicorn on 127.0.0.1:8080 (matches the Cloud Run container port).

param(
    [switch]$SkipTests,
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Error "backend/.venv not found. Build it first: cd backend; py -3.12 -m venv .venv; .venv\Scripts\python -m pip install -r requirements.txt"
    exit 1
}

if (-not $SkipTests) {
    Write-Host "Running backend test suite as a smoke check..." -ForegroundColor Cyan
    Push-Location $BackendDir
    & $VenvPython -m pytest -q
    $testExitCode = $LASTEXITCODE
    Pop-Location
    if ($testExitCode -ne 0) {
        Write-Error "Backend tests failed (exit $testExitCode). Fix before demoing, or pass -SkipTests to start anyway."
        exit $testExitCode
    }
    Write-Host "Tests passed." -ForegroundColor Green
}

Write-Host "Starting UrjaGrid backend on http://127.0.0.1:$Port ..." -ForegroundColor Cyan
Push-Location $BackendDir
& $VenvPython -m uvicorn app.main:app --host 127.0.0.1 --port $Port --reload
Pop-Location
