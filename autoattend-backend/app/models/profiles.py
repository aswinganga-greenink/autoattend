from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, FLOAT
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    student_id_number = Column(String(50), unique=True, index=True, nullable=False)
    
    # Store the face encoding as a float array. We could use pgvector here in the future.
    face_encoding = Column(ARRAY(FLOAT), nullable=True) 
    
    # Relationship to user
    user = relationship("User", backref="student_profile")

class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    department = Column(String(100), nullable=True)
    
    user = relationship("User", backref="teacher_profile")

class ParentProfile(Base):
    __tablename__ = "parent_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    phone_number = Column(String(20), nullable=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    user = relationship("User", foreign_keys=[user_id], backref="parent_profile")
