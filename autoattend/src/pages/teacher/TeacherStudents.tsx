import { useState, useEffect } from "react";
import { Trash2, Edit, Eye } from "lucide-react";
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
      const allStuds: any[] = [];
      const seen = new Set();

      for (const course of coursesRes.data) {
        const studRes = await api.get(`/courses/${course.id}/students`);
        studRes.data.forEach((st: any) => {
          if (!seen.has(st.id)) {
            seen.add(st.id);
            allStuds.push({
              ...st,
              // Hardcode mock data for class/attendance since we don't have this in student model yet
              className: course.name,
              registerNumber: `STU-${st.id.substring(0, 4).toUpperCase()}`,
              attendance: Math.floor(Math.random() * 30) + 70 // random 70-100%
            });
          }
        });
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
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Class</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Attendance</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No students enrolled in your courses yet.</td>
                </tr>
              )}
              {students.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{s.full_name || s.name}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{s.registerNumber}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{s.className}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${s.attendance}%`,
                            background: s.attendance >= 75 ? "hsl(var(--success))" : "hsl(var(--destructive))",
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{s.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
