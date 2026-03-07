from datetime import datetime, timedelta
from app.models.course import Session

def is_session_active(session: Session, grace_period_minutes: int = 15) -> bool:
    """
    Checks if the current time strictly falls between the session's start and end times,
    allowing for a configurable grace period before the start and after the end.
    """
    now = datetime.now()
    
    start_margin = session.start_time - timedelta(minutes=grace_period_minutes)
    end_margin = session.end_time + timedelta(minutes=grace_period_minutes)
    
    return start_margin <= now <= end_margin
