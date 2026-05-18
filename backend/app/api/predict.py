from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from catboost import Pool
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.errors import AppError
from services.registry import ModelRegistry
from services.storage import ensure_dirs, load_json, new_id, save_json
from settings import RESULTS_DIR, UPLOADS_DIR

from .models import get_registry


router = APIRouter(prefix="/predict", tags=["predict"])


DROP_COLUMNS_DEFAULT = ["vat_num", "year", "target", "dflt_year"]


def _to_jsonable(value: Any) -> Any:
    """Coerce numpy/pandas scalars into JSON-serializable Python primitives."""
    if value is None:
        return None

    # pandas missing values / NaN
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, (str, int, float, bool)):
        return value

    # numpy scalar types (np.int64, np.float64, ...)
    if isinstance(value, np.generic):
        return value.item()

    # pandas timestamps
    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    return str(value)


def _sigmoid(x: float) -> float:
    # stable-ish
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def _read_excel(path: Path) -> pd.DataFrame:
    return pd.read_excel(path)  # engine auto; requires openpyxl


def _prepare_features(df: pd.DataFrame, train_cols: list[str]) -> pd.DataFrame:
    # Keep original df unchanged
    df2 = df.drop(columns=DROP_COLUMNS_DEFAULT, errors="ignore").copy()

    missing = [c for c in train_cols if c not in df2.columns]
    if missing:
        raise AppError(
            "Missing required columns: " + ", ".join(missing),
            code="MISSING_COLUMNS",
        )

    X = df2.reindex(columns=train_cols)
    return X


def _predict_proba_raw(loaded: dict[str, Any], X: pd.DataFrame) -> np.ndarray:
    model = loaded["model"]
    return model.predict_proba(X)[:, 1]


def _predict_proba(loaded: dict[str, Any], X: pd.DataFrame) -> np.ndarray:
    """Probability shown to the user: calibrated if available, else raw."""
    cal = loaded.get("calibrated_model")
    if cal is not None:
        return cal.predict_proba(X)[:, 1]
    return _predict_proba_raw(loaded, X)


class BatchUploadResponse(BaseModel):
    fileId: str
    filename: str


@router.post("/batch/upload", response_model=BatchUploadResponse)
async def batch_upload(
    modelId: str = Form(..., description="Model id"),
    file: UploadFile = File(...),
):
    ensure_dirs(UPLOADS_DIR, RESULTS_DIR)

    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise AppError("Only .xlsx files are supported", code="UNSUPPORTED_FILE")

    file_id = new_id()
    dst = UPLOADS_DIR / f"{file_id}.xlsx"

    content = await file.read()
    dst.write_bytes(content)

    save_json(UPLOADS_DIR / f"{file_id}.json", {"modelId": modelId, "filename": file.filename})

    return BatchUploadResponse(fileId=file_id, filename=file.filename)


class BatchRunRequest(BaseModel):
    modelId: str
    fileId: str


class BatchPreview(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]


class BatchRunResponse(BaseModel):
    resultId: str
    preview: BatchPreview


@router.post("/batch/run", response_model=BatchRunResponse)
def batch_run(payload: BatchRunRequest, registry: ModelRegistry = Depends(get_registry)):
    ensure_dirs(UPLOADS_DIR, RESULTS_DIR)

    info = registry.get_info(payload.modelId)
    loaded = registry.load(payload.modelId)

    src = UPLOADS_DIR / f"{payload.fileId}.xlsx"
    if not src.exists():
        raise AppError("Uploaded file not found", code="FILE_NOT_FOUND")

    df = _read_excel(src)
    X = _prepare_features(df, info.train_cols)

    raw_proba = _predict_proba_raw(loaded, X)
    proba = _predict_proba(loaded, X)
    pred = (proba >= 0.5).astype(int)

    result_df = df.copy()
    result_df["rawProbability"] = raw_proba
    result_df["probability"] = proba
    result_df["prediction"] = pred
    result_df.insert(0, "rowIndex", np.arange(1, len(result_df) + 1))

    result_id = new_id()
    out_xlsx = RESULTS_DIR / f"{result_id}.xlsx"
    result_df.to_excel(out_xlsx, index=False)

    meta = {
        "resultId": result_id,
        "modelId": payload.modelId,
        "fileId": payload.fileId,
        "rows": int(len(result_df)),
        "resultFile": out_xlsx.name,
    }
    save_json(RESULTS_DIR / f"{result_id}.json", meta)

    preview_cols = ["rowIndex", "probability", "rawProbability", "prediction"]
    raw_preview_rows = result_df.loc[:, preview_cols].head(10).to_dict(orient="records")
    preview_rows = [
        {k: _to_jsonable(v) for k, v in row.items()}
        for row in raw_preview_rows
    ]

    return BatchRunResponse(
        resultId=result_id,
        preview=BatchPreview(columns=preview_cols, rows=preview_rows),
    )


