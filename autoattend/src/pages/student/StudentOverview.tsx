import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Clock, BookOpen } from "lucide-react";
import CircularProgress from "@/components/CircularProgress";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { Camera, Send, XCircle } from "lucide-react";

const StudentOverview = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanStatus, setScanStatus] = useState<{ loading: boolean, error: string, success: string }>({ loading: false, error: "", success: "" });
  const [stats, setStats] = useState<any>(null);
  const [classGroups, setClassGroups] = useState<any[]>([]);

  useEffect(() => {
    fetchSessions();
    fetchStats();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await api.get("/classes/my");
      setClassGroups(res.data);
    } catch (e) {
      console.error("Failed to fetch classes", e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/attendance/stats");
      setStats(res.data);
    } catch (e) {
      console.error("Failed to fetch student stats", e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get("/timetable/");
      setSessions(res.data);
      if (res.data.length > 0) {
        setSelectedSessionId(res.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanAttendance = async () => {
    if (!scanFile || !selectedSessionId) return;
    setScanStatus({ loading: true, error: "", success: "" });
    try {
      const formData = new FormData();
      formData.append("file", scanFile);
      await api.post(`/attendance/scan?session_id=${selectedSessionId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setScanStatus({ loading: false, error: "", success: "Attendance marked successfully!" });
      setScanFile(null);
    } catch (e: any) {
      setScanStatus({ loading: false, error: e.response?.data?.detail || "Face recognition failed", success: "" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="glass-card p-6 glow-gold">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-xl font-bold">
              {user?.full_name?.split(" ").map((n) => n[0]).join("") || "S"}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{user?.full_name || "Student"}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-2 items-center mt-1">
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                {classGroups.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                    Class: {classGroups[0].name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs bg-success/10 text-success px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
            Currently On Campus
          </span>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last recognized: 09:15 AM
          </div>
        </div>

        {/* Attendance Ring */}
        <div className="glass-card p-6 flex flex-col items-center justify-center">
          <h3 className="font-semibold text-foreground mb-2 text-sm">Overall Attendance</h3>
          <CircularProgress percentage={stats?.overall?.percentage || 0} size={180} label="This Semester" />
        </div>

        {/* Face Scan Attendance component */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" /> Mark Attendance
          </h3>

          <div className="space-y-3">
            <select
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {sessions.length === 0 && <option value="">No Active Sessions</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.course?.name || "Unknown Course"}</option>
              ))}
            </select>

            <div className="pt-2">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-foreground file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>

            <button
              onClick={handleScanAttendance}
              disabled={scanStatus.loading || !scanFile || !selectedSessionId}
              className="w-full py-2 gradient-gold text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {scanStatus.loading ? "Scanning..." : "Confirm Presence"}
            </button>

            {scanStatus.success && <p className="text-xs text-success text-center mt-2 font-medium">{scanStatus.success}</p>}
            {scanStatus.error && (
              <p className="text-xs text-destructive text-center mt-2 flex items-center justify-center gap-1">
                <XCircle className="w-3 h-3" /> {scanStatus.error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Subject Breakdown */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Subject-wise Attendance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">Subject</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">Attended</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">Total</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {stats?.subjects?.map((s: any) => (
                <tr key={s.subject} className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-sm text-foreground">{s.subject}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{s.attended}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{s.total}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-sm font-medium ${s.percentage >= 75 ? "text-success" : "text-destructive"}`}>
                      {s.percentage}%
                    </span>
                  </td>
                </tr>
              ))}
              {(!stats?.subjects || stats.subjects.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground border-dashed">
                    No active enrollments or attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Announcements */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-foreground mb-4 text-sm">Announcements</h3>
        <div className="space-y-2">
          <div className="p-3 bg-secondary/30 rounded-xl">
            <p className="text-sm text-foreground">Welcome to AutoAttend!</p>
            <p className="text-xs text-muted-foreground">Make sure to enroll in your required courses.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentOverview;
