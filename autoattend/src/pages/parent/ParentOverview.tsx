import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, Clock, Activity, Loader2 } from "lucide-react";
import CircularProgress from "@/components/CircularProgress";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";

const ParentOverview = () => {
  const [child, setChild] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const childRes = await api.get("/users/me/child");
        setChild(childRes.data);

        const statsRes = await api.get(`/attendance/student/${childRes.data.id}/stats`);
        setStats(statsRes.data);

        try {
          const classRes = await api.get("/classes/my");
          setClassGroups(classRes.data);
        } catch (e) {
          console.error("No class data", e);
        }

      } catch (err) {
        console.error("Failed to fetch parent data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!child || !stats) {
    return (
      <div className="p-6 text-center text-muted-foreground glass-card">
        No child profile found or data is currently unavailable.
      </div>
    );
  }

  const childAttendance = stats.overall?.percentage || 0;
  const isLow = childAttendance < 75;

  // Mock monthly data since the backend doesn't aggregate by month yet
  const monthlyAttendanceData = [
    { month: "Sep", attendance: 92 },
    { month: "Oct", attendance: 95 },
    { month: "Nov", attendance: childAttendance },
  ];

  return (
    <div className="space-y-6">
      {/* Child Profile */}
      <div className="glass-card p-6 glow-gold">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-lg font-bold">
            {child.full_name?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">{child.full_name}</h3>
            <div className="flex gap-2 items-center mt-1">
              <p className="text-sm text-muted-foreground">{child.email} • Student</p>
              {classGroups.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                  Class: {classGroups[0].name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLow && (
        <div className="glass-card p-4 border-warning/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-warning">Attendance Warning</p>
            <p className="text-xs text-muted-foreground">Your child's attendance is below 75%. Please take action.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col items-center justify-center">
          <CircularProgress percentage={childAttendance} size={160} label="Overall" />
        </div>

        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyAttendanceData}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(43, 96%, 56%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(217, 33%, 17%)", border: "1px solid hsl(217, 33%, 22%)", borderRadius: "12px", color: "hsl(210, 40%, 98%)" }} />
              <Area type="monotone" dataKey="attendance" stroke="hsl(43, 96%, 56%)" fill="url(#goldGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subject Stats */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-foreground mb-4 text-sm">Subject Breakdown</h3>
        <div className="space-y-3">
          {stats.subjects?.map((sub: any, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-secondary/30 rounded-xl gap-2">
              <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                <Activity className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                {sub.subject}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{sub.attended} / {sub.total} Classes</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${sub.percentage >= 75 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                  {sub.percentage}%
                </span>
              </div>
            </div>
          ))}
          {!stats.subjects?.length && (
            <p className="text-sm text-muted-foreground text-center">No class data available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentOverview;
