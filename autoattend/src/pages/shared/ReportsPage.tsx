import { Download, FileBarChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

const ReportsPage = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Teacher/Admin reports will be handled differently later, filtering by user role
        // For now this replaces the student specific mock data using their /me endpoint
        const res = await api.get("/attendance/stats/me");
        setStats(res.data);
      } catch (e) {
        console.error("Failed to fetch reports stats", e);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button className="px-4 py-2.5 gradient-gold text-primary-foreground text-sm font-medium rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" />
          Download CSV
        </button>
        <button className="px-4 py-2.5 bg-secondary border border-border text-foreground text-sm font-medium rounded-xl flex items-center gap-2 hover:bg-secondary/80 transition-colors">
          <FileBarChart className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Monthly Attendance</h3>
          <ResponsiveContainer width="100%" height={250}>
            {stats?.monthly ? (
              <LineChart data={stats.monthly}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} domain={[70, 100]} />
                <Tooltip contentStyle={{ background: "hsl(217, 33%, 17%)", border: "1px solid hsl(217, 33%, 22%)", borderRadius: "12px", color: "hsl(210, 40%, 98%)" }} />
                <Line type="monotone" dataKey="attendance" stroke="hsl(43, 96%, 56%)" strokeWidth={2} dot={{ fill: "hsl(43, 96%, 56%)", r: 4 }} />
              </LineChart>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground border-dashed border-border border rounded-xl">
                No timeline data available
              </div>
            )}
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Subject-wise Breakdown</h3>
          <div className="space-y-3">
            {stats?.subjects?.map((s: any) => (
              <div key={s.subject} className="flex items-center justify-between">
                <span className="text-sm text-foreground w-40">{s.subject}</span>
                <div className="flex-1 mx-4 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.percentage}%`, background: s.percentage >= 85 ? "hsl(var(--success))" : s.percentage >= 75 ? "hsl(var(--primary))" : "hsl(var(--destructive))" }} />
                </div>
                <span className="text-sm font-medium text-muted-foreground w-12 text-right">{s.percentage}%</span>
              </div>
            ))}
            {(!stats?.subjects || stats.subjects.length === 0) && (
              <div className="text-sm text-muted-foreground text-center py-8 opacity-50">
                No subjects data found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
