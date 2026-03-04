import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";
import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, UserPlus, Users, Calendar,
  FileBarChart, Bell, Settings, LogOut, ScanFace, User,
  ChevronLeft, Menu, Eye, Shield, BookOpen
} from "lucide-react";
import { NavLink } from "react-router-dom";
import ChangePasswordModal from "./ChangePasswordModal";

interface MenuItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const menuConfig: Record<UserRole, MenuItem[]> = {
  admin: [
    { label: "Overview", path: "/admin/overview", icon: LayoutDashboard },
    { label: "Manage Users", path: "/admin/users", icon: Users },
    { label: "Manage Classes", path: "/admin/classes", icon: Users },
    { label: "Manage Courses", path: "/admin/courses", icon: BookOpen },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ],
  teacher: [
    { label: "Overview", path: "/teacher/overview", icon: LayoutDashboard },
    { label: "Attendance", path: "/teacher/attendance", icon: ClipboardList },
    { label: "Add Student Face", path: "/teacher/add-face", icon: UserPlus },
    { label: "Student Details", path: "/teacher/students", icon: Users },
    { label: "Time Table", path: "/teacher/timetable", icon: Calendar },
    { label: "Reports", path: "/teacher/reports", icon: FileBarChart },
    { label: "Notifications", path: "/teacher/notifications", icon: Bell },
    { label: "Settings", path: "/teacher/settings", icon: Settings },
  ],
  student: [
    { label: "Overview", path: "/student/overview", icon: LayoutDashboard },
    { label: "Attendance Log", path: "/student/attendance", icon: ClipboardList },
    { label: "Time Table", path: "/student/timetable", icon: Calendar },
    { label: "Notifications", path: "/student/notifications", icon: Bell },
    { label: "Profile", path: "/student/profile", icon: User },
    { label: "Settings", path: "/student/settings", icon: Settings },
  ],
  parent: [
    { label: "Child Overview", path: "/parent/overview", icon: LayoutDashboard },
    { label: "Attendance", path: "/parent/attendance", icon: ClipboardList },
    { label: "Notifications", path: "/parent/notifications", icon: Bell },
    { label: "Reports", path: "/parent/reports", icon: FileBarChart },
    { label: "Settings", path: "/parent/settings", icon: Settings },
  ],
};

const DashboardLayout = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  if (!isAuthenticated || !user) return <Navigate to="/login" />;

  const menu = menuConfig[user.role];

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-30 flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${collapsed ? "w-16" : "w-60"
          }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 p-4 border-b border-border h-16">
          <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center flex-shrink-0">
            <ScanFace className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-foreground tracking-tight text-sm">VisionAttend</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            >
              {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <div>
              <h2 className="text-sm font-medium text-foreground capitalize">
                {location.pathname.split("/").pop()?.replace("-", " ")}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">{user.role} Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
            </div>
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                title="Change Password"
              >
                <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {user?.full_name?.split(" ").map((n) => n[0]).join("") || "U"}
                </div>
                {!collapsed && (
                  <div className="hidden sm:block">
                    <p className="text-xs font-medium text-foreground">{user?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                )}
              </button>
              <button
                onClick={logout}
                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg ml-2 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 animate-slide-in">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};

export default DashboardLayout;
