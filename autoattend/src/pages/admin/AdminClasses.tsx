import { useState, useEffect } from "react";
import { Plus, Users, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import ClassEnrollmentModal from "@/components/admin/ClassEnrollmentModal";

interface ClassGroup {
    id: string;
    name: string;
    description: string;
    enrollments?: any[];
    courses?: any[];
}

const AdminClasses = () => {
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newClassName, setNewClassName] = useState("");
    const [newClassDescription, setNewClassDescription] = useState("");
    const [enrollmentModalState, setEnrollmentModalState] = useState<{
        isOpen: boolean; classId: string; className: string;
    }>({ isOpen: false, classId: "", className: "" });

    const fetchClasses = async () => {
        try {
            const res = await api.get("/classes/");
            setClasses(res.data);
        } catch (err) {
            console.error("Failed to fetch classes", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClasses(); }, []);

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/classes/", { name: newClassName, description: newClassDescription });
            setIsCreateModalOpen(false);
            setNewClassName("");
            setNewClassDescription("");
            fetchClasses();
        } catch (err: any) {
            console.error("Failed to create class", err);
            alert("Failed to create: " + (err.response?.data?.detail || "Unknown error"));
        }
    };

    const handleDeleteClass = async (classId: string, className: string) => {
        if (!confirm(`Delete class "${className}"? This will remove all enrollments and course links.`)) return;
        try {
            await api.delete(`/classes/${classId}`);
            setClasses(prev => prev.filter(c => c.id !== classId));
        } catch (err: any) {
            alert("Failed to delete: " + (err.response?.data?.detail || "Unknown error"));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Manage Classes</h1>
                    <p className="text-sm text-muted-foreground mt-1">Create class groups and manage student enrollments</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 gradient-gold text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Class
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-secondary/30">
                                <th className="text-left py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Class Name</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Students</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courses</th>
                                <th className="text-right py-4 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading classes...</td></tr>
                            ) : classes.length === 0 ? (
                                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No classes found</td></tr>
                            ) : (
                                classes.map((cls) => (
                                    <tr key={cls.id} className="hover:bg-secondary/20 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {cls.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-foreground">{cls.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-muted-foreground">{cls.description || "No description"}</td>
                                        <td className="py-4 px-6 text-sm text-muted-foreground">{cls.enrollments?.length ?? 0}</td>
                                        <td className="py-4 px-6 text-sm text-muted-foreground">{cls.courses?.length ?? 0}</td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    className="px-3 py-1.5 bg-secondary text-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
                                                    onClick={() => setEnrollmentModalState({ isOpen: true, classId: cls.id, className: cls.name })}
                                                >
                                                    <Users className="w-3.5 h-3.5" />
                                                    Manage Students
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                                                    title="Delete class"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Class Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="font-semibold text-foreground">Create New Class</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                        </div>
                        <form onSubmit={handleCreateClass} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Class Name</label>
                                <input
                                    type="text" required value={newClassName}
                                    onChange={e => setNewClassName(e.target.value)}
                                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="e.g. 10A, CS-2026"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Description (Optional)</label>
                                <textarea
                                    value={newClassDescription}
                                    onChange={e => setNewClassDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Senior year computer science batch..."
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button" onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 py-2 bg-secondary text-foreground text-sm font-medium rounded-xl hover:bg-secondary/80 transition-colors"
                                >Cancel</button>
                                <button
                                    type="submit" disabled={!newClassName}
                                    className="flex-1 py-2 gradient-gold text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >Create Class</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Enrollments Modal */}
            <ClassEnrollmentModal
                isOpen={enrollmentModalState.isOpen}
                onClose={() => setEnrollmentModalState(prev => ({ ...prev, isOpen: false }))}
                classGroupId={enrollmentModalState.classId}
                classGroupName={enrollmentModalState.className}
            />
        </div>
    );
};

export default AdminClasses;
