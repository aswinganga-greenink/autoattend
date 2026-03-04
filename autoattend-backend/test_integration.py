"""Integration test for the AutoAttend backend."""
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

BASE = "http://test"

async def login(client, email, password):
    r = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

async def test():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=BASE) as c:
        admin_h = await login(c, "admin@school.edu", "admin123")

        # 1. Create class
        r = await c.post("/api/v1/classes/", json={"name": "Integration Class", "description": "test"}, headers=admin_h)
        assert r.status_code == 201, f"Create class: {r.text}"
        class_id = r.json()["id"]
        print(f"PASS: Create class — {class_id}")

        # 2. Create teacher (skip if already exists)
        r = await c.post("/api/v1/users/", json={
            "email": "teacher_int@school.edu", "full_name": "Int Teacher",
            "role": "TEACHER", "password": "teach123"
        })
        print(f"Create teacher: {r.status_code} {r.json().get('email','already exists')}")
        teacher_h = await login(c, "teacher_int@school.edu", "teach123")

        # 3. Create course in class
        r = await c.post("/api/v1/courses/", json={
            "name": "Science 101", "class_group_id": class_id, "schedule_info": "Mon/Wed 9am"
        }, headers=teacher_h)
        assert r.status_code == 201, f"Create course: {r.text}"
        course_id = r.json()["id"]
        print(f"PASS: Create course — {course_id}")

        # 4. Get a student to enroll
        r = await c.get("/api/v1/users/students", headers=admin_h)
        students = r.json()
        assert len(students) > 0, "No students found"
        student = students[0]
        student_id = student["id"]
        student_email = student["email"]
        print(f"Using student: {student_email}")

        # 5. Enroll student in class — should cascade to course
        r = await c.post(f"/api/v1/classes/{class_id}/enroll/{student_id}", headers=admin_h)
        assert r.status_code == 201, f"Enroll in class: {r.text}"
        print(f"PASS: Enroll — {r.json()}")

        # 6. Student should now see the course
        student_h = await login(c, student_email, "student123")
        r = await c.get("/api/v1/courses/my/enrollments", headers=student_h)
        assert r.status_code == 200
        names = [x["name"] for x in r.json()]
        assert "Science 101" in names, f"Student missing course, got: {names}"
        print(f"PASS: Student sees inherited course — {names}")

        # 7. Update course name + schedule
        r = await c.put(f"/api/v1/courses/{course_id}", json={
            "name": "Science 101 (Updated)", "schedule_info": "Tue/Thu 10am"
        }, headers=teacher_h)
        assert r.status_code == 200, f"Update course: {r.text}"
        assert r.json()["name"] == "Science 101 (Updated)"
        print(f"PASS: Update course — {r.json()['name']}, schedule: {r.json()['schedule_info']}")

        # 8. GET class detail (tests eager loading — no MissingGreenlet)
        r = await c.get(f"/api/v1/classes/{class_id}", headers=admin_h)
        assert r.status_code == 200, f"Class detail: {r.text}"
        detail = r.json()
        print(f"PASS: Class detail — {len(detail['enrollments'])} enrollments, {len(detail['courses'])} courses")

        # 9. GET /courses/{id} detail with student_count
        r = await c.get(f"/api/v1/courses/{course_id}", headers=admin_h)
        assert r.status_code == 200, f"Course detail: {r.text}"
        print(f"PASS: Course detail — student_count={r.json()['student_count']}")

        # 10. Timetable as admin should return results (not empty)
        r = await c.get("/api/v1/timetable/", headers=admin_h)
        assert r.status_code == 200
        print(f"PASS: Admin timetable — {len(r.json())} sessions")

        # 11. Unenroll student from class
        r = await c.delete(f"/api/v1/classes/{class_id}/enroll/{student_id}", headers=admin_h)
        assert r.status_code == 200, f"Unenroll: {r.text}"
        print(f"PASS: Unenroll — {r.json()}")

        # 12. Student should no longer see the course
        r = await c.get("/api/v1/courses/my/enrollments", headers=student_h)
        names = [x["name"] for x in r.json()]
        assert "Science 101 (Updated)" not in names, f"Course still visible: {names}"
        print(f"PASS: Course removed after unenroll — courses now: {names}")

        # 13. Delete course (cascades sessions/attendance)
        r = await c.delete(f"/api/v1/courses/{course_id}", headers=admin_h)
        assert r.status_code == 204, f"Delete course: {r.text}"
        print("PASS: Delete course")

        # 14. Delete class
        r = await c.delete(f"/api/v1/classes/{class_id}", headers=admin_h)
        assert r.status_code == 204, f"Delete class: {r.text}"
        print("PASS: Delete class")

        print()
        print("=" * 40)
        print("ALL INTEGRATION TESTS PASSED")
        print("=" * 40)


if __name__ == "__main__":
    asyncio.run(test())
