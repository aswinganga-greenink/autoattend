import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";
import { motion } from "framer-motion";
import { ScanFace, GraduationCap, User, Users, Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";

const defaultRoles: { value: UserRole; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "teacher", label: "Teacher", icon: GraduationCap, desc: "Manage attendance & students" },
  { value: "student", label: "Student", icon: User, desc: "View your attendance" },
  { value: "parent", label: "Parent", icon: Users, desc: "Monitor your child" },
];

const LoginPage = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const showAdmin = params.get("admin") === "true";

  const visibleRoles = showAdmin
    ? [{ value: "admin" as UserRole, label: "Admin", icon: Shield, desc: "System management" }, ...defaultRoles]
    : defaultRoles;

  // Auto-fill demo credentials based on role
  useEffect(() => {
    if (selectedRole === "admin") {
      setEmail("admin@school.edu");
      setPassword("admin123");
    } else if (selectedRole === "teacher") {
      setEmail("teacher@school.edu");
      setPassword("secretpassword");
    } else if (selectedRole === "student") {
      setEmail("student@school.edu");
      setPassword("studentpass");
    } else if (selectedRole === "parent") {
      setEmail("parent@school.edu");
      setPassword("parentpass");
    }
  }, [selectedRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      // Wait a moment for UX
      setTimeout(() => {
        const routes: Record<UserRole, string> = {
          admin: "/admin/overview",
          teacher: "/teacher/overview",
          student: "/student/overview",
          parent: "/parent/overview",
        };
        // Just fallback to the role they selected if their user object doesn't have it explicitly set yet, or trust backend role
        navigate(routes[user.role as UserRole] || routes[selectedRole]);
      }, 500);
    } catch (err: any) {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center">
              <ScanFace className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">VisionAttend</h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">AI Face Attendance</p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 glow-gold">
          <h2 className="text-lg font-semibold text-foreground mb-6">Sign in to your account</h2>

          {/* Role Selection */}
          <div className={`grid gap-2 mb-6 ${showAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {visibleRoles.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`p-3 rounded-xl border text-center transition-all duration-200 ${selectedRole === role.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground/30"
                  }`}
              >
                <role.icon className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">{role.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@visionattend.edu"
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Eye className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`} />
              {isLoading ? "Signing in..." : `Sign In as ${visibleRoles.find((r) => r.value === selectedRole)?.label || "..."}`}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Enter your valid school credentials to continue.
          </p>
        </div>

        <p className="text-xs text-muted-foreground/50 text-center mt-6">
          Powered by AI Face Recognition • Secure & Private
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
