import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BookOpen, Trash2, Plus, X } from "lucide-react";

const AdminCourses = () => {
    const [courses, setCourses] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newCourse, setNewCourse] = useState({
        name: "",
        description: "",
        class_group_id: "",
        schedule_info: "",
        teacher_id: "",
    });
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        const [coursesRes, classesRes, teachersRes] = await Promise.all([
            api.get("/courses/").catch(() => ({ data: [] })),
            api.get("/classes/").catch(() => ({ data: [] })),
            api.get("/users/teachers").catch(() => ({ data: [] })),
        ]);
        setCourses(coursesRes.data);
        setClasses(classesRes.data);
        setTeachers(teachersRes.data);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = { ...newCourse };
            if (!payload.class_group_id) payload.class_group_id = null;
            if (!payload.schedule_info) payload.schedule_info = null;
            if (!payload.teacher_id) delete payload.teacher_id;

            await api.post("/courses/", payload);
            setShowAdd(false);
            setNewCourse({ name: "", description: "", class_group_id: "", schedule_info: "", teacher_id: "" });
            fetchAll();
        } catch (err: any) {
            console.error(err);
            alert("Failed to create course: " + (err.response?.data?.detail || "Check console."));
        }
    };

    const handleDelete = async (courseId: string) => {
        if (!confirm("Delete this course? This will also remove all its sessions and attendance records.")) return;
        setDeleting(courseId);
        try {
            await api.delete(`/courses/${courseId}`);
            setCourses(prev => prev.filter(c => c.id !== courseId));
        } catch (err: any) {
            alert("Failed to delete: " + (err.response?.data?.detail || "Unknown error"));
        } finally {
            setDeleting(null);
        }
    };

    const inputCls = "w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Manage Courses</h2>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="px-4 py-2 gradient-gold text-primary-foreground rounded-xl flex items-center gap-2 text-sm font-medium"
                >
                    {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAdd ? "Cancel" : "Create Course"}
                </button>
            </div>

            {showAdd && (
                <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4 text-foreground">Create New Course</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                required
                                type="text"
                                placeholder="Course Name"
                                className={inputCls}
                                value={newCourse.name}
                                onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Schedule (e.g. Mon, Wed 10AM–11AM)"
                                className={inputCls}
                                value={newCourse.schedule_info}
                                onChange={e => setNewCourse({ ...newCourse, schedule_info: e.target.value })}
                            />
                            <select
                                className={inputCls}
                                value={newCourse.class_group_id}
                                onChange={e => setNewCourse({ ...newCourse, class_group_id: e.target.value })}
                            >
                                <option value="">No Class (Standalone)</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                            <select
                                className={inputCls}
                                value={newCourse.teacher_id}
                                onChange={e => setNewCourse({ ...newCourse, teacher_id: e.target.value })}
                            >
                                <option value="">Assign Teacher (Optional)</option>
                                {teachers.map(t => (
                                    <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            placeholder="Course Description (Optional)"
                            className={inputCls}
                            value={newCourse.description}
                            onChange={e => setNewCourse({ ...newCourse, description: e.target.value })}
                            rows={2}
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                        >
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
                            <th className="px-5 py-3">Teacher</th>
                            <th className="px-5 py-3">Schedule</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map(c => {
                            const teacher = teachers.find(t => t.id === c.teacher_id);
                            const cls = classes.find(cl => cl.id === c.class_group_id);
                            return (
                                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                                    <td className="px-5 py-3 text-sm font-medium text-foreground">{c.name}</td>
                                    <td className="px-5 py-3 text-sm text-muted-foreground">
                                        {cls?.name || <span className="text-xs italic opacity-50">Unassigned</span>}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-muted-foreground">
                                        {teacher?.full_name || <span className="text-xs italic opacity-50">Unassigned</span>}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-muted-foreground">{c.schedule_info || "—"}</td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            disabled={deleting === c.id}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {courses.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">No courses found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCourses;
