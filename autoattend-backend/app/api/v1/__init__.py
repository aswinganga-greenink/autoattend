from fastapi import APIRouter
from app.api.v1 import auth, users, attendance, timetable, profiles, courses, classes

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(timetable.router, prefix="/timetable", tags=["timetable"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
