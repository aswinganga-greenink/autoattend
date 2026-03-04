import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.models.profiles import ParentProfile

async def link_parent_to_student(db, parent_email, student_email):
    parent = (await db.execute(select(User).where(User.email == parent_email))).scalar_one_or_none()
    student = (await db.execute(select(User).where(User.email == student_email))).scalar_one_or_none()
    if parent and student:
        existing = await db.execute(select(ParentProfile).where(ParentProfile.user_id == parent.id))
        if not existing.scalar_one_or_none():
            new_profile = ParentProfile(user_id=parent.id, student_id=student.id, phone_number="555-1234")
            db.add(new_profile)
            await db.commit()
            print(f"Linked {parent_email} -> {student_email}")
        else:
            print(f"{parent_email} already linked.")
    else:
        print(f"Could not find {parent_email} or {student_email}")

async def main():
    async with AsyncSessionLocal() as db:
        await link_parent_to_student(db, 'Sisira@gmail.com', 'aswinganga@gmail.com')
        await link_parent_to_student(db, 'sulochana@gmail.com', 'vaishna@gmail.com')

asyncio.run(main())
