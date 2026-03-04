# AutoAttender Backend -- Complete Development Plan

## Stack

-   Backend: Flask (Python)
-   Database: MySQL
-   Face Detection: Haar Cascade (OpenCV)
-   Face Recognition: FaceNet (Embeddings)
-   Authentication: Firebase Authentication
-   Notifications: Firebase Cloud Messaging (FCM)
-   Security: JWT (Flask-JWT-Extended), HTTPS

------------------------------------------------------------------------

# PHASE 1 --- Project Setup

## Objectives

Initialize backend structure, environment, and dependencies.

## Core Tasks

-   Create virtual environment
-   Install dependencies
-   Setup MySQL connection
-   Configure Firebase Admin SDK
-   Configure environment variables
-   Setup Flask app factory pattern

## Required Libraries

-   flask
-   flask_sqlalchemy
-   flask_jwt_extended
-   mysqlclient / pymysql
-   firebase-admin
-   opencv-python
-   numpy
-   mtcnn (optional alternative to Haar)
-   tensorflow / keras (FaceNet)
-   python-dotenv

## Folder Structure

    autoattender/
    │
    ├── app/
    │   ├── __init__.py
    │   ├── config.py
    │   ├── models/
    │   ├── routes/
    │   ├── services/
    │   ├── utils/
    │   └── extensions.py
    │
    ├── migrations/
    ├── tests/
    ├── requirements.txt
    └── run.py

## Expected Output

Running Flask server connected to MySQL and Firebase.

------------------------------------------------------------------------

# PHASE 2 --- Database Design

## Tables

### users

-   id (INT PK AUTO_INCREMENT)
-   firebase_uid (VARCHAR 128 UNIQUE)
-   name (VARCHAR 255)
-   email (VARCHAR 255 UNIQUE)
-   role (ENUM: student, admin)
-   created_at (TIMESTAMP)

### students

-   id (INT PK AUTO_INCREMENT)
-   user_id (INT FK -\> users.id)
-   registration_number (VARCHAR 100 UNIQUE)
-   embedding_vector (BLOB)
-   created_at (TIMESTAMP)

### classes

-   id (INT PK AUTO_INCREMENT)
-   name (VARCHAR 255)
-   schedule_time (DATETIME)
-   created_at (TIMESTAMP)

### attendance

-   id (INT PK AUTO_INCREMENT)
-   student_id (INT FK -\> students.id)
-   class_id (INT FK -\> classes.id)
-   confidence_score (FLOAT)
-   status (ENUM: present, absent, flagged)
-   timestamp (DATETIME)

### anomalies

-   id (INT PK AUTO_INCREMENT)
-   attendance_id (INT FK)
-   reason (TEXT)
-   flagged_at (DATETIME)

## Expected Output

Normalized schema with foreign keys and indexing.

------------------------------------------------------------------------

# PHASE 3 --- Authentication Flow

## Objective

Authenticate using Firebase ID token and issue backend JWT.

## Flow

Client → Firebase Login → ID Token → Backend Verification → Issue JWT

## Core Tasks

-   Verify Firebase ID token using Firebase Admin SDK
-   Create local user record if not exists
-   Generate JWT using Flask-JWT-Extended

## API Routes

POST /auth/login GET /auth/profile

## Database Interaction

-   Query user by firebase_uid
-   Insert if new

## Expected Output

Authenticated session secured with JWT.

------------------------------------------------------------------------

# PHASE 4 --- Face Registration Module

## Objective

Capture and store student face embeddings.

## Model Flow

Image → Haar Cascade → Crop Face → FaceNet → 128-d Embedding → Store in
DB

## Core Tasks

-   Accept image upload
-   Detect face
-   Normalize image
-   Generate embedding
-   Store embedding as BLOB

## API Routes

POST /students/register-face

## Confidence Threshold Logic

-   Reject image if no face detected
-   Reject if multiple faces detected
-   Store only high-quality single face embeddings

## Expected Output

Student embedding stored in database.

------------------------------------------------------------------------

# PHASE 5 --- Face Recognition Attendance Module

## Objective

Mark attendance automatically using similarity comparison.

## Model Flow

Frame → Detect Face → Generate Embedding → Compare with stored
embeddings → Mark Attendance

## Similarity Check

Use cosine similarity.

Threshold Logic: - similarity \> 0.75 → Present - 0.60--0.75 → Flagged -
\< 0.60 → Unknown

## API Routes

POST /attendance/mark

## Database Interaction

-   Fetch all student embeddings
-   Compute similarity
-   Insert attendance record

## Expected Output

Attendance record stored with confidence score.

------------------------------------------------------------------------

# PHASE 6 --- API Endpoint Structure

## Admin

POST /classes/create GET /classes GET /attendance/class/`<id>`{=html}

## Student

GET /attendance/me

## Protected Endpoints

Use @jwt_required()

------------------------------------------------------------------------

# PHASE 7 --- Notification System (FCM)

## Objective

Notify students after attendance marking.

## Core Tasks

-   Store FCM token per user
-   Send notification via Firebase Admin SDK

## Notification Events

-   Attendance Marked
-   Flagged Attendance
-   Anomaly Detected

## API Routes

POST /notifications/register-token

------------------------------------------------------------------------

# PHASE 8 --- Real-Time Monitoring Logic

## Objective

Continuous frame processing during class.

## Approach

-   Use RTSP stream or webcam feed
-   Process frame every X seconds
-   Maintain in-memory recognized list per session

## Expected Output

Live recognition with duplicate prevention.

------------------------------------------------------------------------

# PHASE 9 --- Anomaly Detection Logic

## Triggers

-   Same student marked twice
-   Low similarity score
-   Attendance outside class time

## Action

Insert into anomalies table and notify admin.

------------------------------------------------------------------------

# PHASE 10 --- Security Implementation

## Security Measures

-   HTTPS (Nginx reverse proxy)
-   JWT expiration
-   Role-based access control
-   Encrypt embeddings at rest
-   Rate limiting

------------------------------------------------------------------------

# PHASE 11 --- Testing Strategy

## Unit Tests

-   Authentication flow
-   Face embedding generation
-   Similarity scoring

## Integration Tests

-   Full attendance flow
-   Notification trigger

## Tools

-   pytest
-   Postman

------------------------------------------------------------------------

# PHASE 12 --- Deployment

## Steps

-   Dockerize Flask app
-   Setup MySQL container
-   Configure Nginx reverse proxy
-   Deploy on VPS / AWS EC2
-   Setup SSL via Let's Encrypt

------------------------------------------------------------------------

# PHASE 13 --- Scalability Considerations

## Improvements

-   Move embedding search to FAISS
-   Use Redis caching
-   Horizontal scaling with Gunicorn workers
-   Background jobs via Celery

------------------------------------------------------------------------

# Execution Order

1.  Setup environment
2.  Design DB schema
3.  Implement authentication
4.  Implement face registration
5.  Implement recognition attendance
6.  Add notifications
7.  Add anomaly detection
8.  Add monitoring
9.  Secure system
10. Test
11. Deploy
12. Optimize scaling

------------------------------------------------------------------------

END OF BACKEND IMPLEMENTATION PLAN
