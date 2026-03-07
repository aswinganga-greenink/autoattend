import { useState, useEffect, useRef } from "react";
import { Search, Download, Calendar, ScanFace, X, Clock, Plus } from "lucide-react";
import { api } from "@/lib/api";

const TeacherAttendance = () => {
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // AI Scan state
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanDuration, setScanDuration] = useState(30); // minutes
  const [scanning, setScanning] = useState(false);
  const [scanCountdown, setScanCountdown] = useState(0);
  const [scanResult, setScanResult] = useState<any>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create Extra Session state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSession, setNewSession] = useState({
    courseId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
    room: ""
  });
  const [creatingSession, setCreatingSession] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const coursesRes = await api.get("/courses/teacher/my-courses");
      const fetchedCourses = coursesRes.data;

      let allSessions: any[] = [];
      for (const c of fetchedCourses) {
        const sessRes = await api.get(`/courses/${c.id}/sessions`);
        sessRes.data.forEach((s: any) => allSessions.push({ ...s, courseName: c.name }));
      }
      setSessions(allSessions);

      if (allSessions.length > 0) {
        const latest = allSessions[allSessions.length - 1];
        setSelectedSessionId(latest.id);
        await loadSessionAttendance(latest.id, fetchedCourses);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionAttendance = async (sessionId: string, fallbackCourses?: any[]) => {
    if (sessionId === "all") { setAttendanceData([]); return; }
    setLoading(true);
    try {
      const attRes = await api.get(`/attendance/session/${sessionId}`);
      const records = attRes.data;
      const session = sessions.find(s => s.id === sessionId);
      const courseId = session?.course?.id || session?.course_id;

      const rosterRes = await api.get(`/courses/${courseId}/students`);
      const roster = rosterRes.data;

      const merged = roster.map((student: any) => {
        const record = records.find((r: any) => r.student_id === student.id);
        return {
          id: student.id,
          name: student.full_name,
          email: student.email,
          registerNumber: `STU-${student.id.substring(0, 4).toUpperCase()}`,
          status: record ? record.status.toLowerCase() : "absent",
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

  const handleSessionChange = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    await loadSessionAttendance(sessionId);
  };

  const toggleStatus = async (studentId: string, currentStatus: string, sessionId: string) => {
    const newStatus = currentStatus === "present" ? "absent" : "present";
    setAttendanceData(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
    setSaving(prev => ({ ...prev, [studentId]: true }));
    try {
      await api.post("/attendance/mark", {
        session_id: sessionId,
        student_id: studentId,
        status: newStatus.toUpperCase(),
        marked_by: "teacher",
      });
    } catch (e) {
      setAttendanceData(prev => prev.map(s => s.id === studentId ? { ...s, status: currentStatus } : s));
    } finally {
      setSaving(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // ── AI Scan ─────────────────────────────────────────────
  const startAiScan = async () => {
    if (selectedSessionId === "all") return;
    setScanning(true);
    setScanResult(null);
    const durationSeconds = scanDuration * 60;
    setScanCountdown(durationSeconds);

    // Live countdown
    countdownRef.current = setInterval(() => {
      setScanCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);

    try {
      const res = await api.post(
        `/ml/recognize/${selectedSessionId}?duration=${durationSeconds}`
      );
      setScanResult(res.data);
      // Refresh attendance table
      await loadSessionAttendance(selectedSessionId);
    } catch (err: any) {
      setScanResult({ error: err.response?.data?.detail || "Recognition failed" });
    } finally {
      setScanning(false);
      clearInterval(countdownRef.current!);
      setScanCountdown(0);
    }
  };

  const cancelScan = () => {
    clearInterval(countdownRef.current!);
    setScanning(false);
    setScanCountdown(0);
    setShowScanModal(false);
    setScanResult(null);
  };

  const fmtCountdown = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  // ── Create Extra Session ──────────────────────────────────
  const handleCreateSession = async () => {
    if (!newSession.courseId) return alert("Please select a course");
    setCreatingSession(true);

    // Combine date and time
    const startObj = new Date(`${newSession.date}T${newSession.startTime}`);
    const endObj = new Date(`${newSession.date}T${newSession.endTime}`);

    try {
      await api.post("/courses/sessions", {
        course_id: newSession.courseId,
        start_time: startObj.toISOString(),
        end_time: endObj.toISOString(),
        room: newSession.room || "TBA"
      });
      setShowCreateModal(false);
      await fetchData(); // Refresh the list so the new session appears
    } catch (e: any) {
      alert("Failed to create session: " + (e.response?.data?.detail || e.message));
    } finally {
      setCreatingSession(false);
    }
  };

  // Helper to check if session is active (± 15 mins grace period)
  const isSessionActive = () => {
    if (selectedSessionId === "all") return false;
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return false;

    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);

    // Add 15 mins grace period to both ends
    start.setMinutes(start.getMinutes() - 15);
    end.setMinutes(end.getMinutes() + 15);

    return now >= start && now <= end;
  };

  const activeStatus = isSessionActive();

  // ── CSV Export ───────────────────────────────────────────
  const exportCSV = () => {
    if (attendanceData.length === 0) return;
    const rows = [
      ["Name", "Register No.", "Email", "Status"],
      ...attendanceData.map(s => [s.name, s.registerNumber, s.email, s.status]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${selectedSessionId}.csv`;
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
      {/* Session Picker + AI Scan */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground shrink-0">
          <Calendar className="w-4 h-4 text-primary" />
          Session:
        </div>
        <select
          value={selectedSessionId}
          onChange={(e) => handleSessionChange(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">— Select a session —</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.courseName} · {new Date(s.start_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              {s.room ? ` · ${s.room}` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Session</span>
        </button>
        {selectedSessionId !== "all" && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            <span className="text-success font-semibold">{presentCount}</span> / {attendanceData.length} present
          </span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowScanModal(true)}
            disabled={selectedSessionId === "all" || !activeStatus}
            title={!activeStatus && selectedSessionId !== "all" ? "Session is not currently active" : ""}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            <ScanFace className="w-4 h-4" />
            AI Face Scan
          </button>
        </div>
      </div>

      {!activeStatus && selectedSessionId !== "all" && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          <p>This session is not currently active. Attendance can only be marked during the scheduled time (± 15 mins).</p>
        </div>
      )}

      {/* Search + Export */}
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

      {/* Attendance Table */}
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
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : selectedSessionId === "all" ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Select a session above to view attendance.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No students found.</td></tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{student.name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{student.registerNumber}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{student.email}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleStatus(student.id, student.status, student.sessionId)}
                        disabled={saving[student.id] || !activeStatus}
                        title={!activeStatus ? "Session is not currently active" : ""}
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

      {/* AI Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ScanFace className="w-4 h-4 text-primary" />
                AI Face Recognition
              </div>
              {!scanning && (
                <button onClick={cancelScan} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              {!scanning && !scanResult && (
                <>
                  <p className="text-sm text-muted-foreground">
                    The webcam on the server machine will open and run face recognition for the selected session.
                    Students present for ≥ 20 seconds will be marked <span className="text-success font-medium">Present</span>.
                  </p>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Duration: <span className="text-primary">{scanDuration} minutes</span>
                    </label>
                    <input
                      type="range"
                      min={1} max={120} value={scanDuration}
                      onChange={e => setScanDuration(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1 min</span><span>60 min</span><span>120 min</span>
                    </div>
                  </div>
                  <button
                    onClick={startAiScan}
                    className="w-full py-3 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <ScanFace className="w-4 h-4" />
                    Start Recognition
                  </button>
                </>
              )}

              {scanning && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-20 h-20 mx-auto rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Recognition in progress…</p>
                    <p className="text-xs text-muted-foreground mt-1">Webcam is running on the server machine</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-2xl font-mono font-bold text-primary">
                    <Clock className="w-5 h-5" />
                    {fmtCountdown(scanCountdown)}
                  </div>
                  <p className="text-xs text-muted-foreground">Attendance will sync automatically when done.</p>
                </div>
              )}

              {scanResult && !scanning && (
                <div className="space-y-3">
                  {scanResult.error ? (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                      {scanResult.error}
                    </div>
                  ) : (
                    <div className="p-4 bg-success/10 border border-success/20 rounded-xl space-y-1">
                      <p className="font-semibold text-success text-sm">Scan Complete ✓</p>
                      <p className="text-xs text-muted-foreground">
                        {scanResult.records_synced} records synced · {scanResult.records_skipped} skipped
                      </p>
                    </div>
                  )}
                  <button
                    onClick={cancelScan}
                    className="w-full py-2.5 bg-secondary text-foreground text-sm font-medium rounded-xl hover:bg-secondary/80 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Create Extra Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                Create Extra Session
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Course</label>
                <select
                  value={newSession.courseId}
                  onChange={e => setNewSession({ ...newSession, courseId: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">— Select a Course —</option>
                  {/* Extract unique courses from sessions array or another source if available. Since TeacherAttendance doesn't save the full course list in state directly, we can derive it from the sessions list for now since courses must have at least one session to be visible here usually, or better, we can map over a pure courses list if we saved it in fetchData. But we didn't save it. For simplicity, we extract unique courses from the existing sessions. */}
                  {Array.from(new Map(sessions.map(s => [s.course_id, s.courseName])).entries()).map(([cid, cname]) => (
                    <option key={cid} value={cid}>{cname}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={newSession.date}
                    onChange={e => setNewSession({ ...newSession, date: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Room (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lab 2"
                    value={newSession.room}
                    onChange={e => setNewSession({ ...newSession, room: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Start Time</label>
                  <input
                    type="time"
                    value={newSession.startTime}
                    onChange={e => setNewSession({ ...newSession, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">End Time</label>
                  <input
                    type="time"
                    value={newSession.endTime}
                    onChange={e => setNewSession({ ...newSession, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border border-border hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={creatingSession || !newSession.courseId}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creatingSession ? "Creating..." : "Create Session"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherAttendance;
