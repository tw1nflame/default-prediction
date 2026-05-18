from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from .errors import AppError


def ensure_dirs(*dirs: Path) -> None:
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)


def new_id() -> str:
    return uuid4().hex


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def load_json(path: Path) -> dict:
    if not path.exists():
        raise AppError(f"Not found: {path.name}", code="NOT_FOUND")
    return json.loads(path.read_text(encoding="utf-8"))
