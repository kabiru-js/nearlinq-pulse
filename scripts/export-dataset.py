"""Export labeled training data from the Nearling Pulse database.

One row per vital reading that falls inside a label window before a vet
check-up that recorded a VERDICT. The sensor readings are the features;
the vet's verdict is the ground-truth label.

Usage:
    python -m venv .venv                      # once
    pip install -r scripts/requirements.txt   # once
    DATABASE_URL=postgres://... python scripts/export-dataset.py

Outputs scripts/dataset.csv (or --output <path>).
"""
import argparse
import os
from datetime import timedelta

import pandas as pd
import psycopg

DEFAULT_WINDOW_HOURS = 24

COLUMNS = [
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Export labeled vitals for ML training")
    parser.add_argument("--output", default="scripts/dataset.csv")
    parser.add_argument("--window-hours", type=int, default=DEFAULT_WINDOW_HOURS,
                        help="How far back before a check-up readings are labeled")
    args = parser.parse_args()

    conn_str = os.environ.get("DATABASE_URL")
    if not conn_str:
        raise SystemExit("DATABASE_URL is not set")

    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    a.id AS animal_id,
                    v.recorded_at,
                    v.heart_rate, v.pulse, v.temperature_c, v.oxygen_pct, v.digest_score,
                    c.verdict, c.performed_at
                FROM checkups c
                JOIN animals a ON a.id = c.animal_id
                JOIN vitals v ON v.animal_id = c.animal_id
                WHERE c.verdict IS NOT NULL
                  AND v.recorded_at <= c.performed_at
                  AND v.recorded_at >= c.performed_at - %s
                ORDER BY a.id, v.recorded_at
                """,
                (timedelta(hours=args.window_hours),),
            )
            rows = cur.fetchall()

    df = pd.DataFrame(rows, columns=COLUMNS)
    if df.empty:
        raise SystemExit(
            "No labeled readings found. Record check-ups with a verdict first "
            "(the verdict buttons in the Record Check-up form)."
        )

    df.to_csv(args.output, index=False)
    print(f"Wrote {len(df)} labeled readings to {args.output}")
    print("Label distribution:")
    print(df["verdict"].value_counts().to_string())


if __name__ == "__main__":
    main()
