"""Serving skeleton for the Nearling Pulse health model.

YOU train the model - this is only the plumbing that serves it.

Workflow:
  1. Train any classifier (sklearn, pytorch, ...) on historical vitals.
     Class labels must be integer indices: 0=healthy, 1=warning, 2=critical.
  2. Save the trained model so joblib can load it:  joblib.dump(model, "model.joblib")
  3. Run:  MODEL_PATH=model.joblib uvicorn app:app --port 8000
  4. Point the backend at it:  MODEL_API_URL=http://localhost:8000

Contract (see docs/MODEL_CONTRACT.md):
  POST /predict  with the raw vital reading -> health status + confidence
"""
import os
from typing import Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Nearling Pulse Model Server")

CLASSES = ["healthy", "warning", "critical"]
FEATURES = ["heartRate", "pulse", "temperatureC", "oxygenPct", "digestScore"]


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
        return None
    return joblib.load(path)


_model = load_model()


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/predict")
def predict(req: PredictRequest):
    if _model is None:
        raise HTTPException(
            status_code=501,
            detail="No model loaded. Train your model and set MODEL_PATH to the checkpoint.",
        )
    x = np.array([[getattr(req, f) for f in FEATURES]], dtype=float)
    pred_idx = int(_model.predict(x)[0])
    proba = _model.predict_proba(x)[0] if hasattr(_model, "predict_proba") else None
    confidence = float(max(proba)) if proba is not None else 1.0
    status = CLASSES[pred_idx]
    return PredictResponse(
        healthStatus=status,
        confidence=confidence,
        score=round(confidence * 100),
        reasons=[f"model predicted {status} with confidence {confidence:.2f}"],
    )
