from __future__ import annotations

from typing import Any

from .registry import ModelInfo


def build_model_schema(model: ModelInfo) -> dict[str, Any]:
    # Minimal JSON-Schema-like structure for dynamic forms.
    props: dict[str, Any] = {}
    required: list[str] = []

    for col in model.train_cols:
        props[col] = {
            "type": "number",
            "title": col,
        }
        required.append(col)

    return {
        "type": "object",
        "title": f"Inputs for {model.id}",
        "required": required,
        "properties": props,
    }
