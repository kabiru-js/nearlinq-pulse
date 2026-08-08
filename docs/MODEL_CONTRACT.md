# Nearling Pulse — ML Model Contract

This document defines the **exact contract** your trained model must satisfy so the backend can use it. You own everything inside the model; this is the interface around it.

## Where the model sits

```mermaid
flowchart LR
    INGEST[POST /api/vitals<br>sensor reading arrives] --> ANALYZE[lib/model/analyzeVitals]
    ANALYZE -->|MODEL_API_URL set| HTTP[POST {MODEL_API_URL}/predict]
    ANALYZE -.->|model down / not configured| RULES[rule-based fallback]
    HTTP --> VERDICT[verdict stored on the vital row]
    RULES --> VERDICT
    VERDICT --> DASH[dashboard reads verdicts]
```

The backend never talks to the model directly — everything goes through `analyzeVitals()` in `lib/model/index.ts`. The browser never talks to the model at all.

## Input — what your model receives

`POST /predict` body (matches one vital reading from a sensor tag):

```json
{
  "animalId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "heartRate": 72,
  "pulse": 74,
  "temperatureC": 38.3,
  "oxygenPct": 97,
  "digestScore": 88,
  "recordedAt": "2026-08-06T09:30:00.000Z"
}
```

| Field | Type | Range | Meaning |
|---|---|---|---|
| `animalId` | string (uuid) | — | which animal the tag belongs to |
| `heartRate` | int | 20–250 | beats per minute |
| `pulse` | int | 20–250 | beats per minute |
| `temperatureC` | number | 30–45 | °C |
| `oxygenPct` | int | 50–100 | oxygen saturation % |
| `digestScore` | int | 0–100 | rumen/digestive health score |
| `recordedAt` | string (ISO-8601) | — | sensor timestamp |

The first five numeric fields are your feature vector.

## Output — what the backend expects

```json
{
  "healthStatus": "warning",
  "confidence": 0.83,
  "score": 70,
  "reasons": ["temperature 39.4C is elevated"]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `healthStatus` | `"healthy" \| "warning" \| "critical"` | yes | the verdict — drives the dashboard color |
| `confidence` | number 0–1 | yes | model certainty in the verdict |
| `score` | number 0–100 | no | optional health score (dashboard gauge) |
| `reasons` | string[] | no | optional human-readable explanations for the farmer |

Unknown extra fields are ignored. Missing/invalid required fields cause the reading to be rejected (or fall back — see below).

## Behavior when the model is unavailable

| `MODEL_FALLBACK_MODE` | Model unreachable / invalid output | Result |
|---|---|---|
| `fallback` (default) | yes | reading stored with the **rule-based** verdict, warning logged |
| `strict` | yes | reading **rejected** (ingestion fails loudly) |

This means the system degrades gracefully while you iterate on training, and goes strict when you're confident in the model.

## Training guidance (yours)

- **Problem framing:** 3-class classification (`healthy / warning / critical`) on the 5 numeric features above.
- **Baseline to beat:** the rule-based classifier in `lib/model/rule-based.ts` (simple thresholds). Your model should outperform it on labeled historical readings.
- **Labels:** ideally sourced from vet check-ups — the `checkups` table can store the vet's verdict for that animal at that time. That's your ground truth.
- **Calibration:** `confidence` should be trustworthy; consider calibration (e.g., Platt scaling / isotonic regression) so the dashboard's numbers mean something.
- **Temporal option:** if you have rich time-series history, a sequence model (LSTM / transformer on recent readings) can beat per-reading classifiers. Start per-reading — it's simpler and the contract doesn't change.
- **Serving options:** this repo's `model-server/` (FastAPI + joblib), MLflow serve, ONNX Runtime, or any HTTP server honoring the contract above.

## Versioning

- Keep `MODEL_API_URL` pointable to different model deployments (e.g., `https://model.internal/v1` vs `/v2`) so you can A/B or roll back.
- Store the model version alongside verdicts later if you want auditability of predictions.
