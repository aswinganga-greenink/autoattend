"""
recognize_headless.py  — Headless LBPH Recognition for AutoAttend Backend
==========================================================================
Runs face recognition from the webcam for a fixed duration with NO display
window. Designed to be called by the FastAPI backend via subprocess.

Usage:
    python recognize_headless.py --duration 1800 --output attendance.csv

Exit codes:
    0  — success, attendance.csv written
    1  — error (model not found, camera unavailable, etc.)
"""

import cv2
import numpy as np
import csv
import os
import sys
import time
import argparse
from datetime import datetime

# ─────────────────────────────────────────────
# CLI ARGS
# ─────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Headless face-recognition attendance")
parser.add_argument("--duration",  type=int,  default=1800,
                    help="How many seconds to run (default: 1800 = 30 min)")
parser.add_argument("--output",    type=str,  default=None,
                    help="Path to write attendance.csv (default: next to this script)")
parser.add_argument("--model",     type=str,  default=None,
                    help="Path to trainer.yml (default: auto-detected)")
parser.add_argument("--labels",    type=str,  default=None,
                    help="Path to labels.npy (default: auto-detected)")
parser.add_argument("--session",   type=str,  default="",
                    help="Session UUID (used as SessionID in the CSV)")
args = parser.parse_args()

# ─────────────────────────────────────────────
# RESOLVE PATHS
# ─────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH      = args.model   or os.path.join(_HERE, "trainer.yml")
LABELS_PATH     = args.labels  or os.path.join(_HERE, "labels.npy")
ATTENDANCE_FILE = args.output  or os.path.join(_HERE, "attendance.csv")

# ─────────────────────────────────────────────
# RECOGNITION CONFIG
# ─────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 90   # LBPH distance — lower = better
CONFIRM_FRAMES       = 5    # consecutive frames before counting as seen
MIN_FACE_AREA        = 2500 # px² — ignore tiny faces
# MIN_PRESENT_SECONDS is now computed as 50% of session duration at runtime

# ─────────────────────────────────────────────
# LOAD MODEL + LABELS
# ─────────────────────────────────────────────
if not os.path.exists(MODEL_PATH):
    print(f"ERROR: Model not found: {MODEL_PATH}", file=sys.stderr)
    sys.exit(1)

if not os.path.exists(LABELS_PATH):
    print(f"ERROR: Labels not found: {LABELS_PATH}", file=sys.stderr)
    sys.exit(1)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

recognizer = cv2.face.LBPHFaceRecognizer_create()
recognizer.read(MODEL_PATH)

label_map: dict = np.load(LABELS_PATH, allow_pickle=True).item()
# label_map: {int_label: {"id": student_id_number, "name": display_name}}
# The CSV StudentID column needs to match StudentProfile.student_id_number in the DB.
print(f"INFO: Model loaded — {len(label_map)} student(s): {[v['id'] for v in label_map.values()]}", flush=True)

# ─────────────────────────────────────────────
# TRACKING STATE
# ─────────────────────────────────────────────
frame_counter: dict = {}
attendance:    dict = {}

# ─────────────────────────────────────────────
# CAMERA
# ─────────────────────────────────────────────
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("ERROR: Cannot open camera 0.", file=sys.stderr)
    sys.exit(1)

# Warm up camera
print("INFO: Warming up camera...", flush=True)
for _ in range(10):
    cap.read()

start_time   = time.time()
end_time     = start_time + args.duration
frames_read  = 0

# Present threshold = 50% of the total session time
MIN_PRESENT_SECONDS = args.duration * 0.50

print(f"INFO: Recognition started — running for {args.duration}s (present threshold: {MIN_PRESENT_SECONDS:.0f}s) …", flush=True)

SESSION_ID    = args.session
SESSION_START = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# ─────────────────────────────────────────────
# MAIN LOOP  (no display — pure headless)
# ─────────────────────────────────────────────
while time.time() < end_time:
    ret, frame = cap.read()
    if not ret:
        time.sleep(0.05)
        continue

    frames_read += 1

    gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_eq = cv2.equalizeHist(gray)

    faces = face_cascade.detectMultiScale(
        gray_eq,
        scaleFactor=1.1,
        minNeighbors=3,
        minSize=(50, 50)
    )

    now = time.time()

    for (x, y, w, h) in faces:
        if w * h < MIN_FACE_AREA:
            continue

        face_roi = cv2.equalizeHist(
            cv2.resize(gray[y: y + h, x: x + w], (100, 100))
        )
        label, confidence = recognizer.predict(face_roi)

        if confidence <= CONFIDENCE_THRESHOLD and label in label_map:
            sid = label_map[label]["id"]          # student ID string
            sname = label_map[label]["name"]      # human name (for logs if needed)

            frame_counter[sid] = frame_counter.get(sid, 0) + 1

            if frame_counter[sid] >= CONFIRM_FRAMES:
                if sid not in attendance:
                    attendance[sid] = {
                        "name":       sname,
                        "last_seen":  now,
                        "total_time": 0.0,
                        "present":    False,
                    }
                else:
                    elapsed = now - attendance[sid]["last_seen"]
                    if elapsed < 10:            # ignore gaps > 10 s
                        attendance[sid]["total_time"] += elapsed
                    attendance[sid]["last_seen"] = now

                if attendance[sid]["total_time"] >= MIN_PRESENT_SECONDS:
                    attendance[sid]["present"] = True

                label_text = f"{sname}  {int(attendance[sid]['total_time']//60)}m {int(attendance[sid]['total_time']%60):02d}s"
                box_color  = (0, 255, 0) if attendance[sid]["present"] else (0, 200, 255)

                elapsed_total = int(time.time() - start_time)
                print(
                    f"INFO: {sname}  seen={frame_counter[sid]}  "
                    f"on-screen={attendance[sid]['total_time']:.1f}s  "
                    f"present={attendance[sid]['present']}  "
                    f"elapsed={elapsed_total}s",
                    flush=True,
                )
        else:
            sid_to_pop = label_map.get(label, {}).get("id", "")
            frame_counter.pop(sid_to_pop, None)

cap.release()
print(f"INFO: Camera released. Frames processed: {frames_read}", flush=True)

# ─────────────────────────────────────────────
# WRITE ATTENDANCE CSV  (per session + student, not per day)
# ─────────────────────────────────────────────
today      = datetime.now().strftime("%Y-%m-%d")
time_stamp = datetime.now().strftime("%H:%M:%S")
all_students = set(v["id"] for v in label_map.values())

# Write all students (present or absent) — one fresh row per session
write_header = not os.path.exists(ATTENDANCE_FILE) or os.path.getsize(ATTENDANCE_FILE) == 0
with open(ATTENDANCE_FILE, "a", newline="") as f:
    writer = csv.writer(f)
    if write_header:
        writer.writerow(["Date", "StudentID", "Status", "Minutes", "RecordedAt", "SessionID", "SessionStart"])

    for sid in sorted(all_students):
        info   = attendance.get(sid, {})
        status = "present" if info.get("present") else "absent"
        mins   = round(info.get("total_time", 0) / 60, 1)
        writer.writerow([today, sid, status, mins, time_stamp, SESSION_ID, SESSION_START])

print(f"INFO: Attendance written → {ATTENDANCE_FILE}", flush=True)

# Print summary
print("\n── Session Summary ──")
for sid in sorted(all_students):
    info = attendance.get(sid, {})
    mark = "PRESENT" if info.get("present") else "ABSENT"
    secs = int(info.get("total_time", 0))
    print(f"  {mark}  {sid}  — {secs}s on-screen")

sys.exit(0)
