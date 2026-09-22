from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
JSON_FILE = BASE_DIR / "data" / "day-plan.json"
INLINE_FILE = BASE_DIR / "data" / "day-plan-inline.js"


def build_night_focus_plan(day: dict) -> list[dict]:
    files = day.get("files", [])
    videos = [f for f in files if f.lower().endswith(".mp4")]
    notes_pdf = [f for f in files if f.lower().endswith(".pdf") and "dpp" not in f.lower()]
    dpps = [f for f in files if "dpp" in f.lower()]
    other_files = [f for f in files if f not in videos and f not in notes_pdf and f not in dpps]
    test_files = day.get("test_files", [])
    test_number = day.get("test_number")

    focus_plan = []

    # Block 1: 22:00 - 23:15 (75 min Concept Sprint)
    if videos:
        focus_plan.append({
            "title": "22:00-23:15: Watch lecture (1.25x-1.5x) & annotate class notes",
            "files": videos + notes_pdf,
        })
    elif notes_pdf or other_files:
        focus_plan.append({
            "title": "22:00-23:00: High-yield concept recap & formula review",
            "files": notes_pdf + other_files,
        })
    else:
        focus_plan.append({
            "title": "22:00-23:00: Target concept recap & weak area drilling",
            "files": ["Planner/Core/STELLAR_MASTER_STUDY_PLAN.md"],
        })

    # Block 2: 23:15 - 23:50 (35 min Practice Sprint)
    if dpps:
        focus_plan.append({
            "title": "23:15-23:50: Timed DPP sprint (15-20 target questions)",
            "files": dpps,
        })
    elif test_files and test_number:
        focus_plan.append({
            "title": f"23:00-23:50: PT{test_number:02d} timed sectional drill & accuracy test",
            "files": test_files,
        })
    else:
        focus_plan.append({
            "title": "23:00-23:50: Timed 20-question mixed practice drill",
            "files": [],
        })

    # Block 3: 23:50 - 00:00 (10 min Review & Error Log)
    focus_plan.append({
        "title": "23:50-00:00: Log mistakes in error tracker & daily wind down",
        "files": [],
    })

    return focus_plan


def reschedule(start_date_str: str = "2026-09-27"):
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    days = data.get("days", [])
    new_days = []
    for i, day in enumerate(days):
        d = start_date + timedelta(days=i)
        day_copy = dict(day)
        day_copy["date"] = d.strftime("%Y-%m-%d")
        day_copy["weekday"] = d.strftime("%A")
        day_copy["focus_plan"] = build_night_focus_plan(day_copy)

        # Update notes with realistic night protocol notes
        notes = []
        is_weekend = day_copy["weekday"] in ["Saturday", "Sunday"]
        if day_copy.get("test_number"):
            pt_num = day_copy["test_number"]
            notes.append(f"Weekend Heavy: PT{pt_num:02d} + targeted post-test error review (22:00-00:00)")
            notes.append("Office Tip: Complete PT on weekend night slot; analyze incorrect questions before sleep.")
        elif day_copy["weekday"] == "Friday":
            notes.append("Light Friday Close: 60-minute weekly concept recap + update error log + plan weekend tests")
        elif "Revision" in day_copy.get("core", ""):
            notes.append("Revision Day: Redo wrong questions from error log + 20 timed mixed questions")
        else:
            notes.append("Daily Sprint (10 PM - 12 AM): 75m Lecture (1.25x) + 35m DPP + 10m Error Log")

        day_copy["notes"] = notes
        new_days.append(day_copy)

    payload = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "start_date": start_date_str,
        "days": new_days,
    }

    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    with open(INLINE_FILE, "w", encoding="utf-8") as f:
        f.write("window.__DAY_PLAN_INLINE = ")
        json.dump(payload, f, ensure_ascii=False)
        f.write(";\n")

    print(f"Rescheduled {len(new_days)} days starting from {start_date_str} to {new_days[-1]['date']} with 10-12 night schedule.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reschedule Stellar EMS day plan starting date.")
    parser.add_argument("--start", default="2026-09-27", help="Start date (YYYY-MM-DD), default: 2026-09-27")
    args = parser.parse_args()
    reschedule(args.start)
