import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const StudentAttendance = () => {
  const [month] = useState(1); // Feb 2026 (0-indexed)
  const year = 2026;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await api.get("/attendance/my-records");
        setRecords(res.data);
      } catch (err) {
        console.error("Failed to fetch attendance records", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const getStatus = (day: number) => {
    // Assuming records from backend are objects with a timestamp
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = records.find((r) => r.timestamp.startsWith(dateStr));
    return record ? "present" : null;
    // If backend doesn't explicitly track "absent" per day, we assume lack of record = not present.
    // However, the calendar shouldn't mark past days as "absent" unconditionally if there was no class.
    // For now, let's keep it simple: present if recorded.
  };

  const statusColor: Record<string, string> = {
    present: "bg-success text-success-foreground",
    absent: "bg-destructive text-destructive-foreground",
    scheduled: "bg-secondary text-muted-foreground",
  };

  const present = records.length;
  // Without a schedule to compare against, 'absent' is hard to calculate accurately.
  // We will default to 0 for now unless the API provides total sessions.
  const absent = 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-foreground">February 2026</h3>
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
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
                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all ${status ? statusColor[status] : "text-muted-foreground"
                  }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-6 justify-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-success" /> Present
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-destructive" /> Absent
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded bg-secondary" /> Scheduled
          </div>
        </div>
      </div>

      {/* Stats */}
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
          <p className="text-2xl font-bold text-primary">{Math.round((present / (present + absent)) * 100)}%</p>
          <p className="text-xs text-muted-foreground">Rate</p>
        </div>
      </div>
    </div>
  );
};

export default StudentAttendance;
