import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const StudentAttendance = () => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const [recRes, statsRes] = await Promise.all([
          api.get("/attendance/my"),
          api.get("/attendance/stats"),
        ]);
        setRecords(recRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error("Failed to fetch attendance records", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const getStatus = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = records.find((r) => r.timestamp?.startsWith(dateStr));
    return record ? record.status?.toLowerCase() : null;
  };

  const statusColor: Record<string, string> = {
    present: "bg-success text-success-foreground",
    absent: "bg-destructive text-destructive-foreground",
    late: "bg-warning text-warning-foreground",
    excused: "bg-secondary text-muted-foreground",
  };

  const present = stats?.overall?.present ?? records.filter(r => r.status?.toLowerCase() === "present").length;
  const total = stats?.overall?.total ?? records.length;
  const absent = total - present;
  const pct = stats?.overall?.percentage ?? (total > 0 ? Math.round((present / total) * 100) : 0);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-foreground">
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const status = getStatus(day);
            return (
              <div
                key={day}
                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all ${status && statusColor[status] ? statusColor[status] : "text-muted-foreground"
                  }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-6 justify-center flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-success" /> Present
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-destructive" /> Absent
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-warning" /> Late
          </div>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="text-center text-muted-foreground text-sm py-4">Loading stats...</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-success">{present}</p>
            <p className="text-xs text-muted-foreground">Present</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{absent}</p>
            <p className="text-xs text-muted-foreground">Absent</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-primary">{pct}%</p>
            <p className="text-xs text-muted-foreground">Rate</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAttendance;
