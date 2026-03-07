"""
Module 3 — Face Recognition & Attendance Tracking
===================================================
Loads the trained LBPH model, recognises students via webcam,
tracks how long each student is on screen, and writes results
to  attendance.csv  when you quit.

Usage:
    python recognize.py

Controls:
    Q  — quit and save attendance
"""

import cv2
import numpy as np
import csv
import os
import sys
import time
import argparse
from datetime import datetime

# ──────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Face recognition attendance")
parser.add_argument("--duration",  type=int,  default=0,
                    help="How many seconds to run (0 = run forever)")
parser.add_argument("--output",    type=str,  default=None,
                    help="Path to write attendance.csv")
parser.add_argument("--model",     type=str,  default=None,
                    help="Path to trainer.yml")
parser.add_argument("--labels",    type=str,  default=None,
                    help="Path to labels.npy")
parser.add_argument("--session",   type=str,  default="",
                    help="Session UUID (used as SessionID in the CSV)")
args = parser.parse_args()

CAMERA_INDEX         = 0      # built-in webcam

_HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH      = args.model   or os.path.join(_HERE, "trainer.yml")
LABELS_PATH     = args.labels  or os.path.join(_HERE, "labels.npy")
ATTENDANCE_FILE = args.output  or os.path.join(_HERE, "attendance.csv")

# Recognition tuning
# LBPH distance: 0 = perfect match, higher = worse.
# Tune CONFIDENCE_THRESHOLD based on the scores printed in the terminal:
#   score < 50  → very confident match
#   50–80       → acceptable match  (threshold lives here)
#   80–100      → weak match
#   > 100       → almost certainly wrong person
CONFIDENCE_THRESHOLD = 90
CONFIRM_FRAMES       = 5     # consecutive confirmed frames before starting timer (reduced for faster response)
MIN_FACE_AREA        = 2500  # ignore tiny detections (px²) — reduced from 4000 to catch more distances

# Attendance rules
if args.duration > 0:
    MIN_PRESENT_SECONDS = args.duration * 0.50
    print(f"INFO: Running for {args.duration}s. Present threshold set to 50% ({MIN_PRESENT_SECONDS:.0f}s)")
else:
    MIN_PRESENT_SECONDS = 20
    print(f"INFO: Running indefinitely. Present threshold set to {MIN_PRESENT_SECONDS}s")

# ──────────────────────────────────────────────
# LOAD MODEL + LABELS
# ──────────────────────────────────────────────
model_path  = os.path.abspath(MODEL_PATH)
labels_path = os.path.abspath(LABELS_PATH)

if not os.path.exists(model_path):
    print(f"❌  Model not found: {model_path}")
    print("    Run  train.py  first.")
    exit(1)

if not os.path.exists(labels_path):
    print(f"❌  Labels file not found: {labels_path}")
    print("    Run  train.py  first.")
    exit(1)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

recognizer = cv2.face.LBPHFaceRecognizer_create()
recognizer.read(model_path)

label_map: dict = np.load(labels_path, allow_pickle=True).item()
print(f"✅  Model loaded — {len(label_map)} registered student(s): {[v['name'] for v in label_map.values()]}")

# ──────────────────────────────────────────────
# TRACKING STATE
# ──────────────────────────────────────────────
# frame_counter  — frames a name has been consecutively confirmed
# attendance     — per-student timing dict
#     "last_seen"  : float timestamp of the last frame they were seen
#     "total_time" : float total seconds accumulated
#     "present"    : bool — True once >= MIN_PRESENT_SECONDS

frame_counter: dict = {}
attendance:   dict = {}

# ──────────────────────────────────────────────
# CAMERA
# ──────────────────────────────────────────────
cap = cv2.VideoCapture(CAMERA_INDEX)
if not cap.isOpened():
    print(f"❌  Cannot open camera {CAMERA_INDEX}.")
    exit(1)

# ── Pre-warm camera so the sensor has time to adjust exposure ──
print("📸  Warming up camera...")
for _ in range(10):
    cap.read()
print("🎥  Recognition running — press  Q or C  to quit and save attendance.\n")

window_name = "AutoAttender - Recognition"
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(window_name, 800, 600)

# Show the window immediately so user knows it started
ret, _init_frame = cap.read()
if ret:
    cv2.imshow(window_name, _init_frame)
    cv2.waitKey(1)

# ──────────────────────────────────────────────
# MAIN LOOP
# ──────────────────────────────────────────────
seen_this_frame: set = set()   # which names were spotted each frame

# Last-known face buffer — keeps box visible during brief detection gaps
last_face   = None   # (x, y, w, h) from last successful detection
last_label  = ""     # name shown in that position
last_color  = (200, 200, 200)
miss_streak = 0      # frames since last successful detection
MAX_MISS    = 8      # frames to hold last position before clearing

start_time = time.time()
end_time   = start_time + args.duration if args.duration > 0 else float("inf")

