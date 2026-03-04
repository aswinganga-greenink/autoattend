import { useState, useEffect } from "react";
import { Search, Download, Filter } from "lucide-react";
import { api } from "@/lib/api";

const TeacherAttendance = () => {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<{ id: string, name: string }[]>([]);
  const [classFilter, setClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch courses
      const coursesRes = await api.get("/courses/teacher/my-courses");
      const fetchedCourses = coursesRes.data;
      console.log("Teacher courses:", fetchedCourses);
      setClasses(fetchedCourses.map((c: any) => ({ id: c.id, name: c.name })));

      // 2. Fetch students and their recent attendance per course
      let allData: any[] = [];

      for (const c of fetchedCourses) {
        // Get roster
        const rosterRes = await api.get(`/courses/${c.id}/students`);
        const roster = rosterRes.data;
        console.log(`Roster for course ${c.name}:`, roster);

        // Get attendance logs for this course to calculate a rough status
        const logsRes = await api.get(`/attendance/course/${c.id}`);
        const logs = logsRes.data;
        console.log(`Logs for course ${c.name}:`, logs);

        roster.forEach((st: any) => {
          // Find the most recent log for this student
          const studentLogs = logs.filter((l: any) => l.student_id === st.id)
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          const recentLog = studentLogs.length > 0 ? studentLogs[0] : null;
          let status = "absent";
          let lastSeen = "Never";

          if (recentLog) {
            status = recentLog.status.toLowerCase();
            lastSeen = new Date(recentLog.timestamp).toLocaleString();
          }

          allData.push({
            id: st.id,
            name: st.full_name,
            registerNumber: `STU-${st.id.substring(0, 4).toUpperCase()}`,
            className: c.name,
            courseId: c.id,
            status: status,
            lastSeen: lastSeen
          });
        });
      }

      console.log("Final allData array:", allData);
      setStudents(allData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.registerNumber.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === "all" || s.courseId === classFilter;
    return matchSearch && matchClass;
  });

  const toggleStatus = async (id: string, currentStatus: string, courseId: string) => {
    // In a real scenario, this would POST to /api/v1/attendance/mark
    // For now we just update UI optimizations since we'd need a specific session_id to mark
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: s.status === "present" ? "absent" : "present" } : s))
    );
  };

  return (
    <div className="space-y-6">
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
        <div className="flex gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="px-4 py-2.5 gradient-gold text-primary-foreground text-sm font-medium rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Student Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Register No.</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Class</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{student.name}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{student.registerNumber}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{student.className}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleStatus(student.id, student.status, student.courseId)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${student.status === "present"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                        }`}
                    >
                      {student.status === "present" ? "Present" : "Absent"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{student.lastSeen}</td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No students found.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Loading attendance records...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendance;
