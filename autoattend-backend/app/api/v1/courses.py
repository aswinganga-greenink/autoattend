from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.api import dependencies
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.course import Course, Session, Attendance
from app.models.class_group import ClassEnrollment
from app.models.enrollment import Enrollment
from app.schemas.schemas import (
    CourseCreate, CourseUpdate, CourseResponse, CourseDetailResponse,
    SessionCreate, SessionUpdate, SessionResponse, UserResponse
)

router = APIRouter()


def _course_query_with_relations():
    """Returns a select(Course) statement pre-loaded with teacher and sessions."""
    return select(Course).options(
        selectinload(Course.teacher),
        selectinload(Course.sessions),
    )


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    *,
    db: AsyncSession = Depends(get_db),
    course_in: CourseCreate,
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """Create a new course. Teachers only."""
    teacher_id = course_in.teacher_id
    if not teacher_id:
        if current_teacher.role == UserRole.TEACHER:
            teacher_id = current_teacher.id
        else:
            raise HTTPException(status_code=400, detail="Teacher ID is required when created by admin")

    db_course = Course(
        name=course_in.name,
        description=course_in.description,
        teacher_id=teacher_id,
        class_group_id=course_in.class_group_id,
        schedule_info=course_in.schedule_info,
    )
    db.add(db_course)
    await db.commit()
    # Reload with relations
    result = await db.execute(
        _course_query_with_relations().where(Course.id == db_course.id)
    )
    return result.scalar_one()


@router.get("/teacher/my-courses", response_model=List[CourseResponse])
async def get_my_courses_teacher(
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """Get all courses taught by the current teacher."""
    result = await db.execute(
        _course_query_with_relations().where(Course.teacher_id == current_teacher.id)
    )
    return result.scalars().all()


@router.get("/my/enrollments", response_model=List[CourseResponse])
async def get_my_enrollments(
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student),
) -> Any:
    """Get all courses the current student is enrolled in (directly or via Class Group)."""
    direct_result = await db.execute(
        _course_query_with_relations()
        .join(Enrollment)
        .where(Enrollment.student_id == current_student.id)
    )
    direct_courses = {c.id: c for c in direct_result.scalars().all()}

    inherited_result = await db.execute(
        _course_query_with_relations()
        .join(ClassEnrollment, Course.class_group_id == ClassEnrollment.class_group_id)
        .where(ClassEnrollment.student_id == current_student.id)
    )
    for c in inherited_result.scalars().all():
        direct_courses[c.id] = c

    return list(direct_courses.values())


@router.get("/admin/{course_id}/enroll/{student_id}", response_model=dict)
async def admin_enroll_student(
    course_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Admin: Enroll a specific student directly in a course."""
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    student = (await db.execute(
        select(User).where(User.id == student_id, User.role == UserRole.STUDENT)
    )).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = (await db.execute(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.student_id == student_id
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled")

    db.add(Enrollment(course_id=course_id, student_id=student_id))
    await db.commit()
    return {"message": "Student successfully enrolled"}


@router.delete("/admin/{course_id}/enroll/{student_id}", response_model=dict)
async def admin_unenroll_student(
    course_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Admin: Remove a specific student from a course."""
    existing = (await db.execute(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.student_id == student_id
        )
    )).scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    await db.delete(existing)
    await db.commit()
    return {"message": "Student successfully removed from course"}


@router.get("/", response_model=List[CourseResponse])
async def get_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Retrieve all courses."""
    result = await db.execute(_course_query_with_relations())
    return result.scalars().all()


@router.get("/{course_id}/sessions", response_model=List[SessionResponse])
async def get_course_sessions(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """List all sessions for a specific course."""
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(
        select(Session)
        .options(selectinload(Session.course).selectinload(Course.teacher))
        .where(Session.course_id == course_id)
        .order_by(Session.start_time)
    )
    return result.scalars().all()


@router.get("/{course_id}/students", response_model=List[UserResponse])
async def get_course_students(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Get all students enrolled in a specific course (via class or direct enrollment)."""
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    via_class = (await db.execute(
        select(User)
        .join(ClassEnrollment, User.id == ClassEnrollment.student_id)
        .join(Course, Course.class_group_id == ClassEnrollment.class_group_id)
        .where(Course.id == course_id)
    )).scalars().all()

    direct = (await db.execute(
        select(User)
        .join(Enrollment, User.id == Enrollment.student_id)
        .where(Enrollment.course_id == course_id)
    )).scalars().all()

    merged = {u.id: u for u in via_class}
    for u in direct:
        merged[u.id] = u
    return list(merged.values())


@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Get a specific course with full details: teacher, sessions, student count."""
    result = await db.execute(
        _course_query_with_relations().where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Count enrolled students (via class + direct)
    via_class_count = (await db.execute(
        select(func.count()).select_from(ClassEnrollment)
        .join(Course, Course.class_group_id == ClassEnrollment.class_group_id)
        .where(Course.id == course_id)
    )).scalar_one()

    direct_count = (await db.execute(
        select(func.count()).select_from(Enrollment).where(Enrollment.course_id == course_id)
    )).scalar_one()

    # Attach student_count dynamically before returning
    course.__dict__["student_count"] = via_class_count + direct_count
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: UUID,
    course_in: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Update a course. Admins can update any; teachers can only update their own."""
    result = await db.execute(
        _course_query_with_relations().where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role == UserRole.TEACHER and course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")

    update_data = course_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)

    db.add(course)
    await db.commit()
    await db.refresh(course)
    result = await db.execute(_course_query_with_relations().where(Course.id == course_id))
    return result.scalar_one()


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> None:
    """Delete a course. Admin only. Cascades sessions and attendance."""
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await db.delete(course)
    await db.commit()


# --- Session endpoints ---

@router.post("/sessions/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_in: SessionCreate,
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """Create a new session for a course."""
    course = (await db.execute(select(Course).where(Course.id == session_in.course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_teacher.role == UserRole.TEACHER and course.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="Not your course")

    db_session = Session(
        course_id=session_in.course_id,
        start_time=session_in.start_time,
        end_time=session_in.end_time,
        room=session_in.room,
    )
    db.add(db_session)
    await db.commit()
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.course).selectinload(Course.teacher))
        .where(Session.id == db_session.id)
    )
    return result.scalar_one()


@router.put("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    session_in: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Update a session's time or room. Teachers (own course) or admins."""
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.course))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == UserRole.TEACHER and session.course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")

    update_data = session_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    db.add(session)
    await db.commit()
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.course).selectinload(Course.teacher))
        .where(Session.id == session_id)
    )
    return result.scalar_one()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> None:
    """Delete a session. Cascades attendance records. Teachers (own course) or admins."""
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.course))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == UserRole.TEACHER and session.course.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your course")

    await db.delete(session)
    await db.commit()


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session_legacy(
    *,
    db: AsyncSession = Depends(get_db),
    session_in: SessionCreate,
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """Create a new session (legacy alias for /sessions/create)."""
    return await create_session(db=db, session_in=session_in, current_teacher=current_teacher)
