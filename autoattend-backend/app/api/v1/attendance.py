from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from uuid import UUID

from app.api import dependencies
from app.db.database import get_db
from app.models.course import Attendance, Session, Course
from app.models.user import User
from app.schemas.schemas import AttendanceResponse

router = APIRouter()

@router.get("/my", response_model=List[AttendanceResponse])
async def get_my_attendance(
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student)
) -> Any:
    """
    Student viewing their own attendance logs.
    """
    result = await db.execute(select(Attendance).where(Attendance.student_id == current_student.id).order_by(Attendance.timestamp.desc()))
    attendances = result.scalars().all()
    return attendances

@router.get("/stats")
async def get_my_attendance_stats(
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student)
) -> Any:
    """
    Returns aggregated attendance statistics for the student.
    Matches the mockData: total present/total classes, and subject-wise breakdown.
    """
    # Eager load the session and course to get the subject name
    result = await db.execute(
        select(Attendance)
        .options(joinedload(Attendance.session).joinedload(Session.course))
        .where(Attendance.student_id == current_student.id)
    )
    attendances = result.scalars().all()

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
        percentage = round((stats["attended"] / stats["total"]) * 100) if stats["total"] > 0 else 0
        stats["percentage"] = percentage
        subject_list.append(stats)

    overall_percentage = round((present / total) * 100) if total > 0 else 0

    return {
        "overall": {
            "total": total,
            "present": present,
            "percentage": overall_percentage
        },
        "subjects": subject_list
    }

@router.get("/course/{course_id}", response_model=List[AttendanceResponse])
async def get_course_attendance(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher)
) -> Any:
    """
    Teacher viewing logs for a specific class.
    """
    # Joining Sessions to get all attendances for the course
    result = await db.execute(
        select(Attendance).options(joinedload(Attendance.student)).join(Session).where(Session.course_id == course_id)
    )
    attendances = result.scalars().all()
    return attendances

@router.post("/mark", response_model=AttendanceResponse)
async def mark_attendance_manual(
    session_id: UUID,
    student_id: UUID,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher)
) -> Any:
    """
    Teacher explicitly marking attendance (fallback manual override).
    """
    new_record = Attendance(
        session_id=session_id,
        student_id=student_id,
        status=status,
        marked_by=str(current_teacher.id),
        confidence_score=1.0 # Manual implies 100% confidence
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    return new_record

from fastapi import UploadFile, File
from app.services.attendance import process_attendance_image

@router.post("/scan", response_model=AttendanceResponse)
async def mark_attendance_via_ml_scan(
    session_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    # Might be invoked by a teacher tablet or a student app, depending on the UX
    current_user: User = Depends(dependencies.get_current_active_user) 
) -> Any:
    """
    System marking attendance via ML face recognition scan.
    Receives an image, processing it against the mock ML engine.
    """
    attendance_record = await process_attendance_image(db, session_id, file)
    return attendance_record

@router.get("/student/{student_id}", response_model=List[AttendanceResponse])
async def get_student_attendance(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """
    Get a specific student's attendance records.
    Accessible by Teacher, Admin, or Parent.
    """
    result = await db.execute(select(Attendance).where(Attendance.student_id == student_id).order_by(Attendance.timestamp.desc()))
    attendances = result.scalars().all()
    return attendances

@router.get("/student/{student_id}/stats")
async def get_student_attendance_stats(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """
    Returns aggregated attendance statistics for a specific student.
    Matches the mockData: total present/total classes, and subject-wise breakdown.
    """
    # Eager load the session and course to get the subject name
    result = await db.execute(
        select(Attendance)
        .options(joinedload(Attendance.session).joinedload(Session.course))
        .where(Attendance.student_id == student_id)
    )
    attendances = result.scalars().all()

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
        percentage = round((stats["attended"] / stats["total"]) * 100) if stats["total"] > 0 else 0
        stats["percentage"] = percentage
        subject_list.append(stats)

    overall_percentage = round((present / total) * 100) if total > 0 else 0

    return {
        "overall": {
            "total": total,
            "present": present,
            "percentage": overall_percentage
        },
        "subjects": subject_list
    }

