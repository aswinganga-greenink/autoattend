from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.api import dependencies
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.course import Course, Session
from app.schemas.schemas import CourseResponse, SessionResponse, UserResponse

router = APIRouter()

class CourseCreate(BaseModel):
    name: str
    description: str | None = None
    class_group_id: UUID | None = None
    schedule_info: str | None = None

class SessionCreate(BaseModel):
    course_id: UUID
    start_time: datetime
    end_time: datetime
    room: str | None = None

@router.post("/", response_model=CourseResponse)
async def create_course(
    *,
    db: AsyncSession = Depends(get_db),
    course_in: CourseCreate,
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """
    Create new course.
    """
    db_course = Course(
        name=course_in.name,
        description=course_in.description,
        teacher_id=current_teacher.id,
        class_group_id=course_in.class_group_id,
        schedule_info=course_in.schedule_info
    )
    db.add(db_course)
    await db.flush()

    # Automatically create a generic session for this course, as the frontend Timetable requires Session objects
    from datetime import datetime, timedelta
    db_session = Session(
        course_id=db_course.id,
        start_time=datetime.now().replace(hour=9, minute=0, second=0, microsecond=0),
        end_time=datetime.now().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1),
        room="TBA"
    )
    db.add(db_session)

    await db.commit()
    await db.refresh(db_course)
    return db_course

@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_in: SessionCreate,
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """
    Create a new session for a course.
    """
    # Verify course exists
    result = await db.execute(select(Course).where(Course.id == session_in.course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    db_session = Session(
        course_id=session_in.course_id,
        start_time=session_in.start_time,
        end_time=session_in.end_time,
        room=session_in.room,
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return db_session

@router.get("/", response_model=List[CourseResponse])
async def get_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Retrieve all courses.
    """
    result = await db.execute(select(Course))
    courses = result.scalars().all()
    return courses

@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Get a specific course by ID.
    """
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    return course

from app.models.class_group import ClassEnrollment
from app.models.enrollment import Enrollment

@router.post("/{course_id}/enroll", response_model=CourseResponse)
async def enroll_in_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student),
) -> Any:
    """
    Enroll the current student in a course.
    """
    # Check if course exists
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if already enrolled
    enrollment_result = await db.execute(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.student_id == current_student.id
        )
    )
    existing_enrollment = enrollment_result.scalar_one_or_none()
    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    # Create enrollment
    new_enrollment = Enrollment(
        course_id=course_id,
        student_id=current_student.id
    )
    db.add(new_enrollment)
    await db.commit()
    
    return course

@router.get("/my/enrollments", response_model=List[CourseResponse])
async def get_my_enrollments(
    db: AsyncSession = Depends(get_db),
    current_student: User = Depends(dependencies.get_current_active_student),
) -> Any:
    """
    Get all courses the current student is enrolled in (directly or via a ClassGroup).
    """
    # Get courses directly enrolled
    direct_courses_result = await db.execute(
        select(Course).join(Enrollment).where(Enrollment.student_id == current_student.id)
    )
    direct_courses = direct_courses_result.scalars().all()

    # Get courses via inherited class group enrollment
    inherited_courses_result = await db.execute(
        select(Course).join(ClassEnrollment, Course.class_group_id == ClassEnrollment.class_group_id)
        .where(ClassEnrollment.student_id == current_student.id)
    )
    inherited_courses = inherited_courses_result.scalars().all()

    # Merge and dedup by course ID
    combined_courses = {c.id: c for c in direct_courses}
    for c in inherited_courses:
        combined_courses[c.id] = c

    return list(combined_courses.values())

@router.get("/teacher/my-courses", response_model=List[CourseResponse])
async def get_my_courses_teacher(
    db: AsyncSession = Depends(get_db),
    current_teacher: User = Depends(dependencies.get_current_active_teacher),
) -> Any:
    """
    Get all courses taught by the current teacher.
    """
    result = await db.execute(
        select(Course).where(Course.teacher_id == current_teacher.id)
    )
    courses = result.scalars().all()
    return courses

@router.get("/{course_id}/students", response_model=List[UserResponse])
async def get_course_students(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Get all students enrolled in a specific course.
    """
    # Allow teachers and admins (and perhaps anyone authenticated) to see who is in a course.
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    result = await db.execute(
        select(User)
        .join(ClassEnrollment, User.id == ClassEnrollment.student_id)
        .join(Course, Course.class_group_id == ClassEnrollment.class_group_id)
        .where(Course.id == course_id)
    )
    students = result.scalars().all()
    return students

@router.post("/admin/{course_id}/enroll/{student_id}", response_model=dict)
async def admin_enroll_student(
    course_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """
    Admin: Enroll a specific student in a course.
    """
    # Check if course exists
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if student exists
    student = (await db.execute(select(User).where(User.id == student_id, User.role == UserRole.STUDENT))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check if already enrolled
    existing = (await db.execute(select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == student_id))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled")

    new_enrollment = Enrollment(course_id=course_id, student_id=student_id)
    db.add(new_enrollment)
    await db.commit()
    
    return {"message": "Student successfully enrolled"}

@router.delete("/admin/{course_id}/enroll/{student_id}", response_model=dict)
async def admin_unenroll_student(
    course_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """
    Admin: Remove a specific student from a course.
    """
    existing = (await db.execute(select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == student_id))).scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    await db.delete(existing)
    await db.commit()
    
    return {"message": "Student successfully removed from course"}
