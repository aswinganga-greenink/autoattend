from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.api import dependencies
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.profiles import StudentProfile, TeacherProfile, ParentProfile
from app.schemas.schemas import StudentProfileResponse
from pydantic import BaseModel

router = APIRouter()

class StudentProfileCreate(BaseModel):
    user_id: UUID
    student_id_number: str

@router.post("/student", response_model=StudentProfileResponse)
async def create_student_profile(
    *,
    db: AsyncSession = Depends(get_db),
    profile_in: StudentProfileCreate,
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Create a student profile for a user.
    """
    # Verify user exists and is a student
    result = await db.execute(select(User).where(User.id == profile_in.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="User is not a student")

    # Check if profile already exists
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == profile_in.user_id))
    existing_profile = result.scalar_one_or_none()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Student profile already exists for this user")

    db_profile = StudentProfile(
        user_id=profile_in.user_id,
        student_id_number=profile_in.student_id_number,
    )
    db.add(db_profile)
    await db.commit()
    await db.refresh(db_profile)
    return db_profile

@router.get("/student/{user_id}", response_model=StudentProfileResponse)
async def get_student_profile(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Get a student profile by user ID.
    """
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile

from fastapi import UploadFile, File
from app.ml.mock_engine import mock_engine

@router.post("/student/{user_id}/face", response_model=StudentProfileResponse)
async def upload_student_face(
    user_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(dependencies.get_current_active_user),
) -> Any:
    """
    Upload a face image to generate and store the mock embedding vector.
    """
    # Verify profile exists
    result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    try:
        image_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Generate dummy embedding
    embedding = await mock_engine.generate_embedding(image_bytes)

    # Save to DB
    profile.face_encoding = embedding
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    
    return profile
