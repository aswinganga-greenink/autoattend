import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.models.profiles import ParentProfile

async def main():
    async with AsyncSessionLocal() as db:
        users = await db.execute(select(User))
        for u in users.scalars().all():
            print(f"User: {u.id}, {u.full_name}, {u.role}")

        profiles = await db.execute(select(ParentProfile))
        for p in profiles.scalars().all():
            print(f"ParentProfile: {p.user_id}, student_id: {p.student_id}")

asyncio.run(main())
