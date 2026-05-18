from __future__ import annotations

from fastapi import APIRouter, Depends

from services.registry import ModelRegistry
from services.schemas import build_model_schema
from settings import EXP_ROOT


router = APIRouter(prefix="/models", tags=["models"])


def get_registry() -> ModelRegistry:
    # simple singleton via function attribute
    if not hasattr(get_registry, "_reg"):
        get_registry._reg = ModelRegistry(EXP_ROOT)  # type: ignore[attr-defined]
    return get_registry._reg  # type: ignore[attr-defined]


@router.get("")
def list_models(registry: ModelRegistry = Depends(get_registry)):
    models = registry.list_models()
    return {
        "models": [
            {
                "id": m.id,
                "name": m.name,
            }
            for m in models
        ]
    }


@router.get("/{model_id}/schema")
def get_model_schema(model_id: str, registry: ModelRegistry = Depends(get_registry)):
    info = registry.get_info(model_id)
    return build_model_schema(info)
