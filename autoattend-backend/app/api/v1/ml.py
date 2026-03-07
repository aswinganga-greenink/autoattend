"""
ML Router — /api/v1/ml
======================
Endpoints to manage the LBPH face-recognition pipeline:

  GET  /ml/status                — model readiness + registered student count
  POST /ml/register/{user_id}    — launch capture_face.py for a student (webcam on server)
  POST /ml/train                 — (re)train the LBPH model from dataset/
  POST /ml/recognize/{session_id}— run headless recognition, sync CSV → Attendance table
"""

import os
import sys
import csv
import subprocess
import asyncio
from typing import Any
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.api import dependencies
from app.core.config import settings
from app.db.database import get_db
from app.core.utils import is_session_active
from app.models.user import User, UserRole
from app.models.course import Attendance, Session, AttendanceStatus, Course
from app.models.profiles import StudentProfile

router = APIRouter()

# ──────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────

def _module_path(*parts) -> str:
    """Resolve a path relative to ML_MODULE_DIR."""
    return os.path.join(settings.ML_MODULE_DIR, *parts)


def _model_exists() -> bool:
    return os.path.exists(_module_path("trainer.yml"))


def _labels_exists() -> bool:
    return os.path.exists(_module_path("labels.npy"))


def _registered_students() -> list[str]:
    """Return list of student_id folder names inside dataset/."""
    dataset = _module_path("dataset")
    if not os.path.isdir(dataset):
        return []
    return [
        d for d in os.listdir(dataset)
        if os.path.isdir(os.path.join(dataset, d))
    ]


# ──────────────────────────────────────────────────────────
# STATUS
# ──────────────────────────────────────────────────────────

@router.get("/status")
async def ml_status(
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Return ML model readiness and registered student count."""
    registered = _registered_students()
    model_age_seconds = None

    yml = _module_path("trainer.yml")
    if os.path.exists(yml):
        model_age_seconds = int(datetime.now().timestamp() - os.path.getmtime(yml))

    return {
        "model_ready": _model_exists() and _labels_exists(),
        "registered_students": len(registered),
        "student_ids": registered,
        "model_path": yml,
        "model_age_seconds": model_age_seconds,
        "module_dir": settings.ML_MODULE_DIR,
    }


# ──────────────────────────────────────────────────────────
# REGISTER (capture faces for one student)
# ──────────────────────────────────────────────────────────

@router.post("/register/{user_id}")
async def register_student_face(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Capture 180 face photos for the given student (webcam opens on the server machine),
    then immediately retrain the LBPH model with the new data.
    Blocks until both capture and training are complete.
    Students may only register themselves; teachers and admins may register any student.
    """
    # Students may only register their own face
    if current_user.role == UserRole.STUDENT and current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Students can only register their own face.",
        )
    # Only admin, teacher, or the student themselves are allowed
    if current_user.role not in (UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    # Fetch student + their profile
    student_result = await db.execute(
        select(User).where(User.id == user_id, User.role == UserRole.STUDENT)
    )
    student: User | None = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Query the profile separately (backref on StudentProfile returns a list, not scalar)
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Student has no profile (student_id_number). Ask an admin to set it up.",
        )

    student_id_number = profile.student_id_number
    student_name      = student.full_name

    capture_script = _module_path("capture_face.py")
    if not os.path.exists(capture_script):
        raise HTTPException(
            status_code=500,
            detail=f"capture_face.py not found at {capture_script}",
        )

    train_script = _module_path("train.py")
    if not os.path.exists(train_script):
        raise HTTPException(
            status_code=500,
            detail=f"train.py not found at {train_script}",
        )

    dataset_dir = _module_path("dataset", student_id_number)
    os.makedirs(dataset_dir, exist_ok=True)

    # Write name.txt so train.py can read the display name
    with open(os.path.join(dataset_dir, "name.txt"), "w") as f:
        f.write(student_name)

    # ── Step 1: Capture faces ─────────────────────────────────────────────────
    # Runs synchronously in a thread so we don't block the asyncio event loop.
    # The webcam GUI window opens on the server machine.
    # Student presses C to capture each angle, Q/done when all 180 photos taken.
    loop = asyncio.get_event_loop()
    try:
        capture_result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                [
                    sys.executable, capture_script,
                    "--student-id",   student_id_number,
                    "--student-name", student_name,
                ],
                capture_output=True,
                text=True,
                timeout=600,   # 10-minute max for face capture
                cwd=settings.ML_MODULE_DIR,
            )
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Face capture timed out (10 min limit)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Capture script error: {e}")

    if capture_result.returncode not in (0, None):
        raise HTTPException(
            status_code=500,
            detail=f"capture_face.py exited with code {capture_result.returncode}. "
                   f"stderr: {capture_result.stderr[:400]}",
        )

    # Count saved images
    saved_images = len([
        f for f in os.listdir(dataset_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    # ── Step 2: Auto-retrain model ────────────────────────────────────────────
    try:
        train_result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                [sys.executable, train_script],
                capture_output=True,
                text=True,
                timeout=300,   # 5-minute training timeout
                cwd=settings.ML_MODULE_DIR,
            )
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Model retraining timed out after capture")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training after capture failed: {e}")

    if train_result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"train.py failed (code {train_result.returncode}). "
                   f"stderr: {train_result.stderr[:400]}",
        )

    registered = _registered_students()

    return {
        "message": "Face capture complete and model retrained successfully.",
        "student": student_name,
        "student_id_number": student_id_number,
        "images_captured": saved_images,
        "model_retrained": True,
        "total_registered_students": len(registered),
        "train_stdout_tail": train_result.stdout[-500:],
    }


