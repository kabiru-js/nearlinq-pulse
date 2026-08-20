"""Train the Nearling Pulse health classifier.

Pipeline:
  1. Load the labeled CSV (export-dataset.py or generate-synthetic.py)
  2. Engineer TEMPORAL features per animal - either:
       --features window  (default, Phase 3): the flattened last 7 readings
                           (35 features) - the model learns its own temporal
                           patterns instead of relying on hand-crafted ones
       --features trends  (Phase 2): change-vs-6h, rolling mean/std
  3. Split by ANIMAL: train / validation / test (no animal leaks)
  4. Train a RandomForest, calibrate (auto: sigmoid vs isotonic by
     validation reliability)
  5. Tune decision thresholds on validation (critical-missed is expensive)
  6. Evaluate on the untouched test set: confusion matrix, per-class report,
     baseline comparison, reliability
  7. Save {model, thresholds, features} for the model server
     (model-server/app.py keeps a per-animal history buffer and builds the
     same feature vector, so the HTTP contract never changes)

Usage:
    python scripts/train.py
    python scripts/train.py --features trends     # Phase 2 variant
    python scripts/train.py --cv                  # k-fold CV by animal
"""
import argparse
import random

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

RAW_FEATURES = ["heart_rate", "pulse", "temperature_c", "oxygen_pct", "digest_score"]
CLASSES = ["healthy", "warning", "critical"]

TREND_WINDOW = 6
WINDOW = 7  # readings of history the model sees (must match model-server/app.py)
HISTORY_LIMIT = WINDOW  # cold-start padding, identical at serve time

TREND_FEATURES = (
    RAW_FEATURES
    + [f"{c}_d{TREND_WINDOW}" for c in RAW_FEATURES]
    + [f"{c}_mean{TREND_WINDOW}" for c in RAW_FEATURES]
    + [f"{c}_std{TREND_WINDOW}" for c in RAW_FEATURES]
)

WINDOW_FEATURES = [
    f"{c}_t{t}" for c in RAW_FEATURES for t in range(WINDOW)
]


def rule_based(row) -> str:
    """Mirror of lib/model/rule-based.ts - the baseline your model must beat."""
    criticals = [
        row.temperature_c >= 39.8,
        row.heart_rate >= 100,
        row.oxygen_pct <= 90,
        row.digest_score <= 60,
    ]
    warnings = [
        row.temperature_c >= 39.2,
        row.heart_rate >= 85,
        row.oxygen_pct <= 95,
        row.digest_score <= 80,
    ]
    if any(criticals):
        return "critical"
    if any(warnings):
        return "warning"
    return "healthy"


def _pad_group(group: pd.DataFrame) -> pd.DataFrame:
    """Prepend HISTORY_LIMIT copies of the first reading so cold-start
    features at serve time match training exactly."""
    head = group.head(1)
    pad = pd.concat([head] * HISTORY_LIMIT, ignore_index=True)
    return pd.concat([pad, group], ignore_index=True)


def add_window_features(df: pd.DataFrame) -> pd.DataFrame:
    """Flattened window of the last `WINDOW` readings per animal."""
    df = df.sort_values(["animal_id", "recorded_at"]).copy()
    parts = []
    for _, group in df.groupby("animal_id", sort=False):
        padded = _pad_group(group)
        for col in RAW_FEATURES:
            for t in range(WINDOW):
                padded[f"{col}_t{t}"] = padded[col].shift(t)
        parts.append(padded.iloc[HISTORY_LIMIT:])
    return pd.concat(parts, ignore_index=True)


def add_trend_features(df: pd.DataFrame) -> pd.DataFrame:
    """Per-animal change-vs-6h and rolling mean/std (Phase 2 design)."""
    df = df.sort_values(["animal_id", "recorded_at"]).copy()
    parts = []
    for _, group in df.groupby("animal_id", sort=False):
        padded = _pad_group(group)
        for col in RAW_FEATURES:
            padded[f"{col}_d{TREND_WINDOW}"] = padded[col].diff(TREND_WINDOW)
            padded[f"{col}_mean{TREND_WINDOW}"] = padded[col].rolling(
                TREND_WINDOW, min_periods=1
            ).mean()
            padded[f"{col}_std{TREND_WINDOW}"] = padded[col].rolling(
                TREND_WINDOW, min_periods=1
            ).std()
        parts.append(padded.iloc[HISTORY_LIMIT:])
    return pd.concat(parts, ignore_index=True)


def split_by_animal(df: pd.DataFrame, seed: int = 42):
    animals = df["animal_id"].unique().tolist()
    random.Random(seed).shuffle(animals)
    n = len(animals)
    n_train = int(n * 0.6)
    n_val = int(n * 0.2)
    return (
        animals[:n_train],
        animals[n_train : n_train + n_val],
        animals[n_train + n_val :],
    )