@router.get("/batch/{result_id}/download")
def batch_download(result_id: str):
    meta = load_json(RESULTS_DIR / f"{result_id}.json")
    file_name = meta.get("resultFile")
    if not file_name:
        raise AppError("Result file missing", code="RESULT_CORRUPT")

    path = RESULTS_DIR / file_name
    if not path.exists():
        raise AppError("Result file not found", code="FILE_NOT_FOUND")

    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"prediction_{result_id}.xlsx",
    )


class WaterfallItem(BaseModel):
    feature: str
    value: Any = None
    contribution: float


class WaterfallResponse(BaseModel):
    # probabilities
    baseValue: float
    outputValue: float

    # details
    units: str = "log_odds"
    baseLogOdds: float
    outputLogOdds: float
    calibratedOutputValue: Optional[float] = None

    items: list[WaterfallItem]


def _build_waterfall(
    *,
    loaded: dict[str, Any],
    train_cols: list[str],
    X1: pd.DataFrame,
    topK: int = 15,
) -> WaterfallResponse:
    model = loaded["model"]
    cat_features = list(X1.select_dtypes(include=["object"]).columns)

    shap_vals = model.get_feature_importance(
        Pool(X1, cat_features=cat_features),
        type="ShapValues",
    )

    # CatBoost binary classification: last column is expected value (base) in log-odds.
    phi = shap_vals[0, :-1].astype(float)
    base = float(shap_vals[0, -1])
    output_log_odds = float(base + phi.sum())

    # Sort by |SHAP| like in utils/waterfall_graph.py
    order = np.argsort(-np.abs(phi))
    phi_sorted = phi[order]
    cols_sorted = [train_cols[i] for i in order]

    k = max(1, min(topK, len(cols_sorted)))
    items: list[WaterfallItem] = []
    for i, col in enumerate(cols_sorted[:k]):
        items.append(
            WaterfallItem(
                feature=col,
                value=_to_jsonable(X1.iloc[0][col]),
                contribution=float(phi_sorted[i]),
            )
        )

    if k < len(cols_sorted):
        rest = float(phi_sorted[k:].sum())
        items.append(
            WaterfallItem(
                feature=f"{len(cols_sorted) - k} other features",
                value=None,
                contribution=rest,
            )
        )

    base_prob = _sigmoid(base)
    uncal_prob = _sigmoid(output_log_odds)

    cal_prob = None
    cal = loaded.get("calibrated_model")
    if cal is not None:
        cal_prob = float(cal.predict_proba(X1)[:, 1][0])

    return WaterfallResponse(
        baseValue=base_prob,
        # Keep outputValue as raw-model probability consistent with SHAP logits.
        outputValue=uncal_prob,
        baseLogOdds=base,
        outputLogOdds=output_log_odds,
        calibratedOutputValue=cal_prob,
        items=items,
    )


@router.get("/batch/{result_id}/waterfall", response_model=WaterfallResponse)
def batch_waterfall(
    result_id: str,
    rowIndex: int,
    topK: int = 15,
    registry: ModelRegistry = Depends(get_registry),
):
    if rowIndex < 1:
        raise AppError("rowIndex must be >= 1", code="BAD_REQUEST")

    meta = load_json(RESULTS_DIR / f"{result_id}.json")
    model_id = meta.get("modelId")
    if not model_id:
        raise AppError("Result meta missing modelId", code="RESULT_CORRUPT")

    info = registry.get_info(model_id)
    loaded = registry.load(model_id)

    result_file = meta.get("resultFile")
    if not result_file:
        raise AppError("Result meta missing resultFile", code="RESULT_CORRUPT")

    df = _read_excel(RESULTS_DIR / result_file)
    if rowIndex > len(df):
        raise AppError("rowIndex out of range", code="ROW_OUT_OF_RANGE")

    row = df.iloc[rowIndex - 1 : rowIndex].copy()
    X1 = _prepare_features(row, info.train_cols)

    return _build_waterfall(loaded=loaded, train_cols=info.train_cols, X1=X1, topK=topK)


class SinglePredictRequest(BaseModel):
    modelId: str
    features: dict[str, Any]


class SinglePredictResponse(BaseModel):
    rawProbability: float
    probability: float
    prediction: int
    waterfall: Optional[WaterfallResponse] = None


@router.post("/single", response_model=SinglePredictResponse)
def single_predict(payload: SinglePredictRequest, registry: ModelRegistry = Depends(get_registry)):
    info = registry.get_info(payload.modelId)
    loaded = registry.load(payload.modelId)

    missing = [c for c in info.train_cols if c not in payload.features]
    if missing:
        raise AppError("Missing required features: " + ", ".join(missing), code="MISSING_FEATURES")

    X1 = pd.DataFrame([{k: payload.features.get(k) for k in info.train_cols}])

    raw_proba = float(_predict_proba_raw(loaded, X1)[0])
    # Probability shown to the user should be calibrated if available
    proba = float(_predict_proba(loaded, X1)[0])
    pred = int(proba >= 0.5)

    waterfall = _build_waterfall(loaded=loaded, train_cols=info.train_cols, X1=X1, topK=15)

    return SinglePredictResponse(rawProbability=raw_proba, probability=proba, prediction=pred, waterfall=waterfall)
