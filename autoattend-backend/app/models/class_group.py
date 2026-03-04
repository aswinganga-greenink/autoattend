import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class ClassGroup(Base):
    __tablename__ = "class_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    courses = relationship("Course", back_populates="class_group", cascade="all, delete-orphan")
    enrollments = relationship("ClassEnrollment", back_populates="class_group", cascade="all, delete-orphan")

class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    class_group_id = Column(UUID(as_uuid=True), ForeignKey("class_groups.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student = relationship("User", foreign_keys=[student_id])
    class_group = relationship("ClassGroup", back_populates="enrollments")
