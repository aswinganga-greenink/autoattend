import logging
from uuid import UUID
from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.ml.mock_engine import mock_engine
from app.models.course import Attendance, Session, AttendanceStatus

logger = logging.getLogger(__name__)

async def process_attendance_image(
    db: AsyncSession,
    session_id: UUID,
    file: UploadFile
) -> Attendance:
    """
    Process an uploaded image to mark attendance via the Face Recognition Engine.
    """
    # 1. Verify the session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 2. Read image bytes
    try:
        image_bytes = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded image: {e}")
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    # 3. Call the ML Engine
    is_match, confidence, student_id_str = await mock_engine.match_face(db, image_bytes)
    
    if not is_match or not student_id_str:
        raise HTTPException(
            status_code=400, 
            detail="Face not recognized or confidence too low."
        )
        
    try:
        student_id = UUID(student_id_str)
    except ValueError:
        raise HTTPException(status_code=500, detail="Invalid student ID returned from ML engine")
        
    # 4. Record Attendance
    # Check if already marked for this session
    existing_attendance_query = await db.execute(
        select(Attendance).where(
            Attendance.session_id == session_id,
            Attendance.student_id == student_id
        )
    )
    existing_attendance = existing_attendance_query.scalar_one_or_none()
    
    if existing_attendance:
        # Update existing record (e.g., if re-scanning a higher confidence)
        existing_attendance.confidence_score = confidence
        existing_attendance.status = AttendanceStatus.PRESENT
        db.add(existing_attendance)
        await db.commit()
        await db.refresh(existing_attendance)
        return existing_attendance
        
    # Create new record
    new_attendance = Attendance(
        session_id=session_id,
        student_id=student_id,
        status=AttendanceStatus.PRESENT,
        confidence_score=confidence,
        marked_by="system_ml_engine"
    )
    
    db.add(new_attendance)
    await db.commit()
    await db.refresh(new_attendance)
    
    return new_attendance
