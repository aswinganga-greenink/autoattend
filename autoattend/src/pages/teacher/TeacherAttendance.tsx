import { useState, useEffect } from "react";
import { Search, Download, Filter, Calendar } from "lucide-react";
import { api } from "@/lib/api";

const TeacherAttendance = () => {
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch teacher's courses
      const coursesRes = await api.get("/courses/teacher/my-courses");
      const fetchedCourses = coursesRes.data;
      setCourses(fetchedCourses.map((c: any) => ({ id: c.id, name: c.name })));

      // 2. Fetch sessions for all courses
      let allSessions: any[] = [];
      for (const c of fetchedCourses) {
        const sessRes = await api.get(`/courses/${c.id}/sessions`);
        sessRes.data.forEach((s: any) => {
          allSessions.push({ ...s, courseName: c.name });
        });
      }
      setSessions(allSessions);

      // 3. Load attendance for most-recent session by default
      if (allSessions.length > 0) {
        const latestSession = allSessions[allSessions.length - 1];
        setSelectedSessionId(latestSession.id);
        await loadSessionAttendance(latestSession.id, fetchedCourses);
      }
    } catch (e) {
      console.error("Failed to load teacher attendance data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionAttendance = async (sessionId: string, fallbackCourses?: any[]) => {
    if (sessionId === "all") {
      setAttendanceData([]);
      return;
    }
    setLoading(true);
    try {
      // Get attendance records for this session
      const attRes = await api.get(`/attendance/session/${sessionId}`);
      const records = attRes.data;

      // Find which course this session belongs to
      const session = sessions.find(s => s.id === sessionId) ||
        { course: { id: "" } };
      const courseId = session.course?.id || session.course_id;

      // Get full roster for this course
      const rosterRes = await api.get(`/courses/${courseId}/students`);
      const roster = rosterRes.data;

      // Merge roster with attendance records
      const merged = roster.map((student: any) => {
        const record = records.find((r: any) => r.student_id === student.id);
        return {
          id: student.id,
          name: student.full_name,
          email: student.email,
          registerNumber: `STU-${student.id.substring(0, 4).toUpperCase()}`,
          status: record ? record.status.toLowerCase() : "absent",
          hasExistingRecord: !!record,
          sessionId,
          courseId,
        };
      });
      setAttendanceData(merged);
    } catch (e) {
      console.error("Failed to load session attendance:", e);
    } finally {
      setLoading(false);
    }
  };

  // Called when session picker changes
  const handleSessionChange = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    await loadSessionAttendance(sessionId);
  };

  // Toggle attendance and immediately persist to backend
  const toggleStatus = async (studentId: string, currentStatus: string, sessionId: string) => {
    const newStatus = currentStatus === "present" ? "absent" : "present";

    // Optimistic UI update
    setAttendanceData(prev =>
      prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s)
    );

    setSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      await api.post("/attendance/mark", {
        session_id: sessionId,
        student_id: studentId,
        status: newStatus.toUpperCase(),
        marked_by: "teacher",
      });
    } catch (e: any) {
      console.error("Failed to mark attendance:", e);
      // Roll back on error
      setAttendanceData(prev =>
        prev.map(s => s.id === studentId ? { ...s, status: currentStatus } : s)
      );
    } finally {
      setSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // Export current view as CSV
  const exportCSV = () => {
    if (attendanceData.length === 0) return;
    const sessionLabel = sessions.find(s => s.id === selectedSessionId)?.courseName || "attendance";
    const rows = [
      ["Name", "Register No.", "Email", "Status"],
      ...attendanceData.map(s => [s.name, s.registerNumber, s.email, s.status]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionLabel.replace(/\s+/g, "_")}_attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = attendanceData.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.registerNumber.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = attendanceData.filter(s => s.status === "present").length;

  return (
    <div className="space-y-6">
      {/* Session Picker */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calendar className="w-4 h-4 text-primary" />
          Session:
        </div>
        <select
          value={selectedSessionId}
          onChange={(e) => handleSessionChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">— Select a session —</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.courseName} · {new Date(s.start_time).toLocaleString(undefined, {
                dateStyle: "medium", timeStyle: "short"
              })} {s.room ? `· Room ${s.room}` : ""}
            </option>
          ))}
        </select>
        {selectedSessionId !== "all" && (
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            <span className="text-success font-semibold">{presentCount}</span> / {attendanceData.length} present
          </div>
        )}
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          onClick={exportCSV}
          disabled={attendanceData.length === 0}
          className="px-4 py-2.5 gradient-gold text-primary-foreground text-sm font-medium rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Student Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Register No.</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : selectedSessionId === "all" ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Select a session above to view and mark attendance.</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No students found.</td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{student.name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{student.registerNumber}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{student.email}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleStatus(student.id, student.status, student.sessionId)}
                        disabled={saving[student.id]}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${student.status === "present"
                            ? "bg-success/10 text-success hover:bg-success/20"
                            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          }`}
                      >
                        {saving[student.id] ? "Saving..." : student.status === "present" ? "Present" : "Absent"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendance;