def apply_thresholds(proba: np.ndarray, t_crit: float, t_warn: float) -> np.ndarray:
    preds = np.empty(len(proba), dtype=int)
    for i, p in enumerate(proba):
        if p[2] >= t_crit:
            preds[i] = 2
        elif p[1] >= t_warn:
            preds[i] = 1
        else:
            preds[i] = 0
    return preds


def threshold_cost(preds: np.ndarray, y: np.ndarray) -> float:
    """Weighted cost: critical-missed is the expensive error."""
    cost = 0.0
    for p, t in zip(preds, y):
        if t == 2 and p != 2:
            cost += 5  # critical called healthy/warning
        elif t == 1 and p == 0:
            cost += 2  # warning called healthy
        elif t == 0 and p == 2:
            cost += 1  # healthy called critical (false alarm)
    return cost


def tune_thresholds(calibrated, X_val, y_val):
    proba = calibrated.predict_proba(X_val)
    best = (0.5, 0.5, float("inf"))
    for t_c in np.arange(0.2, 0.81, 0.1):
        for t_w in np.arange(0.2, 0.81, 0.1):
            preds = apply_thresholds(proba, t_c, t_w)
            cost = threshold_cost(preds, y_val)
            if cost < best[2]:
                best = (t_c, t_w, cost)
    return best[0], best[1]


def reliability_mae(calibrated, X, y) -> float:
    """Mean absolute error between binned predicted probability and accuracy."""
    proba = calibrated.predict_proba(X)
    max_proba = proba.max(axis=1)
    correct = proba.argmax(axis=1) == y
    diffs, weights = [], []
    for b in range(10):
        lo, hi = b / 10, (b + 1) / 10
        mask = (max_proba >= lo) & (max_proba < hi)
        if mask.sum() < 5:
            continue
        diffs.append(abs(max_proba[mask].mean() - correct[mask].mean()))
        weights.append(mask.sum())
    if not weights:
        return 1.0
    return float(np.average(diffs, weights=weights))


def print_confusion(y, preds, title: str):
    print(f"=== {title} ===")
    print(pd.DataFrame(confusion_matrix(y, preds), index=CLASSES, columns=CLASSES))
    print()


def reliability_report(calibrated, X, y, preds):
    print("=== Reliability (predicted probability bin vs accuracy) ===")
    proba = calibrated.predict_proba(X)
    max_proba = proba.max(axis=1)
    correct = preds == y
    for b in range(10):
        lo, hi = b / 10, (b + 1) / 10
        mask = (max_proba >= lo) & (max_proba < hi)
        if mask.sum() < 5:
            continue
        mean_pred = float(max_proba[mask].mean())
        acc = float(correct[mask].mean())
        flag = "OK" if abs(mean_pred - acc) <= 0.1 else "OFF"
        print(f"pred {lo:.1f}-{hi:.1f}: n={mask.sum():4d} mean pred {mean_pred:.3f} vs accuracy {acc:.3f}  {flag}")


