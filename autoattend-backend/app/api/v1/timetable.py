from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import dependencies
from app.db.database import get_db
from app.models.course import Session, Course
from app.models.user import User, UserRole
from app.schemas.schemas import SessionResponse

router = APIRouter()

from sqlalchemy.orm import joinedload

@router.get("/", response_model=List[SessionResponse])
async def get_timetable(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user)
) -> Any:
    """
    Retrieves the timetable for the current user's role.
    """
    if current_user.role == UserRole.TEACHER:
        # Teacher's timetable: Sessions for courses they teach
        result = await db.execute(
            select(Session).options(joinedload(Session.course)).join(Course).where(Course.teacher_id == current_user.id)
        )
        sessions = result.scalars().all()
        return sessions
    else:
        # Students/Parents: Sessions for courses they are enrolled in via ClassGroup
        from app.models.class_group import ClassGroup, ClassEnrollment
        from app.models.profiles import ParentProfile
        
        target_student_id = current_user.id
        if current_user.role == UserRole.PARENT:
            profile_res = await db.execute(select(ParentProfile).where(ParentProfile.user_id == current_user.id))
            profile = profile_res.scalar_one_or_none()
            if not profile or not profile.student_id:
                return []
            target_student_id = profile.student_id

        result = await db.execute(
            select(Session)
            .options(joinedload(Session.course))
            .join(Course, Session.course_id == Course.id)
            .join(ClassGroup, Course.class_group_id == ClassGroup.id)
            .join(ClassEnrollment, ClassGroup.id == ClassEnrollment.class_group_id)
            .where(ClassEnrollment.student_id == target_student_id)
        )
        sessions = result.scalars().all()
        return sessions
