import { Users, BookOpen, Activity } from "lucide-react";
import StatCard from "@/components/StatCard";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const AdminOverview = () => {
    const [stats, setStats] = useState({ total_users: 0, total_courses: 0, total_sessions: 0, system_status: "Loading..." });

    useEffect(() => {
        api.get("/users/admin/stats").then(res => setStats(res.data)).catch(console.error);
    }, []);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Admin Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={stats.total_users} icon={<Users className="w-4 h-4 text-primary" />} variant="default" />
                <StatCard label="Total Courses" value={stats.total_courses} icon={<BookOpen className="w-4 h-4 text-success" />} variant="success" />
                <StatCard label="Total Sessions" value={stats.total_sessions} icon={<BookOpen className="w-4 h-4 text-primary" />} variant="default" />
                <StatCard label="System Status" value={stats.system_status} icon={<Activity className="w-4 h-4 text-warning" />} variant="warning" />
            </div>
        </div>
    );
};

export default AdminOverview;