def cross_validate_by_animal(df: pd.DataFrame, features, seed: int = 42):
    animals = df["animal_id"].unique().tolist()
    random.Random(seed).shuffle(animals)
    accs, crit_recalls, healthy_precs = [], [], []
    for fold, test_animal in enumerate(animals, start=1):
        train_df = df[df["animal_id"] != test_animal]
        test_df = df[df["animal_id"] == test_animal]
        clf = RandomForestClassifier(
            n_estimators=200, class_weight="balanced", random_state=seed
        )
        clf.fit(train_df[features], train_df["label"])
        preds = clf.predict(test_df[features])
        y = test_df["label"].values
        accs.append(float(np.mean(preds == y)))
        crit_mask = y == 2
        crit_recalls.append(
            float(np.mean(preds[crit_mask] == 2)) if crit_mask.sum() else float("nan")
        )
        healthy_mask = y == 0
        healthy_precs.append(
            float(np.mean(y[preds == 0] == 0)) if (preds == 0).sum() else float("nan")
        )
        print(f"  fold {fold}: animal {test_animal} accuracy {accs[-1]:.3f}")
    mean = lambda a: float(np.nanmean(a))
    std = lambda a: float(np.nanstd(a))
    print(
        f"  CV summary (by animal): accuracy {mean(accs):.3f}±{std(accs):.3f}, "
        f"critical recall {mean(crit_recalls):.3f}±{std(crit_recalls):.3f}, "
        f"healthy precision {mean(healthy_precs):.3f}±{std(healthy_precs):.3f}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the health classifier")
    parser.add_argument("--data", default="scripts/dataset.csv")
    parser.add_argument("--out", default="model-server/model.joblib")
    parser.add_argument("--features", choices=["window", "trends"], default="window",
                        help="temporal feature design (window = Phase 3 default)")
    parser.add_argument("--cv", action="store_true", help="print k-fold CV by animal")
    args = parser.parse_args()

    if args.features == "window":
        FEATURES = WINDOW_FEATURES
        build = add_window_features
        style = "window"
    else:
        FEATURES = TREND_FEATURES
        build = add_trend_features
        style = "trends"

    df = pd.read_csv(args.data)
    df = df.dropna(subset=RAW_FEATURES + ["verdict"])
    df = build(df)
    df = df.dropna(subset=FEATURES)
    df["label"] = df["verdict"].map({c: i for i, c in enumerate(CLASSES)})
    df = df.dropna(subset=["label"])
    if df.empty:
        raise SystemExit("No usable labeled rows in the dataset.")

    train_a, val_a, test_a = split_by_animal(df)
    train = df[df["animal_id"].isin(train_a)]
    val = df[df["animal_id"].isin(val_a)]
    test = df[df["animal_id"].isin(test_a)]
    if val.empty or test.empty:
        raise SystemExit("Not enough animals for a val/test split - collect more labeled data.")

    X_train, y_train = train[FEATURES].values, train["label"].values.astype(int)
    X_val, y_val = val[FEATURES].values, val["label"].values.astype(int)
    X_test, y_test = test[FEATURES].values, test["label"].values.astype(int)

    print(f"Feature style: {style} | Train: {len(train)} rows ({len(train_a)} animals) | "
          f"Val: {len(val)} ({len(val_a)}) | Test: {len(test)} ({len(test_a)})")
    print(f"Features: {len(FEATURES)}")

    # Calibration method auto-select by validation reliability.
    best_method, best_mae = "sigmoid", float("inf")
    for method in ["sigmoid", "isotonic"]:
        cal = CalibratedClassifierCV(
            estimator=RandomForestClassifier(
                n_estimators=300, class_weight="balanced", random_state=42
            ),
            method=method,
            cv=3,
        )
        cal.fit(X_train, y_train)
        mae = reliability_mae(cal, X_val, y_val)
        print(f"calibration '{method}' reliability MAE on val: {mae:.3f}")
        if mae < best_mae:
            best_method, best_mae = method, mae

    calibrated = CalibratedClassifierCV(
        estimator=RandomForestClassifier(
            n_estimators=300, class_weight="balanced", random_state=42
        ),
        method=best_method,
        cv=3,
    )
    calibrated.fit(X_train, y_train)
    print(f"\n=== Model: RandomForest (300 trees, balanced) + {best_method} calibration ===")

    # Default (argmax) vs tuned thresholds.
    t_c, t_w = tune_thresholds(calibrated, X_val, y_val)
    default_preds = calibrated.predict(X_test)
    tuned_preds = apply_thresholds(calibrated.predict_proba(X_test), t_c, t_w)
    print(f"Tuned thresholds: critical >= {t_c:.1f}, warning >= {t_w:.1f} "
          f"(default argmax would be 0.5/0.5)\n")

    print_confusion(y_test, default_preds, "Confusion matrix - default thresholds (test)")
    print_confusion(y_test, tuned_preds, "Confusion matrix - tuned thresholds (test)")

    print("=== Classification report - tuned thresholds (test) ===")
    print(classification_report(y_test, tuned_preds, target_names=CLASSES, zero_division=0))

    rule_preds = [rule_based(row) for row in test.itertuples(index=False)]
    rule_labels = [CLASSES[i] for i in y_test]
    model_acc = float(np.mean(tuned_preds == y_test))
    rule_acc = float(np.mean([r == l for r, l in zip(rule_preds, rule_labels)]))
    print("=== Baseline comparison (same test set) ===")
    print(f"Model accuracy : {model_acc:.3f}")
    print(f"Rules accuracy : {rule_acc:.3f}")
    print(f"Beat the rules : {'YES' if model_acc > rule_acc else 'NOT YET - collect more labeled data, then retrain'}")

    reliability_report(calibrated, X_test, y_test, tuned_preds)

    if args.cv:
        print("\n=== Cross-validation by animal (plain RF) ===")
        cross_validate_by_animal(df, FEATURES)

    joblib.dump(
        {
            "model": calibrated,
            "thresholds": {"critical": float(t_c), "warning": float(t_w)},
            "features": FEATURES,
            "feature_style": style,
            "trained_on": "synthetic demo data (see docs/TRAINING.md - retrain on real verdicts)",
        },
        args.out,
    )
    print(f"\nSaved calibrated model + thresholds to {args.out}")
    print("Serve it:  cd model-server && $env:MODEL_PATH='model.joblib'; python -m uvicorn app:app --port 8000")
    print("Then set MODEL_API_URL=http://localhost:8000 in the app's .env and restart.")


if __name__ == "__main__":
    main()
