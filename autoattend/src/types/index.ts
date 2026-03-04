export type UserRole = "admin" | "teacher" | "student" | "parent";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface Student {
  id: string;
  name: string;
  registerNumber: string;
  className: string;
  status: "present" | "absent";
  lastSeen: string;
  attendance: number;
  email: string;
  phone: string;
}

export interface AttendanceRecord {
  date: string;
  status: "present" | "absent" | "scheduled";
}

export interface Recognition {
  studentName: string;
  time: string;
  location: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "success";
}
