import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { format, parseISO, getDay } from "date-fns";
import { CalendarDays, List as ListIcon } from "lucide-react";

interface Session {
  id: string;
  course_id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  course?: { name: string; description: string | null; teacher_id: string | null };
}

interface TimetableRow {
  time: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
}

const TimetablePage = () => {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const [timetableData, setTimetableData] = useState<TimetableRow[]>([]);
  const [rawSessions, setRawSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    try {
      const res = await api.get<Session[]>("/timetable/");
      const sessions = res.data;

      // Save sorted raw sessions for list view
      const sortedRaw = [...sessions].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setRawSessions(sortedRaw);

      // Group sessions by time range: "HH:mm - HH:mm"
      const grouped: Record<string, TimetableRow> = {};

      const dayMap: Record<number, typeof days[number]> = {
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
      };

      sessions.forEach(session => {
        const start = parseISO(session.start_time);
        const end = parseISO(session.end_time);
        const timeKey = `${format(start, "hh:mm a")} - ${format(end, "hh:mm a")}`;
        const dayIdx = getDay(start); // 0=Sun, 1=Mon, ..., 6=Sat

        if (dayIdx >= 1 && dayIdx <= 5) {
          if (!grouped[timeKey]) {
            grouped[timeKey] = { time: timeKey };
          }
          const dayName = dayMap[dayIdx];
          grouped[timeKey][dayName] = session.course?.name || "Unknown Course";
        }
      });

      // Sort by start time of the timeKey (rough string sort is fine if 24h, but we used 12h)
      // For proper sorting, we should parse the first 8 chars. A simple way is sorting by the raw start_time of the first session with that timeKey
      const sortedRows = Object.values(grouped).sort((a, b) => {
        const aTime = parseISO(`1970-01-01T${a.time.split(" ")[0].padStart(5, '0')}Z`);
        const bTime = parseISO(`1970-01-01T${b.time.split(" ")[0].padStart(5, '0')}Z`);
        return aTime.getTime() - bTime.getTime();
      });

      setTimetableData(sortedRows);
    } catch (error) {
      console.error("Failed to fetch timetable:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          onClick={() => setViewMode("grid")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">Weekly Grid</span>
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
        >
          <ListIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Chronological List</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading timetable...</div>
        ) : viewMode === "grid" ? (
          timetableData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No classes scheduled for this semester.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Time</th>
                    {days.map((d) => (
                      <th key={d} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 capitalize">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableData.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-5 py-3 text-sm font-medium text-primary whitespace-nowrap">{row.time}</td>
                      {days.map((d) => (
                        <td key={d} className="px-5 py-3 text-sm text-foreground">{row[d] || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          rawSessions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No sessions scheduled yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Time</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Course</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {rawSessions.map((session) => (
                    <tr key={session.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-5 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                        {format(parseISO(session.start_time), "MMM d, yyyy (EEEE)")}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {format(parseISO(session.start_time), "hh:mm a")} - {format(parseISO(session.end_time), "hh:mm a")}
                      </td>
                      <td className="px-5 py-3 text-sm text-primary font-medium">
                        {session.course?.name || "Unknown"}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {session.room || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default TimetablePage;