# ──────────────────────────────────────────────────────────
# TRAIN
# ──────────────────────────────────────────────────────────

@router.post("/train")
async def train_model(
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """
    (Re)train the LBPH model from all images in dataset/.
    Runs train.py synchronously — may take a few seconds.
    """
    script = _module_path("train.py")
    if not os.path.exists(script):
        raise HTTPException(status_code=500, detail=f"train.py not found at {script}")

    registered = _registered_students()
    if not registered:
        raise HTTPException(
            status_code=400,
            detail="No students registered in dataset/. Register at least one student first.",
        )

    try:
        result = subprocess.run(
            [sys.executable, script],
            capture_output=True,
            text=True,
            timeout=300,   # 5-minute timeout
            cwd=settings.ML_MODULE_DIR,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Training timed out after 5 minutes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"train.py exited with code {result.returncode}. stderr: {result.stderr[:500]}",
        )

    return {
        "message": "Model trained successfully",
        "students_trained": registered,
        "student_count": len(registered),
        "stdout": result.stdout[-1000:],  # last 1000 chars for brevity
        "model_path": _module_path("trainer.yml"),
    }


# ──────────────────────────────────────────────────────────
# RECOGNIZE  (headless, syncs to DB)
# ──────────────────────────────────────────────────────────

@router.post("/recognize/{session_id}")
async def run_recognition(
    session_id: UUID,
    duration: int = Query(default=1800, ge=10, le=7200,
                          description="Recognition duration in seconds (10–7200)"),
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """Run face recognition exactly like manual terminal runs, but linked to a session."""
    if not _model_exists() or not _labels_exists():
        raise HTTPException(
            status_code=400,
            detail="Model not trained. Run POST /ml/train first.",
        )

    session = (await db.execute(
        select(Session).options(selectinload(Session.course)).where(Session.id == session_id)
    )).scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Strict Timetable Rule: Enforce time check (Allow admins to bypass)
    if current_teacher.role != UserRole.ADMIN:
        if not is_session_active(session):
            raise HTTPException(
                status_code=403, 
                detail="Cannot start AI attendance scan outside of scheduled class time"
            )

    script = _module_path("recognize.py")
    if not os.path.exists(script):
        raise HTTPException(status_code=500, detail="recognize.py not found in module")

    csv_path = _module_path("attendance.csv")

    # Forward the display environment so cv2.imshow works on the local machine
    import copy
    subprocess_env = copy.copy(os.environ)
    subprocess_env.setdefault("DISPLAY", ":0")
    subprocess_env.setdefault("QT_QPA_PLATFORM", "xcb") # Just in case

    # Use the module venv's python if available, otherwise current interpreter
    module_python = os.path.join(settings.ML_MODULE_DIR, "venv", "bin", "python")
    python_exe = module_python if os.path.exists(module_python) else sys.executable

    try:
        result = subprocess.run(
            [
                python_exe, script,
                "--duration", str(duration),
                "--output",   csv_path,
                "--model",    _module_path("trainer.yml"),
                "--labels",   _module_path("labels.npy"),
                "--session",  str(session_id),
            ],
            capture_output=True,
            text=True,
            timeout=duration + 60,
            cwd=settings.ML_MODULE_DIR,
            env=subprocess_env,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Recognition timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recognition script error: {e}")

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"recognize_headless.py exited with code {result.returncode}. "
                   f"stderr: {result.stderr[:500]}",
        )

    # ── Parse CSV and sync to DB ──────────────────────────
    synced, skipped = await _sync_csv_to_db(session_id, csv_path, db)

    return {
        "message": "Recognition complete, attendance synced",
        "session_id": str(session_id),
        "session_course": session.course.name if session.course else None,
        "duration_seconds": duration,
        "records_synced": synced,
        "records_skipped": skipped,
        "stdout_tail": result.stdout[-800:],
    }


# ──────────────────────────────────────────────────────────
# CSV → DB SYNC HELPER
# ──────────────────────────────────────────────────────────

async def _sync_csv_to_db(
    session_id: UUID,
    csv_path: str,
    db: AsyncSession,
) -> tuple[int, int]:
    """
    Parse attendance.csv and upsert Attendance rows for the session.

    CSV columns: Date, StudentID, Status, Minutes, RecordedAt
    Returns (synced_count, skipped_count).
    """
    if not os.path.exists(csv_path):
        return 0, 0

    synced = 0
    skipped = 0

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Handle legacy header where StudentID was called Name
            student_id_number = (row.get("StudentID") or row.get("Name", "")).strip()
            raw_status        = row.get("Status", "absent").strip().lower()

            # The DictReader puts extra un-headered columns into a list under `None` if the file
            # has legacy 5-column headers but 7-column data. The 6th column (index 0 of extra) is SessionID.
            csv_session_id = row.get("SessionID")
            if csv_session_id is None and None in row and len(row[None]) >= 1:
                csv_session_id = row[None][0]
            
            csv_session_id = (csv_session_id or "").strip()

            if not student_id_number:
                skipped += 1
                continue

            # If the row has a SessionID and it doesn't match the current one, skip it
            if csv_session_id and csv_session_id != str(session_id):
                continue

            # Resolve student_id_number → StudentProfile → User
            prof_result = await db.execute(
                select(StudentProfile)
                .where(StudentProfile.student_id_number == student_id_number)
            )
            profile = prof_result.scalar_one_or_none()

            if not profile:
                skipped += 1
                continue

            student_user_id = profile.user_id
            att_status = (
                AttendanceStatus.PRESENT if raw_status == "present"
                else AttendanceStatus.ABSENT
            )

            # Upsert: look for existing record for this student + session
            existing_result = await db.execute(
                select(Attendance).where(
                    Attendance.session_id == session_id,
                    Attendance.student_id == student_user_id,
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                existing.status    = att_status
                existing.timestamp = datetime.utcnow()
            else:
                db.add(Attendance(
                    session_id  = session_id,
                    student_id  = student_user_id,
                    status      = att_status,
                    marked_by   = "ai",
                    timestamp   = datetime.utcnow(),
                ))

            synced += 1

    await db.commit()
    return synced, skipped
