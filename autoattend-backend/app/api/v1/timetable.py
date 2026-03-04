from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.api import dependencies
from app.db.database import get_db
from app.models.course import Session, Course
from app.models.user import User, UserRole
from app.schemas.schemas import SessionResponse

router = APIRouter()


def _session_query_with_course():
    """Returns select(Session) with course and teacher eagerly loaded."""
    return select(Session).options(
        selectinload(Session.course).selectinload(Course.teacher)
    )


@router.get("/", response_model=List[SessionResponse])
async def get_timetable(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """
    Retrieve the timetable for the current user's role.
    - ADMIN: all sessions in the system
    - TEACHER: sessions for courses they teach
    - STUDENT/PARENT: sessions for their enrolled class's courses
    """
    if current_user.role == UserRole.ADMIN:
        result = await db.execute(
            _session_query_with_course().order_by(Session.start_time)
        )
        return result.scalars().all()

    if current_user.role == UserRole.TEACHER:
        result = await db.execute(
            _session_query_with_course()
            .join(Course)
            .where(Course.teacher_id == current_user.id)
            .order_by(Session.start_time)
        )
        return result.scalars().all()

    # Student or Parent — resolve target student ID
    from app.models.class_group import ClassGroup, ClassEnrollment
    from app.models.profiles import ParentProfile

    target_student_id = current_user.id
    if current_user.role == UserRole.PARENT:
        profile = (await db.execute(
            select(ParentProfile).where(ParentProfile.user_id == current_user.id)
        )).scalar_one_or_none()
        if not profile or not profile.student_id:
            return []
        target_student_id = profile.student_id

    result = await db.execute(
        _session_query_with_course()
        .join(Course, Session.course_id == Course.id)
        .join(ClassGroup, Course.class_group_id == ClassGroup.id)
        .join(ClassEnrollment, ClassGroup.id == ClassEnrollment.class_group_id)
        .where(ClassEnrollment.student_id == target_student_id)
        .order_by(Session.start_time)
    )
    return result.scalars().all()


@router.get("/class/{class_id}", response_model=List[SessionResponse])
async def get_class_timetable(
    class_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """Get the full timetable for an entire class group. Admins and teachers only."""
    if current_user.role not in [UserRole.ADMIN, UserRole.TEACHER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    from app.models.class_group import ClassGroup
    result = await db.execute(
        _session_query_with_course()
        .join(Course, Session.course_id == Course.id)
        .where(Course.class_group_id == class_id)
        .order_by(Session.start_time)
    )
    return result.scalars().all()


@router.get("/teacher/{teacher_id}", response_model=List[SessionResponse])
async def get_teacher_timetable(
    teacher_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin)
) -> Any:
    """Admin: view any teacher's full session schedule."""
    result = await db.execute(
        _session_query_with_course()
        .join(Course)
        .where(Course.teacher_id == teacher_id)
        .order_by(Session.start_time)
    )
    return result.scalars().all()
