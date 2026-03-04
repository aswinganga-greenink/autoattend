from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import dependencies
from app.core.security import get_password_hash
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.course import Course, Session, Attendance
from app.models.profiles import ParentProfile
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate
from typing import List

router = APIRouter()

@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """
    Retrieve users. Admin only.
    """
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return users

@router.get("/admin/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(dependencies.get_current_active_admin),
) -> Any:
    """
    Retrieve basic overall system stats for Admin dashboard.
    """
    # Count total users
    result_users = await db.execute(select(User))
    users = result_users.scalars().all()
    total_users = len(users)

    # Count total courses
    result_courses = await db.execute(select(Course))
    courses = result_courses.scalars().all()
    total_courses = len(courses)

    # Count total sessions
    result_sessions = await db.execute(select(Session))
    sessions = result_sessions.scalars().all()
    total_sessions = len(sessions)

    return {
        "total_users": total_users,
        "total_courses": total_courses,
        "total_sessions": total_sessions,
        "system_status": "Active"
    }

@router.post("/", response_model=UserResponse)
async def create_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user. (In a real app, this should probably be protected by admin)
    """
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        role=user_in.role,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    if user_in.role == UserRole.PARENT and user_in.parent_of_student_id:
        parent_profile = ParentProfile(
            user_id=db_user.id,
            student_id=user_in.parent_of_student_id
        )
        db.add(parent_profile)
        await db.commit()

    return db_user

@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_current_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Update current user.
    """
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
    """
    Get the parent's actual linked child from the profiles table.
    """
    profile_result = await db.execute(select(ParentProfile).where(ParentProfile.user_id == current_parent.id))
    profile = profile_result.scalar_one_or_none()

    if not profile or not profile.student_id:
        raise HTTPException(status_code=404, detail="No child linked to this parent profile.")

    child_result = await db.execute(select(User).where(User.id == profile.student_id))
    child = child_result.scalar_one_or_none()

    if not child:
        raise HTTPException(status_code=404, detail="The linked child account no longer exists.")
        
    return child
