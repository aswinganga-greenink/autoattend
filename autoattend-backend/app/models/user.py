import enum
import uuid
from sqlalchemy import Column, String, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    is_active = Column(Boolean(), default=True)
