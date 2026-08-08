"""Train the Nearling Pulse health classifier.

Pipeline:
  1. Load scripts/dataset.csv (produced by export-dataset.py)
  2. Split by ANIMAL (80/20) - no animal appears in both train and test,
     otherwise the model would cheat by memorizing the animal
  3. Train a RandomForest on the 5 sensor features
  4. Print a confusion matrix + classification report
  5. Compare against the current rule-based thresholds on the same test set
  6. Save model.joblib for the model server (MODEL_PATH=model.joblib)

Usage:
    python scripts/train.py
    python scripts/train.py --out model-server/model.joblib
"""
import argparse
import random

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

FEATURES = ["heart_rate", "pulse", "temperature_c", "oxygen_pct", "digest_score"]
CLASSES = ["healthy", "warning", "critical"]


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the health classifier")
    parser.add_argument("--data", default="scripts/dataset.csv")
    parser.add_argument("--out", default="model-server/model.joblib")
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    df = df.dropna(subset=FEATURES + ["verdict"])
    df["label"] = df["verdict"].map({c: i for i, c in enumerate(CLASSES)})
    df = df.dropna(subset=["label"])
    if df.empty:
        raise SystemExit("No usable labeled rows in the dataset.")

    # Split by ANIMAL, not by row.
    animals = df["animal_id"].unique().tolist()
    random.Random(42).shuffle(animals)
    split = int(len(animals) * 0.8)
    train_animals = set(animals[:split])
    test_animals = set(animals[split:])

    train = df[df["animal_id"].isin(train_animals)]
    test = df[df["animal_id"].isin(test_animals)]
    if test.empty:
        raise SystemExit("Not enough animals for a test split - collect more labeled data.")

    X_train, y_train = train[FEATURES].values, train["label"].values.astype(int)
    X_test, y_test = test[FEATURES].values, test["label"].values.astype(int)

    model = RandomForestClassifier(
        n_estimators=300, class_weight="balanced", random_state=42
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print("=== Model: RandomForest (300 trees, balanced classes) ===")
    print("=== Confusion matrix (rows = actual, cols = predicted) ===")
    print(pd.DataFrame(confusion_matrix(y_test, preds), index=CLASSES, columns=CLASSES))
    print("\n=== Classification report ===")
    print(classification_report(y_test, preds, target_names=CLASSES, zero_division=0))

    rule_preds = [rule_based(row) for row in test.itertuples(index=False)]
    rule_labels = [CLASSES[i] for i in y_test]
    model_acc = float(np.mean(preds == y_test))
    rule_acc = float(np.mean([r == l for r, l in zip(rule_preds, rule_labels)]))
    print("=== Baseline comparison (same test set) ===")
    print(f"Model accuracy : {model_acc:.3f}")
    print(f"Rules accuracy : {rule_acc:.3f}")
    print(f"Beat the rules : {'YES' if model_acc > rule_acc else 'NOT YET - collect more labeled data, then retrain'}")

    joblib.dump(model, args.out)
    print(f"\nSaved model to {args.out}")
    print("Serve it:  cd model-server && MODEL_PATH=model.joblib uvicorn app:app --port 8000")
    print("Then set MODEL_API_URL=http://localhost:8000 in the app's .env and restart.")


if __name__ == "__main__":
    main()
