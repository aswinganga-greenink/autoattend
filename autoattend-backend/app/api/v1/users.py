from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api import dependencies
from app.core.security import get_password_hash
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.course import Course, Session
from app.models.profiles import StudentProfile, TeacherProfile, ParentProfile
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate, AdminUserUpdate
from uuid import UUID
import uuid

router = APIRouter()


@router.get("/admin/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Retrieve basic overall system stats for Admin dashboard using COUNT queries."""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_students = (await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.STUDENT)
    )).scalar_one()
    total_teachers = (await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.TEACHER)
    )).scalar_one()
    total_courses = (await db.execute(select(func.count()).select_from(Course))).scalar_one()
    total_sessions = (await db.execute(select(func.count()).select_from(Session))).scalar_one()

    return {
        "total_users": total_users,
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_courses": total_courses,
        "total_sessions": total_sessions,
        "system_status": "Active",
    }


@router.get("/students", response_model=List[UserResponse])
async def get_all_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """List all student users (accessible to teachers and admins)."""
    rows = (
        await db.execute(
            select(User, StudentProfile.student_id_number)
            .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
            .where(User.role == UserRole.STUDENT)
        )
    ).all()
    return [
        {
            "id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role, "is_active": u.is_active,
            "student_id_number": sid,
        }
        for u, sid in rows
    ]


@router.get("/teachers", response_model=List[UserResponse])
async def get_all_teachers(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """List all teacher users. Admin only."""
    result = await db.execute(select(User).where(User.role == UserRole.TEACHER))
    return result.scalars().all()


@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Retrieve all users with student profiles populated. Admin only."""
    rows = (
        await db.execute(
            select(User, StudentProfile.student_id_number)
            .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
            .offset(skip).limit(limit)
        )
    ).all()
    return [
        {
            "id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role, "is_active": u.is_active,
            "student_id_number": sid if u.role == UserRole.STUDENT else None,
        }
        for u, sid in rows
    ]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user. Auto-creates StudentProfile or TeacherProfile as appropriate.
    """
    existing = (await db.execute(select(User).where(User.email == user_in.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        role=user_in.role,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(db_user)
    await db.flush()  # Get db_user.id without committing

    # Auto-create role-specific profile
    if user_in.role == UserRole.STUDENT:
        # Generate a student ID number if not provided
        id_number = user_in.student_id_number or f"STU-{str(db_user.id)[:8].upper()}"
        db.add(StudentProfile(user_id=db_user.id, student_id_number=id_number))

    elif user_in.role == UserRole.TEACHER:
        db.add(TeacherProfile(user_id=db_user.id))

    elif user_in.role == UserRole.PARENT and user_in.parent_of_student_id:
        # Verify the student actually exists
        student = (await db.execute(
            select(User).where(
                User.id == user_in.parent_of_student_id,
                User.role == UserRole.STUDENT
            )
        )).scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=404, detail="Linked student account not found")
        db.add(ParentProfile(user_id=db_user.id, student_id=user_in.parent_of_student_id))

    await db.commit()
    await db.refresh(db_user)
    return db_user


@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Get current logged-in user."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """Update own profile (email, name, password)."""
    if user_in.password is not None:
        current_user.hashed_password = get_password_hash(user_in.password)
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    if user_in.email is not None:
        current_user.email = user_in.email

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/me/child", response_model=UserResponse)
async def get_my_child(
    db: AsyncSession = Depends(get_db),
    current_parent: User = Depends(dependencies.get_current_active_parent),
) -> Any:
    """Get the parent's linked child."""
    profile = (await db.execute(
        select(ParentProfile).where(ParentProfile.user_id == current_parent.id)
    )).scalar_one_or_none()

    if not profile or not profile.student_id:
        raise HTTPException(status_code=404, detail="No child linked to this parent profile.")

    child = (await db.execute(select(User).where(User.id == profile.student_id))).scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail="The linked child account no longer exists.")
    return child


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Get a specific user by ID. Admin only."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: UUID,
    user_in: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Admin: update any user's details including role and active status."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """Admin: deactivate a user (soft delete — sets is_active=False)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user.is_active = False
    db.add(user)
    await db.commit()
    return {"message": f"User {user.email} has been deactivated"}
