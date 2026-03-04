from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.schemas import TokenPayload

reuseable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reuseable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = TokenPayload(**payload)
        if token_data.sub is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
        
    result = await db.execute(select(User).where(User.id == token_data.sub))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_active_teacher(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_current_active_student(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role not in [UserRole.STUDENT, UserRole.ADMIN]:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_current_active_parent(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role not in [UserRole.PARENT, UserRole.ADMIN]:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_current_active_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
