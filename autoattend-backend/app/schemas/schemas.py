from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole
from app.models.course import AttendanceStatus

# --- Tokens ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

# --- User Base & Auth ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.STUDENT

class UserCreate(UserBase):
    password: str
    parent_of_student_id: Optional[UUID] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)

# --- Profiles ---
class StudentProfileResponse(BaseModel):
    user_id: UUID
    student_id_number: str
    
    model_config = ConfigDict(from_attributes=True)

# --- Course & Session ---
class CourseResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    teacher_id: Optional[UUID] = None
    class_group_id: Optional[UUID] = None
    schedule_info: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class SessionResponse(BaseModel):
    id: UUID
    course_id: UUID
    start_time: datetime
    end_time: datetime
    room: Optional[str]
    course: Optional[CourseResponse] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Attendance ---
class AttendanceCreate(BaseModel):
    session_id: UUID
    student_id: UUID
    status: AttendanceStatus
    confidence_score: Optional[float] = None
    marked_by: str = "system"

class AttendanceResponse(BaseModel):
    id: UUID
    session_id: UUID
    student_id: UUID
    status: AttendanceStatus
    timestamp: datetime
    confidence_score: Optional[float]
    marked_by: str
    student: Optional[UserResponse] = None
    
    model_config = ConfigDict(from_attributes=True)
