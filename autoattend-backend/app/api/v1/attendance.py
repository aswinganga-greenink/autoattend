from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.api import dependencies
from app.db.database import get_db
from app.models.course import Attendance, Session, Course
from app.models.user import User, UserRole
from app.schemas.schemas import AttendanceResponse, AttendanceCreate

router = APIRouter()


def _attendance_query_with_relations():
    """Returns a select(Attendance) pre-loaded with student and session→course."""
    return select(Attendance).options(
        selectinload(Attendance.student),
        selectinload(Attendance.session).selectinload(Session.course),
    )


@router.get("/my", response_model=List[AttendanceResponse])
async def get_my_attendance(
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student)
) -> Any:
    """Student viewing their own attendance records."""
    result = await db.execute(
        _attendance_query_with_relations()
        .where(Attendance.student_id == current_student.id)
        .order_by(Attendance.timestamp.desc())
    )
    return result.scalars().all()


@router.get("/stats")
async def get_my_attendance_stats(
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student)
) -> Any:
    """Returns aggregated attendance stats for the current student."""
    result = await db.execute(
        _attendance_query_with_relations()
        .where(Attendance.student_id == current_student.id)
    )
    return _compute_stats(result.scalars().all())


@router.get("/course/{course_id}", response_model=List[AttendanceResponse])
async def get_course_attendance(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher)
) -> Any:
    """Teacher viewing attendance logs for a specific course."""
    result = await db.execute(
        _attendance_query_with_relations()
        .join(Session)
        .where(Session.course_id == course_id)
        .order_by(Attendance.timestamp.desc())
    )
    return result.scalars().all()


@router.get("/session/{session_id}", response_model=List[AttendanceResponse])
async def get_session_attendance(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """Get all attendance records for a specific session. Teachers & admins only."""
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Verify session exists
    session = (await db.execute(select(Session).where(Session.id == session_id))).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        _attendance_query_with_relations().where(Attendance.session_id == session_id)
    )
    return result.scalars().all()


@router.post("/mark", response_model=AttendanceResponse)
async def mark_attendance_manual(
    attendance_in: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher)
) -> Any:
    """Teacher manually marking attendance (override)."""
    # Verify session exists
    session = (await db.execute(
        select(Session).where(Session.id == attendance_in.session_id)
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify student exists
    student = (await db.execute(
        select(User).where(User.id == attendance_in.student_id, User.role == UserRole.STUDENT)
    )).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Upsert: update existing record if one exists for this session+student
    existing = (await db.execute(
        select(Attendance).where(
            Attendance.session_id == attendance_in.session_id,
            Attendance.student_id == attendance_in.student_id
        )
    )).scalar_one_or_none()

    if existing:
        existing.status = attendance_in.status
        existing.marked_by = str(current_teacher.id)
        existing.confidence_score = 1.0
        db.add(existing)
        record = existing
    else:
        record = Attendance(
            session_id=attendance_in.session_id,
            student_id=attendance_in.student_id,
            status=attendance_in.status,
            marked_by=str(current_teacher.id),
            confidence_score=1.0,
        )
        db.add(record)

    await db.commit()
    # Reload with relations
    result = await db.execute(
        _attendance_query_with_relations().where(Attendance.id == record.id)
    )
    return result.scalar_one()


@router.get("/student/{student_id}", response_model=List[AttendanceResponse])
async def get_student_attendance(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """
    Get a specific student's attendance records.
    Accessible by Teacher, Admin, or Parent of that student.
    """
    from app.models.profiles import ParentProfile
    if current_user.role == UserRole.PARENT:
        profile = (await db.execute(
            select(ParentProfile).where(ParentProfile.user_id == current_user.id)
        )).scalar_one_or_none()
        if not profile or str(profile.student_id) != str(student_id):
            raise HTTPException(status_code=403, detail="Not your child's records")
    elif current_user.role == UserRole.STUDENT and str(current_user.id) != str(student_id):
        raise HTTPException(status_code=403, detail="Cannot view another student's records")

    result = await db.execute(
        _attendance_query_with_relations()
        .where(Attendance.student_id == student_id)
        .order_by(Attendance.timestamp.desc())
    )
    return result.scalars().all()


@router.get("/student/{student_id}/stats")
async def get_student_attendance_stats(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """Returns aggregated attendance stats for a specific student."""
    from app.models.profiles import ParentProfile
    if current_user.role == UserRole.PARENT:
        profile = (await db.execute(
            select(ParentProfile).where(ParentProfile.user_id == current_user.id)
        )).scalar_one_or_none()
        if not profile or str(profile.student_id) != str(student_id):
            raise HTTPException(status_code=403, detail="Not your child's records")
    elif current_user.role == UserRole.STUDENT and str(current_user.id) != str(student_id):
        raise HTTPException(status_code=403, detail="Cannot view another student's records")

    result = await db.execute(
        _attendance_query_with_relations().where(Attendance.student_id == student_id)
    )
    return _compute_stats(result.scalars().all())


from fastapi import UploadFile, File
from app.services.attendance import process_attendance_image

@router.post("/scan", response_model=AttendanceResponse)
async def mark_attendance_via_ml_scan(
    session_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """System marking attendance via ML face recognition scan."""
    attendance_record = await process_attendance_image(db, session_id, file)
    return attendance_record


# --- Shared helper ---

def _compute_stats(attendances: list) -> dict:
    """Compute overall and per-subject attendance statistics."""
    total = len(attendances)
    present = sum(1 for a in attendances if a.status.name == "PRESENT")

    subject_stats: Dict[UUID, dict] = {}
    for a in attendances:
        session = a.session
        if not session or not session.course:
            continue
        course = session.course
        if course.id not in subject_stats:
            subject_stats[course.id] = {"subject": course.name, "total": 0, "attended": 0}
        subject_stats[course.id]["total"] += 1
        if a.status.name == "PRESENT":
            subject_stats[course.id]["attended"] += 1

    subject_list = []
    for c_id, stats in subject_stats.items():
        stats["percentage"] = round((stats["attended"] / stats["total"]) * 100) if stats["total"] > 0 else 0
        subject_list.append(stats)

    return {
        "overall": {
            "total": total,
            "present": present,
            "percentage": round((present / total) * 100) if total > 0 else 0,
        },
        "subjects": subject_list,
    }
