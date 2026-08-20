"""Generate a synthetic labeled dataset for developing the health model.

WHY THIS EXISTS
---------------
Real training labels come from vet check-ups with verdicts - and the
system hasn't run in the field yet, so no real labels exist. This script
creates a *simulated* ground truth so the whole ML pipeline
(generate -> train -> evaluate -> serve) can be built, tested, and
understood end-to-end.

It is a DEMO dataset. The "true health" function below is invented - but
deliberately richer than the rule-based baseline (it includes feature
interactions and per-animal baselines the rules cannot express), so the
model has something genuine to learn and the comparison is meaningful.

WHEN REAL LABELS EXIST
----------------------
Stop using this. Run the system, record check-ups with verdicts, then use
scripts/export-dataset.py against the database instead. Retrain on real
data before trusting any verdict clinically.

Output schema matches export-dataset.py so scripts/train.py works unchanged.

Usage: python scripts/generate-synthetic.py [--output scripts/dataset.csv]
"""
import argparse
import math
import random

import pandas as pd

HOURS = 24 * 30  # 30 days of hourly readings per animal
START = pd.Timestamp("2026-08-01T00:00:00")

# Mirrors the seeded animals in lib/livestock-data.ts (baseline vitals).
BASE_ANIMALS = [
    {"animal_id": "COW-001", "temp": 38.4, "hr": 70, "o2": 97, "digest": 90},
    {"animal_id": "COW-002", "temp": 38.5, "hr": 74, "o2": 96, "digest": 87},
    {"animal_id": "COW-003", "temp": 38.3, "hr": 72, "o2": 98, "digest": 89},
    {"animal_id": "COW-004", "temp": 38.4, "hr": 71, "o2": 97, "digest": 88},
    {"animal_id": "COW-005", "temp": 38.2, "hr": 70, "o2": 98, "digest": 91},
    {"animal_id": "COW-006", "temp": 38.5, "hr": 75, "o2": 96, "digest": 86},
    {"animal_id": "SHEEP-001", "temp": 39.0, "hr": 90, "o2": 96, "digest": 87},
    {"animal_id": "SHEEP-002", "temp": 39.1, "hr": 92, "o2": 97, "digest": 88},
]


def smooth_bump(hour: int, start: int, duration: int) -> float:
    """0 at episode edges, 1 at the center - a smooth illness curve."""
    t = max(0.0, min(1.0, (hour - start) / duration))
    return math.sin(math.pi * t) ** 2


def true_health_score(row: dict, animal: dict, interaction: int, rng: random.Random) -> float:
    """The invented 'ground truth' health score (0-100).

    Richer than the rule thresholds on purpose: absolute deviations are
    penalized *plus* an interaction term the rules miss (elevated heart
    rate together with lowered oxygen is worse than either alone).
    """
    temp_dev = max(0.0, row["temperature_c"] - animal["temp_base"])
    hr_dev = max(0.0, row["heart_rate"] - animal["hr_base"])
    o2_dev = max(0.0, animal["o2_base"] - row["oxygen_pct"])
    dig_dev = max(0.0, animal["digest_base"] - row["digest_score"])

    score = (
        100
        - 45 * temp_dev
        - 0.35 * hr_dev
        - 5.0 * o2_dev
        - 0.5 * dig_dev
        - 14 * interaction
        + rng.gauss(0, 3.5)
    )
    return max(0.0, min(100.0, score))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic labeled vitals")
    parser.add_argument("--output", default="scripts/dataset.csv")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    rows = []

    for base in BASE_ANIMALS:
        # Per-animal baseline offset (animals differ even when healthy).
        animal = {
            "temp_base": base["temp"] + rng.uniform(-0.1, 0.1),
            "hr_base": base["hr"] + rng.randint(-4, 4),
            "o2_base": base["o2"] + rng.randint(-1, 1),
            "digest_base": base["digest"] + rng.randint(-3, 3),
        }

        # Illness episodes: 2-4 per animal, 24-72h, mild to severe.
        episodes = []
        for _ in range(rng.randint(2, 4)):
            duration = rng.randint(24, 72)
            start = rng.randint(0, max(0, HOURS - duration))
            severity = rng.uniform(0.6, 1.4)
            episodes.append((start, duration, severity))

        for hour in range(HOURS):
            effect = sum(
                severity * smooth_bump(hour, start, duration)
                for start, duration, severity in episodes
            )

            temperature_c = animal["temp_base"] + 1.1 * effect + rng.gauss(0, 0.12)
            heart_rate = animal["hr_base"] + 16 * effect + rng.gauss(0, 4)
            oxygen_pct = animal["o2_base"] - 4 * effect + rng.gauss(0, 1.2)
            digest_score = animal["digest_base"] - 12 * effect + rng.gauss(0, 3)
            pulse = round(heart_rate + rng.gauss(0, 1))

            row = {
                "animal_id": base["animal_id"],
                "recorded_at": (START + pd.Timedelta(hours=hour)).isoformat(),
                "heart_rate": round(heart_rate),
                "pulse": pulse,
                "temperature_c": round(temperature_c, 1),
                "oxygen_pct": round(oxygen_pct),
                "digest_score": round(digest_score),
                # Interaction the rules cannot express.
                "interaction": 1
                if (max(0.0, heart_rate - animal["hr_base"]) > 10
                    and max(0.0, animal["o2_base"] - oxygen_pct) > 1.5)
                else 0,
            }
            row["verdict"] = (
                "critical"
                if true_health_score(row, animal, row["interaction"], rng) < 35
                else "warning"
                if true_health_score(row, animal, row["interaction"], rng) < 65
                else "healthy"
            )
            row["checkup_at"] = row["recorded_at"]
            rows.append(row)

    df = pd.DataFrame(rows)[
        [
            "animal_id",
            "recorded_at",
            "heart_rate",
            "pulse",
            "temperature_c",
            "oxygen_pct",
            "digest_score",
            "verdict",
            "checkup_at",
        ]
    ]
    df.to_csv(args.output, index=False)
    print(f"Wrote {len(df)} synthetic labeled readings to {args.output}")
    print("Label distribution:")
    print(df["verdict"].value_counts().to_string())
    print("\nPer animal:")
    print(df.groupby("animal_id")["verdict"].value_counts().unstack(fill_value=0).to_string())


if __name__ == "__main__":
    main()
