import uuid
from sqlalchemy import Column, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student = relationship("User", foreign_keys=[student_id])
    course = relationship("Course", back_populates="enrollments")
