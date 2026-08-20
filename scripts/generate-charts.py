"""Generate the result charts for docs/A-Z-GUIDE.md.

Also computes the RULE-BASELINE metrics on the exact same animal-grouped
test split used by train.py, so the "Rules" bars in the charts are real
numbers, not estimates.

Usage: python scripts/generate-charts.py
Output: docs/charts/*.png
"""
import os
import random

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

OUT_DIR = os.path.join("docs", "charts")
os.makedirs(OUT_DIR, exist_ok=True)

GREEN = "#22c55e"
YELLOW = "#eab308"
RED = "#ef4444"
BLUE = "#3b82f6"
GRAY = "#9ca3af"

CLASSES = ["healthy", "warning", "critical"]


def rule_based(row):
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


def rules_metrics_on_test():
    """Replicate train.py's seeded animal split and score the rules on test."""
    df = pd.read_csv("scripts/dataset.csv")
    animals = df["animal_id"].unique().tolist()
    random.Random(42).shuffle(animals)
    n = len(animals)
    n_train = int(n * 0.6)
    n_val = int(n * 0.2)
    test_a = set(animals[n_train + n_val :])
    test = df[df["animal_id"].isin(test_a)].copy()
    y = test["verdict"].values
    p = test.apply(rule_based, axis=1).values

    acc = float(np.mean(p == y))
    crit_mask = y == "critical"
    crit_recall = float(np.mean(p[crit_mask] == "critical"))
    warn_mask = y == "warning"
    warn_recall = float(np.mean(p[warn_mask] == "warning")) if warn_mask.sum() else 0.0
    warn_prec = float(np.mean(y[p == "warning"] == "warning")) if (p == "warning").sum() else 0.0
    healthy_prec = float(np.mean(y[p == "healthy"] == "healthy")) if (p == "healthy").sum() else 0.0
    return dict(acc=acc, crit_recall=crit_recall, warn_recall=warn_recall,
                warn_prec=warn_prec, healthy_prec=healthy_prec)


def bar_chart(filename, title, labels, values, colors, ymax=1.0, ylabel=""):
    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=150)
    bars = ax.bar(labels, values, color=colors, width=0.62, edgecolor="white")
    for bar, v in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 0.015, f"{v:.3f}",
                ha="center", va="bottom", fontsize=9)
    ax.set_ylim(0, ymax)
    ax.set_title(title, fontsize=12, fontweight="bold")
    ax.set_ylabel(ylabel)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, filename), bbox_inches="tight")
    plt.close(fig)


def pie_chart():
    fig, ax = plt.subplots(figsize=(6.5, 4.5), dpi=150)
    sizes = [5155, 415, 190]
    labels = ["Healthy", "Critical", "Warning"]
    colors = [GREEN, RED, YELLOW]
    ax.pie(sizes, labels=[f"{l}\n{n} ({n/5760:.1%})" for l, n in zip(labels, sizes)],
           colors=colors, startangle=90, counterclock=False,
           wedgeprops={"edgecolor": "white", "linewidth": 2})
    ax.set_title("Synthetic dataset label distribution (5,760 readings)", fontsize=12, fontweight="bold")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "dataset-distribution.png"), bbox_inches="tight")
    plt.close(fig)


def confusion_heatmap():
    cm = np.array([[1908, 16, 2], [30, 18, 40], [1, 0, 145]])
    fig, ax = plt.subplots(figsize=(6, 4.5), dpi=150)
    im = ax.imshow(cm, cmap="YlGnBu")
    ax.set_xticks(range(3), CLASSES)
    ax.set_yticks(range(3), CLASSES)
    ax.set_xlabel("Predicted", fontweight="bold")
    ax.set_ylabel("Actual", fontweight="bold")
    ax.set_title("Phase 3 confusion matrix (test set, tuned thresholds)", fontsize=12, fontweight="bold")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > 800 else "black", fontsize=13, fontweight="bold")
    ax.set_xticks(np.arange(-0.5, 3, 1), minor=True)
    ax.set_yticks(np.arange(-0.5, 3, 1), minor=True)
    ax.grid(which="minor", color="white", linewidth=2)
    ax.tick_params(which="minor", length=0)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "confusion-matrix.png"), bbox_inches="tight")
    plt.close(fig)


