from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.db.database import get_db
from app.models.class_group import ClassGroup, ClassEnrollment
from app.models.user import User, UserRole
from app.models.profiles import ParentProfile
from app.schemas.class_group import ClassGroupCreate, ClassGroupUpdate, ClassGroupResponse, ClassGroupDetailResponse
from app.api.dependencies import get_current_active_admin, get_current_active_user

router = APIRouter()

from sqlalchemy.orm import joinedload

@router.get("/", response_model=List[ClassGroupDetailResponse])
async def get_all_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve all class groups with their enrollments. Available to all authenticated users."""
    result = await db.execute(select(ClassGroup).options(joinedload(ClassGroup.enrollments)))
    return result.unique().scalars().all()

@router.get("/my", response_model=List[ClassGroupResponse])
async def get_my_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve class groups for the current student or parent's child."""
    target_student_id = current_user.id
    
    if current_user.role == UserRole.PARENT:
        result = await db.execute(select(ParentProfile).where(ParentProfile.user_id == current_user.id))
        profile = result.scalar_one_or_none()
        if not profile or not profile.student_id:
            return []
        target_student_id = profile.student_id
        
    elif current_user.role != UserRole.STUDENT:
        return []

    query = select(ClassGroup).join(ClassEnrollment).where(ClassEnrollment.student_id == target_student_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=ClassGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_class_group(
    *,
    db: AsyncSession = Depends(get_db),
    class_in: ClassGroupCreate,
    current_admin: User = Depends(get_current_active_admin)
):
    """Create a new class group. Only admins can perform this action."""
    db_class = ClassGroup(**class_in.model_dump())
    db.add(db_class)
    await db.commit()
    await db.refresh(db_class)
    return db_class

@router.get("/{class_id}", response_model=ClassGroupDetailResponse)
async def get_class(
    class_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific class group with its enrollments."""
    result = await db.execute(select(ClassGroup).where(ClassGroup.id == class_id))
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
    """Enroll a student into a class group. This cascades their subject access."""
    # Check if class exists
    result = await db.execute(select(ClassGroup).where(ClassGroup.id == class_id))
    db_class = result.scalar_one_or_none()
    if not db_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    
    # Check if student exists
    result = await db.execute(select(User).where(User.id == student_id, User.role == "student"))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # Check if already enrolled
    result = await db.execute(select(ClassEnrollment).where(
        ClassEnrollment.class_group_id == class_id,
        ClassEnrollment.student_id == student_id
    ))
    existing_enrollment = result.scalar_one_or_none()

    if existing_enrollment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is already enrolled in this class")

    enrollment = ClassEnrollment(student_id=student_id, class_group_id=class_id)
    db.add(enrollment)
    await db.commit()

    return {"msg": "Student successfully enrolled in class"}

@router.delete("/{class_id}/enroll/{student_id}", status_code=status.HTTP_200_OK)
async def unenroll_student_from_class(
    class_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """Remove a student from a class group."""
    result = await db.execute(select(ClassEnrollment).where(
        ClassEnrollment.class_group_id == class_id,
        ClassEnrollment.student_id == student_id
    ))
    enrollment = result.scalar_one_or_none()

    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")

    await db.delete(enrollment)
    await db.commit()

    return {"msg": "Student successfully removed from class"}
