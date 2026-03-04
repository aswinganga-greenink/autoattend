import asyncio
import os
import sys

# Add backend dir to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from sqlalchemy import select

async def create_admin():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@school.edu"))
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            admin_user = User(
                email="admin@school.edu",
                full_name="System Admin",
                role=UserRole.ADMIN,
                hashed_password=get_password_hash("admin123"),
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            print("Admin user created successfully! (admin@school.edu / admin123)")
        else:
            print("Admin user already exists.")

if __name__ == "__main__":
    asyncio.run(create_admin())
