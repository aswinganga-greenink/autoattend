import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const ParentAttendance = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Use current month/year for default view
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const childRes = await api.get("/users/me/child");
        setChild(childRes.data);

        const attRes = await api.get(`/attendance/student/${childRes.data.id}`);
        setRecords(attRes.data);
      } catch (err) {
        console.error("Failed to fetch child attendance", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getStatus = (day: number) => {
    const targetDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    // Find a record that falls on this day (ignoring time)
    const record = records.find(r => r.timestamp && r.timestamp.startsWith(targetDateStr));
    return record?.status?.toLowerCase();
  };

  const statusColor: Record<string, string> = {
    present: "bg-success text-success-foreground",
    absent: "bg-destructive text-destructive-foreground",
    late: "bg-warning text-warning-foreground",
    excused: "bg-secondary text-muted-foreground",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-foreground">
            {child?.full_name || "Child"} — {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const status = getStatus(day);
            return (
              <div key={day} className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium ${status && statusColor[status] ? statusColor[status] : "text-muted-foreground"}`}>
                {day}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 mt-8 justify-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-3 h-3 rounded bg-success" /> Present</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-3 h-3 rounded bg-warning" /> Late</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-3 h-3 rounded bg-destructive" /> Absent</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-3 h-3 rounded bg-secondary" /> Excused</div>
        </div>
      </div>
    </div>
  );
};

export default ParentAttendance;
