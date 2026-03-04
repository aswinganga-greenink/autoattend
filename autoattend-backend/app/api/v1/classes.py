from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models.class_group import ClassGroup, ClassEnrollment
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User, UserRole
from app.schemas.class_group import (
    ClassGroupCreate, ClassGroupUpdate, ClassGroupResponse, ClassGroupDetailResponse
)
from app.api.dependencies import get_current_active_admin, get_current_active_user

router = APIRouter()


def _class_detail_query():
    """Select ClassGroup with enrollments→student and courses→teacher eagerly loaded."""
    return select(ClassGroup).options(
        selectinload(ClassGroup.enrollments).selectinload(ClassEnrollment.student),
        selectinload(ClassGroup.courses).selectinload(Course.teacher),
    )


@router.get("/", response_model=List[ClassGroupDetailResponse])
async def get_all_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve all class groups with their enrollments and courses."""
    result = await db.execute(_class_detail_query())
    return result.unique().scalars().all()


@router.get("/my", response_model=List[ClassGroupResponse])
async def get_my_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve class groups for the current student or parent's child."""
    from app.models.profiles import ParentProfile

    target_student_id = current_user.id

    if current_user.role == UserRole.PARENT:
        result = await db.execute(select(ParentProfile).where(ParentProfile.user_id == current_user.id))
        profile = result.scalar_one_or_none()
        if not profile or not profile.student_id:
            return []
        target_student_id = profile.student_id
    elif current_user.role not in [UserRole.STUDENT]:
        return []

    query = (
        select(ClassGroup)
        .join(ClassEnrollment)
        .where(ClassEnrollment.student_id == target_student_id)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ClassGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_class_group(
    *,
    db: AsyncSession = Depends(get_db),
    class_in: ClassGroupCreate,
    current_admin: User = Depends(get_current_active_admin)
):
    """Create a new class group. Admin only."""
    db_class = ClassGroup(**class_in.model_dump())
    db.add(db_class)
    await db.commit()
    await db.refresh(db_class)
    return db_class


@router.put("/{class_id}", response_model=ClassGroupResponse)
async def update_class_group(
    class_id: UUID,
    class_in: ClassGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """Update a class group's name or description. Admin only."""
    result = await db.execute(select(ClassGroup).where(ClassGroup.id == class_id))
    db_class = result.scalar_one_or_none()
    if not db_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class group not found")

    update_data = class_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_class, field, value)

    db.add(db_class)
    await db.commit()
    await db.refresh(db_class)
    return db_class


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class_group(
    class_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """Delete a class group. Admin only. Cascades course links and enrollments."""
    result = await db.execute(select(ClassGroup).where(ClassGroup.id == class_id))
    db_class = result.scalar_one_or_none()
    if not db_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class group not found")
    await db.delete(db_class)
    await db.commit()


@router.get("/{class_id}", response_model=ClassGroupDetailResponse)
async def get_class(
    class_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific class group with enrollments and courses."""
    result = await db.execute(_class_detail_query().where(ClassGroup.id == class_id))
    db_class = result.scalar_one_or_none()
    if not db_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class group not found")
    return db_class


@router.post("/{class_id}/enroll/{student_id}", status_code=status.HTTP_201_CREATED)
async def enroll_student_in_class(
    class_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Enroll a student into a class group. Admin only.
    Also propagates enrollment to every course currently in the class.
    """
    # Verify class exists (with courses)
    result = await db.execute(
        select(ClassGroup)
        .options(selectinload(ClassGroup.courses))
        .where(ClassGroup.id == class_id)
    )
    db_class = result.scalar_one_or_none()
    if not db_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    # Verify student exists
    student = (await db.execute(
        select(User).where(User.id == student_id, User.role == UserRole.STUDENT)
    )).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Check if already enrolled in class
    existing = (await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.class_group_id == class_id,
            ClassEnrollment.student_id == student_id
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is already enrolled in this class")

    # Add class enrollment
    db.add(ClassEnrollment(student_id=student_id, class_group_id=class_id))

    # Propagate to course-level enrollments for every course in this class
    for course in db_class.courses:
        existing_course_enrollment = (await db.execute(
            select(Enrollment).where(
                Enrollment.course_id == course.id,
                Enrollment.student_id == student_id
            )
        )).scalar_one_or_none()
        if not existing_course_enrollment:
            db.add(Enrollment(course_id=course.id, student_id=student_id))

    await db.commit()
    return {"msg": f"Student enrolled in class and {len(db_class.courses)} course(s)"}


@router.delete("/{class_id}/enroll/{student_id}", status_code=status.HTTP_200_OK)
async def unenroll_student_from_class(
    class_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Remove a student from a class group. Admin only.
    Also removes their enrollment from every course in the class.
    """
    # Verify class with its courses
    result = await db.execute(
        select(ClassGroup)
        .options(selectinload(ClassGroup.courses))
        .where(ClassGroup.id == class_id)
    )
    db_class = result.scalar_one_or_none()
    if not db_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    # Find and remove class enrollment
    enrollment = (await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.class_group_id == class_id,
            ClassEnrollment.student_id == student_id
        )
    )).scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")

    await db.delete(enrollment)

    # Remove course-level enrollments for this class's courses
    removed = 0
    for course in db_class.courses:
        course_enrollment = (await db.execute(
            select(Enrollment).where(
                Enrollment.course_id == course.id,
                Enrollment.student_id == student_id
            )
        )).scalar_one_or_none()
        if course_enrollment:
            await db.delete(course_enrollment)
            removed += 1

    await db.commit()
    return {"msg": f"Student removed from class and {removed} course enrollment(s)"}