while time.time() < end_time:
    ret, frame = cap.read()
    if not ret:
        print("⚠️  Frame grab failed.")
        break

    gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_eq = cv2.equalizeHist(gray)   # improve contrast for recognition

    faces = face_cascade.detectMultiScale(
        gray_eq,
        scaleFactor=1.1,    # was 1.05 — slightly faster, still catches most scales
        minNeighbors=3,     # was 4 — more sensitive, catches more faces
        minSize=(50, 50)    # was (60,60) — detect slightly smaller faces
    )

    now = time.time()
    seen_this_frame.clear()

    for (x, y, w, h) in faces:
        if w * h < MIN_FACE_AREA:
            continue   # skip tiny / distant faces

        # Apply equalizeHist to the crop — MUST match what train.py produces
        face_roi = cv2.equalizeHist(cv2.resize(gray[y: y + h, x: x + w], (100, 100)))
        label, confidence = recognizer.predict(face_roi)

        # DEBUG: prints live — use these numbers to fine-tune CONFIDENCE_THRESHOLD
        name_guess = label_map.get(label, {}).get("name", "?")
        print(f"  score={confidence:.1f}  guess={name_guess}  threshold={CONFIDENCE_THRESHOLD}")

        if confidence <= CONFIDENCE_THRESHOLD and label in label_map:
            sid = label_map[label]["id"]
            sname = label_map[label]["name"]
            frame_counter[sid] = frame_counter.get(sid, 0) + 1

            if frame_counter[sid] >= CONFIRM_FRAMES:
                seen_this_frame.add(sid)

                if sid not in attendance:
                    attendance[sid] = {
                        "name":       sname,
                        "last_seen":  now,
                        "total_time": 0.0,
                        "present":    False,
                    }
                else:
                    elapsed = now - attendance[sid]["last_seen"]
                    if elapsed < 10:
                        attendance[sid]["total_time"] += elapsed
                    attendance[sid]["last_seen"] = now

                if attendance[sid]["total_time"] >= MIN_PRESENT_SECONDS:
                    attendance[sid]["present"] = True

                total_mins = int(attendance[sid]["total_time"] / 60)
                total_secs = int(attendance[sid]["total_time"] % 60)
                label_text  = f"{sname}  {total_mins}m {total_secs:02d}s"
                box_color   = (0, 255, 0)   # green = recognised
            else:
                label_text = f"Verifying {sname}..."
                box_color  = (0, 200, 255)  # yellow = building confidence

        else:
            # Unknown or poor match
            sid_to_pop = label_map.get(label, {}).get("id", "")
            frame_counter.pop(sid_to_pop, None)  # reset counter
            label_text = "Unknown"
            box_color  = (0, 0, 255)   # red

        # Update last-known buffer on every successful detection
        last_face  = (x, y, w, h)
        last_label = label_text
        last_color = box_color
        miss_streak = 0

        cv2.rectangle(frame, (x, y), (x + w, y + h), box_color, 2)
        cv2.putText(frame, label_text, (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, box_color, 2)

    # ── If no face detected this frame, hold the last known box briefly ──
    if len(faces) == 0 and last_face is not None:
        miss_streak += 1
        if miss_streak <= MAX_MISS:
            lx, ly, lw, lh = last_face
            # Draw faded (half-alpha look via lighter colour)
            faded_color = tuple(max(0, c - 80) for c in last_color)
            cv2.rectangle(frame, (lx, ly), (lx + lw, ly + lh), faded_color, 1)
            cv2.putText(frame, last_label, (lx, ly - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, faded_color, 1)
        else:
            last_face = None   # too many misses — clear buffer

    # ── HUD — list confirmed students and their time ──
    hud_y = 25
    for sid, data in attendance.items():
        sname = data.get("name", sid)
        mins  = int(data["total_time"] / 60)
        secs  = int(data["total_time"] % 60)
        mark  = "✓" if data["present"] else "…"
        hud   = f"{mark} {sname}: {mins}m {secs:02d}s"
        color = (0, 255, 120) if data["present"] else (200, 200, 200)
        cv2.putText(frame, hud, (10, hud_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        hud_y += 25

    cv2.imshow(window_name, frame)
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q') or key == ord('c'):
        break

cap.release()
cv2.destroyAllWindows()

# ──────────────────────────────────────────────
# WRITE ATTENDANCE CSV (Per Session)
# ──────────────────────────────────────────────
today      = datetime.now().strftime("%Y-%m-%d")
time_stamp = datetime.now().strftime("%H:%M:%S")
session_start_str = datetime.fromtimestamp(start_time).strftime("%Y-%m-%d %H:%M:%S")

all_students = set(v["id"] for v in label_map.values())
att_path = os.path.abspath(ATTENDANCE_FILE)

write_header = not os.path.exists(att_path) or os.path.getsize(att_path) == 0
with open(att_path, "a", newline="") as f:
    writer = csv.writer(f)
    if write_header:
        writer.writerow(["Date", "StudentID", "Status", "Minutes", "RecordedAt", "SessionID", "SessionStart"])
        
    for sid in sorted(all_students):
        info   = attendance.get(sid, {})
        status = "present" if info.get("present") else "absent"
        mins   = round(info.get("total_time", 0) / 60, 1)
        writer.writerow([today, sid, status, mins, time_stamp, args.session, session_start_str])

print("\n📊  Session Summary")
print("─" * 40)
for sid in sorted(all_students):
    if sid in attendance:
        sname = attendance[sid].get("name", sid)
        mins  = int(attendance[sid]["total_time"] / 60)
        secs  = int(attendance[sid]["total_time"] % 60)
        mark  = "✅ Present" if attendance[sid]["present"] else "❌ Absent"
        print(f"  {mark}  {sname} ({sid})  —  {mins}m {secs:02d}s on screen")
    else:
        # We don't have the name easily if they never appeared, but sid works
        # Let's find their name from label_map just to be nice
        sname = sid
        for v in label_map.values():
            if v["id"] == sid:
                sname = v["name"]
                break
        print(f"  ❌ Absent   {sname} ({sid})  —  never appeared")

print("─" * 40)
print(f"✅  Attendance saved → {att_path}")
