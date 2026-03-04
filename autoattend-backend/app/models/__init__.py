from app.db.base_class import Base
from app.models.user import User
from app.models.profiles import StudentProfile, TeacherProfile, ParentProfile
from app.models.class_group import ClassGroup, ClassEnrollment
from app.models.course import Course, Session, Attendance
from app.models.enrollment import Enrollment

# This file is used by Alembic to discover all models
__all__ = [
    "Base",
    "User",
    "StudentProfile",
    "TeacherProfile",
    "ParentProfile",
    "Course",
    "Session",
    "Attendance",
    "Enrollment"
]
