import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { api } from "@/lib/api";

const TeacherStudents = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const coursesRes = await api.get("/courses/teacher/my-courses");
      const seen = new Set<string>();
      const allStuds: any[] = [];

      for (const course of coursesRes.data) {
        // Get roster for this course
        const studRes = await api.get(`/courses/${course.id}/students`);
        // Get attendance stats for each student in this course in parallel
        const enriched = await Promise.all(
          studRes.data.map(async (st: any) => {
            if (seen.has(st.id)) return null;
            seen.add(st.id);

            // Fetch this student's attendance stats (accessible for teachers via student/{id}/stats)
            let attendancePct = null;
            try {
              const statsRes = await api.get(`/attendance/student/${st.id}/stats`);
              attendancePct = statsRes.data?.overall?.percentage ?? null;
            } catch {
              // Student may have no records yet
            }

            return {
              ...st,
              className: course.name,
              registerNumber: `STU-${st.id.substring(0, 4).toUpperCase()}`,
              attendance: attendancePct,
            };
          })
        );

        enriched.filter(Boolean).forEach(s => allStuds.push(s));
      }

      setStudents(allStuds);
    } catch (e) {
      console.error("Failed to load students", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading roster...</div>;

  return (
    <div className="space-y-6">
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Register No.</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Course</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Overall Attendance</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No students enrolled in your courses yet.</td>
                </tr>
              )}
              {students.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{s.full_name || s.name}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{s.registerNumber}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{s.className}</td>
                  <td className="px-5 py-3">
                    {s.attendance === null ? (
                      <span className="text-xs text-muted-foreground italic">No records</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s.attendance}%`,
                              background: s.attendance >= 75 ? "hsl(var(--success))" : "hsl(var(--destructive))",
                            }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${s.attendance >= 75 ? "text-success" : "text-destructive"}`}>
                          {s.attendance}%
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherStudents;
