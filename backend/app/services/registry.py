from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

from utils.exp_handler import load_exp

from .errors import AppError
from .storage import load_json


@dataclass(frozen=True)
class ModelInfo:
    id: str
    name: str
    path: Path
    train_cols: list[str]
    has_calibrator: bool


class ModelRegistry:
    def __init__(self, exp_root: Path):
        self._exp_root = exp_root
        self._scan_lock = Lock()
        self._load_lock = Lock()
        self._models: dict[str, ModelInfo] = {}
        self._loaded: dict[str, dict[str, Any]] = {}

    def scan(self) -> dict[str, ModelInfo]:
        with self._scan_lock:
            models: dict[str, ModelInfo] = {}
            if not self._exp_root.exists():
                self._models = {}
                return self._models

            for exp_dir in sorted([p for p in self._exp_root.iterdir() if p.is_dir()]):
                model_id = exp_dir.name
                model_file = exp_dir / "models" / "model.cbm"
                meta_file = exp_dir / "meta.json"
                if not model_file.exists() or not meta_file.exists():
                    continue

                meta = load_json(meta_file)
                train_cols = list(meta.get("train_cols") or [])
                if not train_cols:
                    continue

                cal_file = exp_dir / "models" / "calibrated_model.joblib"
                models[model_id] = ModelInfo(
                    id=model_id,
                    name=model_id,
                    path=exp_dir,
                    train_cols=train_cols,
                    has_calibrator=cal_file.exists(),
                )

            self._models = models
            return self._models

    def list_models(self) -> list[ModelInfo]:
        if not self._models:
            self.scan()
        return list(self._models.values())

    def get_info(self, model_id: str) -> ModelInfo:
        if not self._models:
            self.scan()
        info = self._models.get(model_id)
        if not info:
            raise AppError(f"Unknown model: {model_id}", code="MODEL_NOT_FOUND")
        return info

    def load(self, model_id: str) -> dict[str, Any]:
        """Returns dict with keys: model, calibrated_model (optional). Cached."""
        if model_id in self._loaded:
            return self._loaded[model_id]

        info = self.get_info(model_id)

        with self._load_lock:
            if model_id in self._loaded:
                return self._loaded[model_id]

            # load_exp expects path relative to current working directory in notebooks.
            # Here we pass absolute path for safety.
            loaded = load_exp(str(info.path))
            if "model" not in loaded or loaded["model"] is None:
                raise AppError(f"Failed to load model: {model_id}", code="MODEL_LOAD_FAILED")

            # calibrated_model can be None
            self._loaded[model_id] = loaded
            return loaded
