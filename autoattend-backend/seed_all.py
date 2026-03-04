import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.profiles import ParentProfile, StudentProfile
from app.core.security import get_password_hash

async def create_user_if_not_exists(db, email, password, full_name, role):
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user:
        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=role,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Created user: {email} ({role})")
    else:
        print(f"User {email} already exists.")
    return user

async def main():
    async with AsyncSessionLocal() as db:
        # 1. Ensure Admin exists
        await create_user_if_not_exists(db, 'admin@school.edu', 'admin123', 'System Admin', UserRole.ADMIN)

        # 2. Ensure Students exist
        student1 = await create_user_if_not_exists(db, 'aswinganga@gmail.com', 'student123', 'Aswin Ganga', UserRole.STUDENT)
        student2 = await create_user_if_not_exists(db, 'vaishna@gmail.com', 'student123', 'Vaishna', UserRole.STUDENT)

        # Add student profiles if missing
        if not (await db.execute(select(StudentProfile).where(StudentProfile.user_id == student1.id))).scalar_one_or_none():
            db.add(StudentProfile(user_id=student1.id, student_id_number="STU001"))
        if not (await db.execute(select(StudentProfile).where(StudentProfile.user_id == student2.id))).scalar_one_or_none():
            db.add(StudentProfile(user_id=student2.id, student_id_number="STU002"))
        await db.commit()

        # 3. Ensure Parents exist
        parent1 = await create_user_if_not_exists(db, 'Sisira@gmail.com', 'parent123', 'Sisira', UserRole.PARENT)
        parent2 = await create_user_if_not_exists(db, 'sulochana@gmail.com', 'parent123', 'Sulochana', UserRole.PARENT)

        # 4. Link Parents to Students
        from seed_parent import link_parent_to_student
        await link_parent_to_student(db, 'Sisira@gmail.com', 'aswinganga@gmail.com')
        await link_parent_to_student(db, 'sulochana@gmail.com', 'vaishna@gmail.com')

if __name__ == "__main__":
    asyncio.run(main())
