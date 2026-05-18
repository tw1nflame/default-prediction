from __future__ import annotations

from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
EXP_ROOT = APP_DIR / "exp"
RUNTIME_ROOT = APP_DIR / "runtime"
UPLOADS_DIR = RUNTIME_ROOT / "uploads"
RESULTS_DIR = RUNTIME_ROOT / "results"

API_PREFIX = "/api"

# Dev-friendly CORS defaults (frontend on another port)
CORS_ALLOW_ORIGINS = ["*"]
CORS_ALLOW_CREDENTIALS = False
CORS_ALLOW_METHODS = ["*"]
CORS_ALLOW_HEADERS = ["*"]
