from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)

async def sqlalchemy_integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Catches database integrity errors, such as unique constraint violations.
    """
    logger.error(f"IntegrityError: {exc.orig}")
    
    # Generic safe message
    detail = "A database constraint was violated."
    
    # Check if we can extract a specific column error safely
    if hasattr(exc.orig, 'diag') and getattr(exc.orig.diag, 'constraint_name', None):
        if "users_email_key" in exc.orig.diag.constraint_name:
            detail = "A user with this email already exists."
        elif "student_profiles_student_id_number_key" in exc.orig.diag.constraint_name:
            detail = "A student with this ID number already exists."
            
    return JSONResponse(
        status_code=400,
        content={"detail": detail},
    )
