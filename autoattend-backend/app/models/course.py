import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import enum
from datetime import datetime

class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    EXCUSED = "excused"
    LATE = "late"

class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    teacher = relationship("User", foreign_keys=[teacher_id])
    class_group_id = Column(UUID(as_uuid=True), ForeignKey("class_groups.id", ondelete="CASCADE"), nullable=True)
    schedule_info = Column(String(255), nullable=True) # e.g., "Mon, Wed 10:00 AM - 11:30 AM"

    class_group = relationship("ClassGroup", back_populates="courses")
    sessions = relationship("Session", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    room = Column(String(100), nullable=True)

    course = relationship("Course", back_populates="sessions")
    attendance_records = relationship("Attendance", back_populates="session", cascade="all, delete-orphan")

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.ABSENT)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    confidence_score = Column(Float, nullable=True) # From ML model
    marked_by = Column(String(50), nullable=False, default="system") # system or teacher_id

    session = relationship("Session", back_populates="attendance_records")
    student = relationship("User", foreign_keys=[student_id])
