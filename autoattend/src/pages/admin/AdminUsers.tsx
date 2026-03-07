import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserPlus, UserX, X, Pencil, Check } from "lucide-react";

const AdminUsers = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        full_name: "",
        role: "student",
        student_id_number: "",
        parent_name: "",
        parent_email: "",
    });
    const [deactivating, setDeactivating] = useState<string | null>(null);
    // Inline edit state for student_id_number
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editStudentIdValue, setEditStudentIdValue] = useState("");
    const [savingStudentId, setSavingStudentId] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = () => {
        api.get("/users/").then((res) => setUsers(res.data)).catch(console.error);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Create the main user
            const userRes = await api.post("/users/", {
                email: newUser.email,
                password: newUser.password,
                full_name: newUser.full_name,
                role: newUser.role,
                ...(newUser.role === "student" && newUser.student_id_number && { student_id_number: newUser.student_id_number.trim() }),
            });

            // Auto-create linked parent if role is STUDENT and parent info is provided
            if (newUser.role === "student" && newUser.parent_email && newUser.parent_name) {
                await api.post("/users/", {
                    email: newUser.parent_email,
                    password: newUser.password,
                    full_name: newUser.parent_name,
                    role: "parent",
                    parent_of_student_id: userRes.data.id,
                });
            }

            setShowAdd(false);
            setNewUser({ email: "", password: "", full_name: "", role: "student", student_id_number: "", parent_name: "", parent_email: "" });
            fetchUsers();
        } catch (err: any) {
            console.error(err);
            alert("Failed to create user: " + (err.response?.data?.detail || "Check console."));
        }
    };

    const handleDeactivate = async (userId: string, isActive: boolean) => {
        const action = isActive ? "deactivate" : "re-activate";
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        setDeactivating(userId);
        try {
            if (isActive) {
                await api.delete(`/users/${userId}`);
            } else {
                await api.put(`/users/${userId}`, { is_active: true });
            }
            fetchUsers();
        } catch (err: any) {
            alert("Failed: " + (err.response?.data?.detail || "Unknown error"));
        } finally {
            setDeactivating(null);
        }
    };

    const startEditStudentId = (u: any) => {
        setEditingStudentId(u.id);
        setEditStudentIdValue(u.student_id_number || "");
    };

    const saveStudentId = async (userId: string, hasExisting: boolean) => {
        if (!editStudentIdValue.trim()) return;
        setSavingStudentId(true);
        try {
            if (hasExisting) {
                // Profile already exists — patch it
                await api.patch(`/profiles/student/${userId}`, {
                    student_id_number: editStudentIdValue.trim(),
                });
            } else {
                // No profile yet — create it
                await api.post("/profiles/student", {
                    user_id: userId,
                    student_id_number: editStudentIdValue.trim(),
                });
            }
            setEditingStudentId(null);
            fetchUsers();
        } catch (err: any) {
            alert("Failed to set student ID: " + (err.response?.data?.detail || "Unknown error"));
        } finally {
            setSavingStudentId(false);
        }
    };

    const inputCls = "p-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Manage Users</h2>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="px-4 py-2 gradient-gold text-primary-foreground rounded-xl flex items-center gap-2 text-sm font-medium"
                >
                    {showAdd ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showAdd ? "Cancel" : "Add User"}
                </button>
            </div>

            {showAdd && (
                <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4 text-foreground">Create New User</h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input required type="text" placeholder="Full Name" className={inputCls} value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                        <input required type="email" placeholder="Email Address" className={inputCls} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                        <input required type="password" placeholder="Password" className={inputCls} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                        <select className={inputCls} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>

                        {newUser.role === "student" && (
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-primary/20 bg-primary/5 rounded-xl">
                                <h4 className="md:col-span-2 text-sm font-semibold text-primary">Student Profile</h4>
                                <input
                                    required
                                    type="text"
                                    placeholder="Student ID Number (e.g. CS2024001)"
                                    className={inputCls}
                                    value={newUser.student_id_number}
                                    onChange={e => setNewUser({ ...newUser, student_id_number: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground flex items-center">This ID is used for face recognition matching.</p>
                                <h4 className="md:col-span-2 text-sm font-semibold text-primary pt-2 border-t border-border/50">Auto-Generate Parent Account (Optional)</h4>
                                <input type="text" placeholder="Parent Full Name" className={inputCls} value={newUser.parent_name} onChange={e => setNewUser({ ...newUser, parent_name: e.target.value })} />
                                <input type="email" placeholder="Parent Email Address" className={inputCls} value={newUser.parent_email} onChange={e => setNewUser({ ...newUser, parent_email: e.target.value })} />
                                <p className="md:col-span-2 text-xs text-muted-foreground">Parent account will share the student's initial password.</p>
                            </div>
                        )}

                        <button type="submit" className="md:col-span-2 mt-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                            Create User
                        </button>
                    </form>
                </div>
            )}

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="border-b border-border text-xs text-muted-foreground uppercase">
                        <tr>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">Email</th>
                            <th className="px-5 py-3">Role</th>
                            <th className="px-5 py-3">Student ID</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                                <td className="px-5 py-3 text-sm font-medium text-foreground">{u.full_name}</td>
                                <td className="px-5 py-3 text-sm text-muted-foreground">{u.email}</td>
                                <td className="px-5 py-3 text-sm capitalize">{u.role?.toLowerCase()}</td>
                                <td className="px-5 py-3 text-sm">
                                    {u.role?.toLowerCase() === "student" ? (
                                        editingStudentId === u.id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    autoFocus
                                                    className="w-28 px-2 py-1 rounded-lg bg-secondary border border-primary/40 text-xs text-foreground focus:outline-none"
                                                    value={editStudentIdValue}
                                                    onChange={e => setEditStudentIdValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === "Enter") saveStudentId(u.id, !!u.student_id_number); if (e.key === "Escape") setEditingStudentId(null); }}
                                                />
                                                <button
                                                    onClick={() => saveStudentId(u.id, !!u.student_id_number)}
                                                    disabled={savingStudentId}
                                                    className="p-1 rounded text-success hover:bg-success/10"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setEditingStudentId(null)} className="p-1 rounded text-muted-foreground hover:bg-secondary">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEditStudentId(u)}
                                                className="flex items-center gap-1.5 group text-left"
                                                title="Click to set Student ID"
                                            >
                                                <span className={u.student_id_number ? "text-foreground font-mono text-xs" : "text-muted-foreground italic text-xs"}>
                                                    {u.student_id_number || "Not set"}
                                                </span>
                                                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        )
                                    ) : (
                                        <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-sm">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                        {u.is_active ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button
                                        onClick={() => handleDeactivate(u.id, u.is_active)}
                                        disabled={deactivating === u.id}
                                        title={u.is_active ? "Deactivate user" : "Re-activate user"}
                                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${u.is_active
                                            ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            : "text-muted-foreground hover:text-success hover:bg-success/10"}`}
                                    >
                                        <UserX className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;
