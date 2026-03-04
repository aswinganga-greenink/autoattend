from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.schemas import UserResponse

class ClassGroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class ClassGroupCreate(ClassGroupBase):
    pass

class ClassGroupUpdate(ClassGroupBase):
    name: Optional[str] = None
    description: Optional[str] = None

class ClassGroupResponse(ClassGroupBase):
    id: UUID

    class Config:
        from_attributes = True

class ClassEnrollmentResponse(BaseModel):
    id: UUID
    student_id: UUID
    class_group_id: UUID
    enrolled_at: datetime
    student: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ClassGroupDetailResponse(ClassGroupResponse):
    enrollments: List[ClassEnrollmentResponse] = []
