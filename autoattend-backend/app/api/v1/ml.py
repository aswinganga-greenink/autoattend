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
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api import dependencies
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.course import Attendance, Session, AttendanceStatus
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
    current_user: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """
    Launch capture_face.py for the given student.
    A webcam window will open on the server machine.
    The script runs interactively (press C/Q as per README).
    This endpoint returns immediately — check dataset/ for output.
    """
    # Fetch student + their profile
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile))
        .where(User.id == user_id, User.role == UserRole.STUDENT)
    )
    student: User | None = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = student.student_profile
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Student has no profile (student_id_number). Create the profile first.",
        )

    student_id_number = profile.student_id_number
    student_name      = student.full_name

    script = _module_path("capture_face.py")
    if not os.path.exists(script):
        raise HTTPException(
            status_code=500,
            detail=f"capture_face.py not found at {script}",
        )

    dataset_dir = _module_path("dataset", student_id_number)
    os.makedirs(dataset_dir, exist_ok=True)

    # Write name.txt so train.py can read the display name
    with open(os.path.join(dataset_dir, "name.txt"), "w") as f:
        f.write(student_name)

    # Launch the interactive capture script in a new detached process
    # (it needs a display/webcam — runs on whatever machine the server is on)
    try:
        proc = subprocess.Popen(
            [sys.executable, script],
            stdin=subprocess.PIPE,
            cwd=settings.ML_MODULE_DIR,
            # Pass student_id and name via stdin (script uses input())
            # We'll write them immediately
        )
        # Send student_id and student_name to the script's stdin prompts
        proc.stdin.write(f"{student_id_number}\n{student_name}\n".encode())
        proc.stdin.flush()
        proc.stdin.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch capture script: {e}")

    return {
        "message": "Face capture launched on server — follow webcam instructions.",
        "student": student_name,
        "student_id_number": student_id_number,
        "dataset_dir": dataset_dir,
        "pid": proc.pid,
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
    current_user: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """
    Run headless face recognition for `duration` seconds using the webcam,
    then parse attendance.csv and upsert results into the Attendance table
    for the given session.
    """
    if not _model_exists() or not _labels_exists():
        raise HTTPException(
            status_code=400,
            detail="Model not trained. Run POST /ml/train first.",
        )

    # Verify the session exists
    session_result = await db.execute(
        select(Session)
        .options(selectinload(Session.course))
        .where(Session.id == session_id)
    )
    session: Session | None = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    script = _module_path("recognize_headless.py")
    if not os.path.exists(script):
        raise HTTPException(
            status_code=500,
            detail=f"recognize_headless.py not found at {script}",
        )

    csv_path = _module_path("attendance.csv")

    try:
        result = subprocess.run(
            [
                sys.executable, script,
                "--duration", str(duration),
                "--output",   csv_path,
                "--model",    _module_path("trainer.yml"),
                "--labels",   _module_path("labels.npy"),
            ],
            capture_output=True,
            text=True,
            timeout=duration + 60,   # generous timeout
            cwd=settings.ML_MODULE_DIR,
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
            student_id_number = row.get("StudentID", "").strip()
            raw_status        = row.get("Status", "absent").strip().lower()

            if not student_id_number:
                skipped += 1
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
