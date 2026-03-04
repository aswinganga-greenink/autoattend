import { Users, UserCheck, UserX, Activity, MapPin, Clock, Cpu } from "lucide-react";
import StatCard from "@/components/StatCard";
import CircularProgress from "@/components/CircularProgress";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const TeacherOverview = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, pct: 0 });
  const [recentRecognitions, setRecentRecognitions] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Get Teacher's Courses and Classes
      const coursesRes = await api.get("/courses/teacher/my-courses");
      const courses = coursesRes.data;
      setMyCourses(courses);

      const classesRes = await api.get("/classes/");
      setAllClasses(classesRes.data);

      // 2. Aggregate students from these courses
      const allStudents = new Set();
      for (const course of courses) {
        const studentsRes = await api.get(`/courses/${course.id}/students`);
        studentsRes.data.forEach((s: any) => allStudents.add(s.id));
      }

      const totalStudents = allStudents.size;

      // We don't have a cross-course attendance aggregate yet, so we'll mock the 'Present Today'
      // based on the total for visual purposes until the API provides daily teacher stats.
      const simulatedPresent = Math.floor(totalStudents * 0.85); // 85% roughly
      const simulatedAbsent = totalStudents - simulatedPresent;
      const pct = totalStudents > 0 ? Math.round((simulatedPresent / totalStudents) * 100) : 0;

      setStats({
        total: totalStudents,
        present: simulatedPresent,
        absent: simulatedAbsent,
        pct
      });

      // Simple mock for chart since we lack historical endpoints
      setMonthlyData([
        { month: "Sep", attendance: 92 },
        { month: "Oct", attendance: 88 },
        { month: "Nov", attendance: 90 },
        { month: "Dec", attendance: 85 },
        { month: "Jan", attendance: 91 },
        { month: "Feb", pct },
      ]);

      // Simple mock for live feed
      setRecentRecognitions([
        { studentName: "System Active", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), location: "AI Engine" }
      ]);
    } catch (e) {
      console.error("Failed to fetch teacher dashboard data:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Profile */}
        <div className="glass-card p-5 glow-gold">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-primary-foreground font-bold">
              {user?.full_name ? user.full_name.split(" ").map((n: string) => n[0]).join("") : "T"}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">{user?.full_name}</h3>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs bg-success/10 text-success px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
            Online
          </span>
        </div>

        <StatCard label="Total Students" value={stats.total} icon={<Users className="w-4 h-4 text-primary" />} variant="default" />
        <StatCard label="Present Today" value={stats.present} icon={<UserCheck className="w-4 h-4 text-success" />} trend={`+${stats.present} since morning`} variant="success" />
        <StatCard label="Absent Today" value={stats.absent} icon={<UserX className="w-4 h-4 text-destructive" />} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Monthly Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} domain={[70, 100]} />
              <Tooltip
                contentStyle={{
                  background: "hsl(217, 33%, 17%)",
                  border: "1px solid hsl(217, 33%, 22%)",
                  borderRadius: "12px",
                  color: "hsl(210, 40%, 98%)",
                }}
              />
              <Bar dataKey="attendance" fill="hsl(43, 96%, 56%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Circular */}
        <div className="glass-card p-6 flex flex-col items-center justify-center">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Today's Rate</h3>
          <CircularProgress percentage={stats.pct} label="Attendance" />
        </div>
      </div>

      {/* My Assigned Courses */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> My Assigned Courses
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myCourses.map((course) => {
            const classGroup = allClasses.find((c) => c.id === course.class_group_id);
            return (
              <div key={course.id} className="bg-secondary/30 rounded-xl p-4 border border-border">
                <h4 className="font-semibold text-foreground">{course.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {course.description || "No description provided."}
                </p>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="font-medium text-primary">
                    {classGroup ? `Class: ${classGroup.name}` : "Standalone Course"}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {course.schedule_info || "TBA"}
                  </span>
                </div>
              </div>
            );
          })}
          {myCourses.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
              You haven't been assigned to any courses yet.
            </div>
          )}
        </div>
      </div>

      {/* Live Recognition */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-sm">Live Recognition Feed</h3>
          <span className="inline-flex items-center gap-1.5 text-xs bg-success/10 text-success px-2.5 py-1 rounded-full">
            <Cpu className="w-3 h-3" />
            AI Units Active
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recentRecognitions.map((rec, i) => (
            <div key={i} className="bg-secondary/50 rounded-xl p-4 border border-border/50">
              <p className="font-medium text-foreground text-sm">{rec.studentName}</p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {rec.time}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {rec.location}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherOverview;
