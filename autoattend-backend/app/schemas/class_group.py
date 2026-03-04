from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.schemas import UserResponse, CourseResponse

class ClassGroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class ClassGroupCreate(ClassGroupBase):
    pass

class ClassGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ClassGroupResponse(ClassGroupBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)

class ClassEnrollmentResponse(BaseModel):
    id: UUID
    student_id: UUID
    class_group_id: UUID
    enrolled_at: datetime
    student: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

class ClassGroupDetailResponse(ClassGroupResponse):
    enrollments: List[ClassEnrollmentResponse] = []
    courses: List[CourseResponse] = []
