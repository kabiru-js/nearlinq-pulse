# Nearling Pulse — Model Server

This folder is the **serving skeleton** for the health model. **You train the model** — this code only loads your checkpoint and exposes it to the backend over HTTP.

## The division of labor

| Part | Who owns it |
|---|---|
| Training data, features, model architecture, weights | **You** |
| Serving (loading the checkpoint, exposing `POST /predict`) | This skeleton |
| Calling the model from the backend | `lib/model/` in the Next.js app |

## Quick start

```bash
cd model-server
python -m venv .venv
.venv/Scripts/activate        # Windows  (.venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
```

Train your model (classes: `0=healthy, 1=warning, 2=critical`), then save it:

```python
import joblib
joblib.dump(your_trained_model, "model.joblib")
```

Serve it:

```bash
MODEL_PATH=model.joblib uvicorn app:app --port 8000
```

Verify:

```bash
curl -X POST http://localhost:8000/predict \
  -H "content-type: application/json" \
  -d '{"animalId":"abc","heartRate":70,"pulse":72,"temperatureC":38.2,"oxygenPct":98,"digestScore":92,"recordedAt":"2026-08-06T00:00:00Z"}'
```

Then point the backend at it:

```
MODEL_API_URL=http://localhost:8000
```

## Notes

- `scripts/train.py` saves a **dict** checkpoint `{model, thresholds, features}`
  to `model.joblib`. The server applies tuned decision thresholds (instead
  of plain argmax) and computes **temporal features** — a flattened window
  of the last 7 readings (Phase 3) and/or trend aggregates (Phase 2) — from
  a rolling per-animal history buffer that matches training exactly. So the
  contract's input stays the 5 raw features even though the model sees
  history. Cold-start padding (replicating the first reading) matches
  training, so even the first readings get valid features.
- A legacy plain-estimator checkpoint is still supported (raw features, argmax).
- The model must expose `predict(X)` and ideally `predict_proba(X)` (sklearn-style). The server expects integer class labels `0/1/2` mapped to `healthy/warning/critical`.
- `predict_proba` is optional; without it, confidence defaults to `1.0`.
- Anything that serves the documented contract works — MLflow serve, ONNX Runtime, a PyTorch service, etc. See `docs/MODEL_CONTRACT.md`.
- Checkpoints (`*.joblib`, `*.pkl`, `*.pt`, `*.onnx`) are gitignored — train locally, never commit weights.
- The in-memory history buffer is per-process: with multiple server instances, each keeps its own view. Fine for a single-node deployment.
