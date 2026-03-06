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
CONFIRM_FRAMES       = 8    # consecutive frames before counting as seen
MIN_FACE_AREA        = 4000 # px² — ignore tiny faces
MIN_PRESENT_SECONDS  = 20   # seconds on-screen to mark PRESENT

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
print(f"INFO: Model loaded — {len(label_map)} student(s): {list(label_map.values())}", flush=True)

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

# Warm up
cap.read()

start_time   = time.time()
end_time     = start_time + args.duration
frames_read  = 0

print(f"INFO: Recognition started — running for {args.duration}s …", flush=True)

# ─────────────────────────────────────────────
# MAIN LOOP  (no imshow — headless)
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
        gray_eq, scaleFactor=1.05, minNeighbors=4, minSize=(60, 60)
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
            name = label_map[label]          # human-readable name
            # Note: label_map key is int (label index), value is student_id_number
            frame_counter[name] = frame_counter.get(name, 0) + 1

            if frame_counter[name] >= CONFIRM_FRAMES:
                if name not in attendance:
                    attendance[name] = {
                        "last_seen":  now,
                        "total_time": 0.0,
                        "present":    False,
                    }
                else:
                    elapsed = now - attendance[name]["last_seen"]
                    if elapsed < 10:            # ignore gaps > 10 s
                        attendance[name]["total_time"] += elapsed
                    attendance[name]["last_seen"] = now

                if attendance[name]["total_time"] >= MIN_PRESENT_SECONDS:
                    attendance[name]["present"] = True

                elapsed_total = int(time.time() - start_time)
                print(
                    f"INFO: {name}  seen={frame_counter[name]}  "
                    f"on-screen={attendance[name]['total_time']:.1f}s  "
                    f"present={attendance[name]['present']}  "
                    f"elapsed={elapsed_total}s",
                    flush=True,
                )
        else:
            frame_counter.pop(label_map.get(label, ""), None)

cap.release()
print(f"INFO: Camera released. Frames processed: {frames_read}", flush=True)

# ─────────────────────────────────────────────
# WRITE ATTENDANCE CSV
# ─────────────────────────────────────────────
today      = datetime.now().strftime("%Y-%m-%d")
time_stamp = datetime.now().strftime("%H:%M:%S")
all_students = set(label_map.values())   # all registered student_id_numbers

# De-duplicate: don't re-write if today's record already exists
existing_today: set = set()
if os.path.exists(ATTENDANCE_FILE):
    with open(ATTENDANCE_FILE, newline="") as rf:
        for row in csv.reader(rf):
            if len(row) >= 2 and row[0] == today:
                existing_today.add(row[1])

with open(ATTENDANCE_FILE, "a", newline="") as f:
    writer = csv.writer(f)
    if os.path.getsize(ATTENDANCE_FILE) == 0:
        writer.writerow(["Date", "StudentID", "Status", "Minutes", "RecordedAt"])

    for sid in sorted(all_students):
        if sid in existing_today:
            continue

        info   = attendance.get(sid, {})
        status = "present" if info.get("present") else "absent"
        mins   = int(info.get("total_time", 0) / 60)
        writer.writerow([today, sid, status, mins, time_stamp])

print(f"INFO: Attendance written → {ATTENDANCE_FILE}", flush=True)

# Print summary
print("\n── Session Summary ──")
for sid in sorted(all_students):
    info = attendance.get(sid, {})
    mark = "PRESENT" if info.get("present") else "ABSENT"
    secs = int(info.get("total_time", 0))
    print(f"  {mark}  {sid}  — {secs}s on-screen")

sys.exit(0)
