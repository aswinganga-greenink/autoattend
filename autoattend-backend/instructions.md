# Auto Attend - Backend API Instructions

This document provides a detailed overview of the backend API endpoints implemented for the Auto Attend application,
including expected request formats and sample JSON responses.

The backend is built with FastAPI and runs on `http://127.0.0.1:8000`. All API routes are prefixed with `/api/v1`.

## 1. Authentication & Users

### Create a User
* **Endpoint:** `POST /api/v1/users/`
* **Description:** Register a new user (`student`, `teacher`, or `admin`).
* **Request Body (JSON):**
```json
{
"email": "student@school.edu",
"password": "secretpassword",
"full_name": "John Doe",
"role": "student"
}
```
* **Response (200 OK):**
```json
{
"email": "student@school.edu",
"full_name": "John Doe",
"role": "student",
"id": "0ffd9a9a-e3e5-47bb-b4af-f08e3aa3b919",
"is_active": true
}
```

### Login (Get JWT Token)
* **Endpoint:** `POST /api/v1/auth/login`
* **Description:** Authenticate a user and receive a JWT Bearer token.
* **Request Body (Form Data):**
* `username`: `student@school.edu`
* `password`: `secretpassword`
* **Response (200 OK):**
```json
{
"access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
"token_type": "bearer"
}
```

> **Note:** For all subsequent requests requiring authentication, include the header: `Authorization: Bearer
<access_token>`

    ---

    ## 2. Profiles & Face Registration

    ### Create Student Profile
    * **Endpoint:** `POST /api/v1/profiles/student`
    * **Description:** Create a profile for a student linking their university ID.
    * **Headers:** `Authorization: Bearer <token>`
        * **Request Body (JSON):**
        ```json
        {
        "user_id": "0ffd9a9a-e3e5-47bb-b4af-f08e3aa3b919",
        "student_id_number": "CS2021045"
        }
        ```
        * **Response (200 OK):**
        ```json
        {
        "user_id": "0ffd9a9a-e3e5-47bb-b4af-f08e3aa3b919",
        "student_id_number": "CS2021045"
        }
        ```

        ### Register Student Face
        * **Endpoint:** `POST /api/v1/profiles/student/{user_id}/face`
        * **Description:** Upload a profile picture to encode and store the student's 128-d face embedding vector.
        * **Headers:** `Authorization: Bearer <token>`
            * **Request Body:** `multipart/form-data`
            * `file`: The image file (e.g., `dummy.jpg`)
            * **Response (200 OK):**
            ```json
            {
            "user_id": "0ffd9a9a-e3e5-47bb-b4af-f08e3aa3b919",
            "student_id_number": "CS2021045"
            }
            ```

            ---

            ## 3. Course Management & Enrollment

            ### Create a Course (Teacher Only)
            * **Endpoint:** `POST /api/v1/courses/`
            * **Description:** Create a new course offering.
            * **Headers:** `Authorization: Bearer <teacher_token>`
                * **Request Body (JSON):**
                ```json
                {
                "name": "Machine Learning 101",
                "description": "Intro to ML concepts"
                }
                ```
                * **Response (200 OK):**
                ```json
                {
                "id": "7aea3629-3d48-4756-ba01-64676e14cd57",
                "name": "Machine Learning 101",
                "description": "Intro to ML concepts",
                "teacher_id": "8b5d5bfa-2c8c-4c6d-9b87-d4d03e54b6ad"
                }
                ```

                ### Create a Session (Teacher Only)
                * **Endpoint:** `POST /api/v1/courses/sessions`
                * **Description:** Create a scheduled class session for a specific course.
                * **Headers:** `Authorization: Bearer <teacher_token>`
                    * **Request Body (JSON):**
                    ```json
                    {
                    "course_id": "7aea3629-3d48-4756-ba01-64676e14cd57",
                    "start_time": "2026-10-27T10:00:00Z",
                    "end_time": "2026-10-27T11:00:00Z",
                    "room": "Room 201"
                    }
                    ```
                    * **Response (200 OK):**
                    ```json
                    {
                    "id": "7df21db3-a0b0-4e6b-a8ec-5299da8f8740",
                    "course_id": "7aea3629-3d48-4756-ba01-64676e14cd57",
                    "start_time": "2026-10-27T10:00:00Z",
                    "end_time": "2026-10-27T11:00:00Z",
                    "room": "Room 201"
                    }
                    ```

                    ### Enroll in a Course (Student Only)
                    * **Endpoint:** `POST /api/v1/courses/{course_id}/enroll`
                    * **Description:** Enroll the authenticated student in the specified course.
                    * **Headers:** `Authorization: Bearer <student_token>`
                        * **Response (200 OK):** Returns the `CourseResponse` object of the enrolled course.

                        ### Get My Enrolled Courses (Student Only)
                        * **Endpoint:** `GET /api/v1/courses/my/enrollments`
                        * **Description:** Retrieve a list of courses the authenticated student is currently enrolled
                        in.
                        * **Headers:** `Authorization: Bearer <student_token>`

                            ---

                            ## 4. Timetable

                            ### Get My Timetable
                            * **Endpoint:** `GET /api/v1/timetable/`
                            * **Description:** Retrieve the schedule of class sessions. For students, this returns
                            sessions for courses they are enrolled in. For teachers, it returns sessions for courses
                            they teach.
                            * **Headers:** `Authorization: Bearer <token>`
                                * **Response (200 OK):**
                                ```json
                                [
                                {
                                "id": "7df21db3-a0b0-4e6b-a8ec-5299da8f8740",
                                "course_id": "7aea3629-3d48-4756-ba01-64676e14cd57",
                                "start_time": "2026-10-27T10:00:00Z",
                                "end_time": "2026-10-27T11:00:00Z",
                                "room": "Room 201"
                                }
                                ]
                                ```

                                ---

                                ## 5. Attendance

                                ### Scan Face & Mark Attendance
                                * **Endpoint:** `POST /api/v1/attendance/scan?session_id={session_id}`
                                * **Description:** Scans the uploaded image, generates a 128-d mock embedding, compares
                                it against the database of student profile encodings using cosine similarity, and marks
                                the student as `present` if the confidence score exceeds the threshold.
                                * **Headers:** `Authorization: Bearer <token>`
                                    * **Query Params:** `session_id`
                                    * **Request Body:** `multipart/form-data`
                                    * `file`: The captured image from the frontend camera.
                                    * **Response (200 OK):**
                                    ```json
                                    {
                                    "id": "83c1fd8f-61d5-49f7-a722-2195d78e49d5",
                                    "session_id": "7df21db3-a0b0-4e6b-a8ec-5299da8f8740",
                                    "student_id": "0ffd9a9a-e3e5-47bb-b4af-f08e3aa3b919",
                                    "status": "present",
                                    "timestamp": "2026-03-01T01:31:59.729666Z",
                                    "confidence_score": 1.0,
                                    "marked_by": "system_ml_engine"
                                    }
                                    ```