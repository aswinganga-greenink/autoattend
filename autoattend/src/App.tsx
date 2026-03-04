import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";
import DashboardLayout from "@/components/DashboardLayout";
import TeacherOverview from "@/pages/teacher/TeacherOverview";
import TeacherAttendance from "@/pages/teacher/TeacherAttendance";
import TeacherAddFace from "@/pages/teacher/TeacherAddFace";
import TeacherStudents from "@/pages/teacher/TeacherStudents";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminClasses from "@/pages/admin/AdminClasses";
import AdminCourses from "@/pages/admin/AdminCourses";
import StudentOverview from "@/pages/student/StudentOverview";
import StudentAttendance from "@/pages/student/StudentAttendance";
import StudentProfile from "@/pages/student/StudentProfile";
import ParentOverview from "@/pages/parent/ParentOverview";
import ParentAttendance from "@/pages/parent/ParentAttendance";
import TimetablePage from "@/pages/shared/TimetablePage";
import ReportsPage from "@/pages/shared/ReportsPage";
import NotificationsPage from "@/pages/shared/NotificationsPage";
import SettingsPage from "@/pages/shared/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<DashboardLayout />}>
              <Route path="overview" element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="classes" element={<AdminClasses />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Teacher Routes */}
            <Route path="/teacher" element={<DashboardLayout />}>
              <Route path="overview" element={<TeacherOverview />} />
              <Route path="attendance" element={<TeacherAttendance />} />
              <Route path="add-face" element={<TeacherAddFace />} />
              <Route path="students" element={<TeacherStudents />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Student Routes */}
            <Route path="/student" element={<DashboardLayout />}>
              <Route path="overview" element={<StudentOverview />} />
              <Route path="attendance" element={<StudentAttendance />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Parent Routes */}
            <Route path="/parent" element={<DashboardLayout />}>
              <Route path="overview" element={<ParentOverview />} />
              <Route path="attendance" element={<ParentAttendance />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
