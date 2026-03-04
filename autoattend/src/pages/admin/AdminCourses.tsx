import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BookOpen } from "lucide-react";

const AdminCourses = () => {
    const [courses, setCourses] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newCourse, setNewCourse] = useState({ name: "", description: "", class_group_id: "", schedule_info: "" });

    useEffect(() => {
        fetchCourses();
        fetchClasses();
    }, []);

    const fetchClasses = () => {
        api.get("/classes/").then((res) => setClasses(res.data)).catch(console.error);
    };

    const fetchCourses = () => {
        api.get("/courses/").then((res) => setCourses(res.data)).catch(console.error);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = { ...newCourse };
            // Send null if empty string
            if (!payload.class_group_id) payload.class_group_id = null;
            if (!payload.schedule_info) payload.schedule_info = null;

            await api.post("/courses/", payload);
            setShowAdd(false);
            setNewCourse({ name: "", description: "", class_group_id: "", schedule_info: "" });
            fetchCourses();
        } catch (err) {
            console.error(err);
            alert("Failed to create course. Check console for details.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Manage Courses</h2>
                <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 gradient-gold text-primary-foreground rounded-xl flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="w-4 h-4" />
                    Create Course
                </button>
            </div>

            {showAdd && (
                <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4 text-foreground">Create New Course</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <input required type="text" placeholder="Course Name" className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm" value={newCourse.name} onChange={e => setNewCourse({ ...newCourse, name: e.target.value })} />
                        <textarea placeholder="Course Description (Optional)" className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm" value={newCourse.description} onChange={e => setNewCourse({ ...newCourse, description: e.target.value })} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                                className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm"
                                value={newCourse.class_group_id}
                                onChange={e => setNewCourse({ ...newCourse, class_group_id: e.target.value })}
                            >
                                <option value="">No Class (Standalone)</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>

                            <input
                                type="text"
                                placeholder="Schedule (e.g. Mon, Wed 10AM-11AM)"
                                className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm"
                                value={newCourse.schedule_info}
                                onChange={e => setNewCourse({ ...newCourse, schedule_info: e.target.value })}
                            />
                        </div>

                        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                            Create Course
                        </button>
                    </form>
                </div>
            )}

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="border-b border-border text-xs text-muted-foreground uppercase">
                        <tr>
                            <th className="px-5 py-3">Course Name</th>
                            <th className="px-5 py-3">Class Group</th>
                            <th className="px-5 py-3">Schedule</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map(c => (
                            <tr key={c.id} className="border-b border-border/50">
                                <td className="px-5 py-3 text-sm font-medium">{c.name}</td>
                                <td className="px-5 py-3 text-sm text-muted-foreground">
                                    {classes.find(cls => cls.id === c.class_group_id)?.name || <span className="text-xs italic text-muted-foreground/50">Unassigned</span>}
                                </td>
                                <td className="px-5 py-3 text-sm text-muted-foreground">{c.schedule_info || "-"}</td>
                            </tr>
                        ))}
                        {courses.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No courses found</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCourses;