def calibration_chart():
    bins = ["0.4–0.5", "0.5–0.6", "0.6–0.7", "0.7–0.8", "0.8–0.9", "0.9–1.0"]
    mean_pred = [0.466, 0.553, 0.643, 0.756, 0.860, 0.987]
    acc = [0.385, 0.345, 0.483, 0.567, 0.714, 0.990]
    x = np.arange(len(bins))
    w = 0.36
    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=150)
    ax.bar(x - w / 2, mean_pred, w, label="Mean predicted probability", color=BLUE, edgecolor="white")
    ax.bar(x + w / 2, acc, w, label="Observed accuracy", color=GRAY, edgecolor="white")
    ax.set_xticks(x, bins)
    ax.set_ylim(0, 1.1)
    ax.set_title("Reliability: predicted probability bins vs accuracy (Phase 3)", fontsize=12, fontweight="bold")
    ax.set_xlabel("Predicted probability bin")
    ax.legend(frameon=False)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "calibration.png"), bbox_inches="tight")
    plt.close(fig)


def cv_chart():
    folds = ["COW-004", "COW-005", "SHEEP-001", "SHEEP-002", "COW-003", "COW-006", "COW-001", "COW-002"]
    accs = [0.976, 0.967, 0.968, 0.967, 0.964, 0.968, 0.971, 0.963]
    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=150)
    bars = ax.bar(folds, accs, color=GREEN, width=0.6, edgecolor="white")
    for bar, v in zip(bars, accs):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 0.002, f"{v:.3f}",
                ha="center", va="bottom", fontsize=8.5)
    ax.axhline(np.mean(accs), color=GRAY, linestyle="--", linewidth=1)
    ax.text(len(folds) - 0.4, np.mean(accs) + 0.002, f"mean {np.mean(accs):.3f}",
            ha="right", fontsize=9, color=GRAY)
    ax.set_ylim(0.92, 1.0)
    ax.set_title("Cross-validation by animal (held-out accuracy)", fontsize=12, fontweight="bold")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT_DIR, "cross-validation.png"), bbox_inches="tight")
    plt.close(fig)


def main():
    rules = rules_metrics_on_test()
    print("Rule baseline metrics on the train.py test split:")
    for k, v in rules.items():
        print(f"  {k}: {v:.3f}")

    # 5.2 accuracy
    bar_chart("accuracy.png", "Accuracy vs rule baseline (test set)",
              ["Rules", "Phase 1", "Phase 2", "Phase 3"],
              [rules["acc"], 0.954, 0.958, 0.959],
              [GRAY, "#60a5fa", BLUE, "#1d4ed8"])

    # 5.3 critical recall
    bar_chart("critical-recall.png", "Critical recall — the expensive-error protection",
              ["Rules", "Phase 1", "Phase 2", "Phase 3"],
              [rules["crit_recall"], 0.91, 0.98, 0.99],
              [GRAY, "#fca5a5", "#f87171", RED])

    # 5.4 warning
    bar_chart("warning.png", "Warning recall and precision across phases",
              ["P1 rec", "P1 prec", "P2 rec", "P2 prec", "P3 rec", "P3 prec"],
              [0.14, 0.38, 0.20, 0.55, 0.20, 0.53],
              [YELLOW, "#fde047", YELLOW, "#fde047", YELLOW, "#fde047"],
              ymax=0.8)

    # 5.1 pie
    pie_chart()
    # 5.5 heatmap
    confusion_heatmap()
    # 5.6 calibration
    calibration_chart()
    # 5.7 cv
    cv_chart()

    print(f"\nWrote charts to {OUT_DIR}/")


if __name__ == "__main__":
    main()
