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
    student_id_number: Optional[str] = None  # auto-generated if not provided

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None

class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    student_id_number: Optional[str] = None   # only populated for students

    model_config = ConfigDict(from_attributes=True)

# --- Profiles ---
class StudentProfileResponse(BaseModel):
    user_id: UUID
    student_id_number: str

    model_config = ConfigDict(from_attributes=True)

class TeacherProfileResponse(BaseModel):
    user_id: UUID
    department: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Course & Session ---
class CourseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    class_group_id: Optional[UUID] = None
    schedule_info: Optional[str] = None

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    class_group_id: Optional[UUID] = None
    schedule_info: Optional[str] = None
    teacher_id: Optional[UUID] = None

class CourseResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    teacher_id: Optional[UUID] = None
    class_group_id: Optional[UUID] = None
    schedule_info: Optional[str] = None
    teacher: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

class SessionCreate(BaseModel):
    course_id: UUID
    start_time: datetime
    end_time: datetime
    room: Optional[str] = None

class SessionUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    room: Optional[str] = None

class SessionResponse(BaseModel):
    id: UUID
    course_id: UUID
    start_time: datetime
    end_time: datetime
    room: Optional[str] = None
    course: Optional[CourseResponse] = None

    model_config = ConfigDict(from_attributes=True)

class CourseDetailResponse(CourseResponse):
    sessions: List[SessionResponse] = []
    student_count: int = 0

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
    confidence_score: Optional[float] = None
    marked_by: str
    student: Optional[UserResponse] = None
    session: Optional[SessionResponse] = None

    model_config = ConfigDict(from_attributes=True)
