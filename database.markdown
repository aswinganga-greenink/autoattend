# AutoAttender – Database Implementation Plan

Database: MySQL 8+
Engine: InnoDB
Charset: utf8mb4
Collation: utf8mb4_unicode_ci

---

# 1. Database Initialization

## Objectives
- Create production-ready MySQL schema
- Enforce referential integrity
- Optimize for face recognition lookup and attendance queries
- Prepare for scaling

## Global Configuration
- Enable strict mode
- Use InnoDB engine for all tables
- Add indexes on all foreign keys
- Use UTC timestamps

---

# 2. Core Tables Implementation

## 2.1 users

Purpose: Central identity table

Fields:
- id (INT PK AUTO_INCREMENT)
- username (VARCHAR 100 UNIQUE NOT NULL)
- password_hash (VARCHAR 255 NOT NULL)
- email (VARCHAR 255 UNIQUE NOT NULL)
- role (ENUM: student, teacher, admin, parent)
- user_id (VARCHAR 128)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)

Indexes:
- UNIQUE(username)
- UNIQUE(email)
- INDEX(role)

---

## 2.2 teacher

Purpose: Teacher-specific profile

Fields:
- id (INT PK AUTO_INCREMENT)
- teacher_id (INT FK → users.id ON DELETE CASCADE)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

Indexes:
- INDEX(teacher_id)

---

## 2.3 classes

Purpose: Academic class grouping

Fields:
- id (INT PK AUTO_INCREMENT)
- student_id (INT FK → users.id ON DELETE CASCADE)
- class_name (VARCHAR 150)
- section (VARCHAR 50)
- academic_year (VARCHAR 20)

Indexes:
- INDEX(student_id)
- INDEX(academic_year)

---

## 2.4 timetable

Purpose: Class schedule configuration

Fields:
- id (INT PK AUTO_INCREMENT)
- teacher_id (INT FK → teacher.id)
- class_name (VARCHAR 150)
- day_of_week (TINYINT)
- start_time (TIME)
- end_time (TIME)

Indexes:
- INDEX(teacher_id)
- INDEX(day_of_week)

---

## 2.5 face_data

Purpose: Store facial embeddings

Fields:
- id (INT PK AUTO_INCREMENT)
- user_id (INT FK → users.id ON DELETE CASCADE)
- face_encodings (BLOB NOT NULL)
- image_path (VARCHAR 255)
- confidence (FLOAT)
- is_active (BOOLEAN DEFAULT TRUE)
- uploaded_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

Indexes:
- INDEX(user_id)
- INDEX(is_active)

---

## 2.6 attendance

Purpose: Store attendance records

Fields:
- id (INT PK AUTO_INCREMENT)
- student_id (INT FK → users.id)
- date (DATE)
- time (TIME)
- status (ENUM: present, absent, flagged)
- class_subject (VARCHAR 150)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

Indexes:
- INDEX(student_id)
- INDEX(date)
- INDEX(status)
- Composite INDEX(student_id, date)

---

## 2.7 parent

Purpose: Link parent to student

Fields:
- id (INT PK AUTO_INCREMENT)
- student_id (INT FK → users.id ON DELETE CASCADE)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

Indexes:
- INDEX(student_id)

---

## 2.8 notifications

Purpose: Store notification logs

Fields:
- id (INT PK AUTO_INCREMENT)
- user_id (INT FK → users.id ON DELETE CASCADE)
- message (TEXT)
- type (VARCHAR 50)
- is_read (BOOLEAN DEFAULT FALSE)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- sent_at (TIMESTAMP NULL)

Indexes:
- INDEX(user_id)
- INDEX(is_read)

---

## 2.9 anomaly_logs

Purpose: Log suspicious activities

Fields:
- id (INT PK AUTO_INCREMENT)
- anomaly_type (VARCHAR 100)
- description (TEXT)
- ip_address (VARCHAR 45)
- resolved (BOOLEAN DEFAULT FALSE)
- detected_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

Indexes:
- INDEX(anomaly_type)
- INDEX(resolved)

---

## 2.10 login_attempts

Purpose: Security monitoring

Fields:
- id (INT PK AUTO_INCREMENT)
- username (VARCHAR 100)
- ip_address (VARCHAR 45)
- success (BOOLEAN)
- attempted_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- user_agent (TEXT)

Indexes:
- INDEX(username)
- INDEX(ip_address)
- INDEX(attempted_at)

---

# 3. Referential Integrity Rules

- CASCADE delete on dependent tables (face_data, parent)
- RESTRICT delete on attendance history
- Validate foreign keys during migration

---

# 4. Face Recognition Optimization Strategy

Current Approach:
- Load active embeddings into memory during session
- Compute cosine similarity in application layer

Scaling Upgrade Path:
- Move embeddings to FAISS index
- Maintain DB only for metadata
- Sync FAISS index on new registration

---

# 5. Attendance Query Optimization

Frequent Queries:
- Daily attendance by class
- Monthly attendance per student
- Low confidence detection

Add Composite Indexes:
- (student_id, date)
- (date, class_subject)

---

# 6. Security Practices

- Encrypt MySQL connection (SSL)
- Hash passwords with bcrypt
- Restrict DB user privileges
- Enable audit logging
- Rate-limit login attempts

---

# 7. Migration & Versioning

Use:
- Flask-Migrate (Alembic)

Migration Order:
1. users
2. teacher
3. classes
4. timetable
5. face_data
6. attendance
7. parent
8. notifications
9. anomaly_logs
10. login_attempts

---

# 8. Backup Strategy

- Daily automated dump
- Weekly full backup
- Store encrypted offsite
- Test restore monthly

---

# 9. Execution Order

1. Initialize database
2. Create users table
3. Implement role-specific tables
4. Add face_data
5. Add attendance
6. Add security tables
7. Add indexes
8. Run migration tests
9. Seed initial admin user

---

END OF DATABASE IMPLEMENTATION PLAN
