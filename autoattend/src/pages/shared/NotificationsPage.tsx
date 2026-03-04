import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { Bell, AlertTriangle, CheckCircle, Info } from "lucide-react";

const iconMap = {
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  success: <CheckCircle className="w-4 h-4 text-success" />,
  info: <Info className="w-4 h-4 text-primary" />,
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // In the future this should fetch from an actual endpoint
    // For now, since there isn't a robust notifications backend provided,
    // we'll leave it empty to definitively strip out the dummy data.
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/notifications/me");
        setNotifications(res.data);
      } catch (e) {
        console.error("Failed to fetch notifications", e);
      }
    };
    // fetchNotifications(); // Disabled until backend implements it
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {notifications.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground border-dashed">
          No new notifications.
        </div>
      )}
      {notifications.map((n) => (
        <div key={n.id} className={`glass-card p-4 flex items-start gap-3 ${!n.read ? "border-primary/30" : ""}`}>
          <div className="p-2 rounded-lg bg-secondary/50">{iconMap[n.type]}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">{n.title}</h4>
              {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
            <p className="text-xs text-muted-foreground/50 mt-1">{n.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationsPage;
