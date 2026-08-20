"""Serving skeleton for the Nearling Pulse health model.

YOU train the model - this is only the plumbing that serves it.

Workflow:
  1. Train any classifier (sklearn, pytorch, ...) on historical vitals.
     Class labels must be integer indices: 0=healthy, 1=warning, 2=critical.
  2. Save it with scripts/train.py - that writes a dict
     {model, thresholds, features} to model.joblib.
  3. Run:  MODEL_PATH=model.joblib uvicorn app:app --port 8000
  4. Point the backend at it:  MODEL_API_URL=http://localhost:8000

Behavior:
  - If the checkpoint is the dict from train.py, TEMPORAL features are
    computed from a rolling per-animal history buffer (flattened window
    and/or trend aggregates - exactly matching training), and tuned
    decision thresholds are applied instead of plain argmax.
  - A legacy plain-estimator checkpoint is still supported (raw features,
    argmax).

Contract (see docs/MODEL_CONTRACT.md):
  POST /predict  with the raw vital reading -> health status + confidence
"""
import os
from collections import deque
from typing import Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Nearling Pulse Model Server")

CLASSES = ["healthy", "warning", "critical"]
TREND_WINDOW = 6
WINDOW = 7  # readings of history (must match scripts/train.py)
HISTORY_LIMIT = WINDOW

# Training column names (snake_case) - the request fields are camelCase.
RAW_FEATURES = ["heart_rate", "pulse", "temperature_c", "oxygen_pct", "digest_score"]


class PredictRequest(BaseModel):
    animalId: str
    heartRate: int
    pulse: int
    temperatureC: float
    oxygenPct: int
    digestScore: int
    recordedAt: str


class PredictResponse(BaseModel):
    healthStatus: str
    confidence: float
    score: Optional[float] = None
    reasons: Optional[list[str]] = None


def load_model():
    path = os.environ.get("MODEL_PATH")
    if not path or not os.path.exists(path):
        return None, None, None
    loaded = joblib.load(path)
    if isinstance(loaded, dict):
        return loaded.get("model"), loaded.get("thresholds"), loaded.get("features")
    return loaded, None, None  # legacy plain estimator


_model, _thresholds, _features = load_model()
_history: dict[str, deque] = {}


def to_snake(req: PredictRequest) -> dict:
    return {
        "heart_rate": req.heartRate,
        "pulse": req.pulse,
        "temperature_c": req.temperatureC,
        "oxygen_pct": req.oxygenPct,
        "digest_score": req.digestScore,
    }


def build_feature_vector(animal_id: str, current: dict) -> dict:
    """Build a superset of temporal features from a rolling per-animal
    buffer, with cold-start padding identical to scripts/train.py.
    The vector actually used is selected by the saved `features` list."""
    buf = _history.setdefault(animal_id, deque(maxlen=HISTORY_LIMIT))
    buf.append(current)
    seq = list(buf)
    if len(seq) < HISTORY_LIMIT:
        seq = [seq[0]] * (HISTORY_LIMIT - len(seq)) + seq

    feats = {}
    for col in RAW_FEATURES:
        arr = [r[col] for r in seq]
        # trend-style aggregates (Phase 2)
        feats[f"{col}_d{TREND_WINDOW}"] = arr[-1] - arr[-(TREND_WINDOW + 1)]
        feats[f"{col}_mean{TREND_WINDOW}"] = float(np.mean(arr[-TREND_WINDOW:]))
        feats[f"{col}_std{TREND_WINDOW}"] = float(np.std(arr[-TREND_WINDOW:], ddof=1))
        # flattened window (Phase 3)
        for t in range(WINDOW):
            feats[f"{col}_t{t}"] = arr[-1 - t]
    return feats


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "thresholds": _thresholds,
        "trend_features": _features is not None,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    if _model is None:
        raise HTTPException(
            status_code=501,
            detail="No model loaded. Train your model and set MODEL_PATH to the checkpoint.",
        )

    raw = to_snake(req)
    if _features:
        feature_vector = build_feature_vector(req.animalId, raw)
        x = np.array([[feature_vector[f] for f in _features]], dtype=float)
    else:
        x = np.array([[raw[c] for c in RAW_FEATURES]], dtype=float)

    proba = _model.predict_proba(x)[0] if hasattr(_model, "predict_proba") else None
    if proba is None:
        pred_idx = int(_model.predict(x)[0])
        confidence = 1.0
    else:
        if _thresholds:
            t_c = _thresholds.get("critical", 0.5)
            t_w = _thresholds.get("warning", 0.5)
            if proba[2] >= t_c:
                pred_idx = 2
            elif proba[1] >= t_w:
                pred_idx = 1
            else:
                pred_idx = 0
        else:
            pred_idx = int(np.argmax(proba))
        confidence = float(proba[pred_idx])

    status = CLASSES[pred_idx]
    return PredictResponse(
        healthStatus=status,
        confidence=confidence,
        score=round(confidence * 100),
        reasons=[f"model predicted {status} with confidence {confidence:.2f}"],
    )
