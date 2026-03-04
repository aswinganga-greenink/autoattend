import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserPlus, UserX, X } from "lucide-react";

const AdminUsers = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        full_name: "",
        role: "student",
        parent_name: "",
        parent_email: "",
    });
    const [deactivating, setDeactivating] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = () => {
        api.get("/users/").then((res) => setUsers(res.data)).catch(console.error);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Create the main user (role must be UPPERCASE to match backend enum)
            const studentRes = await api.post("/users/", {
                email: newUser.email,
                password: newUser.password,
                full_name: newUser.full_name,
                role: newUser.role,
            });

            // Auto-create linked parent if role is STUDENT and parent info is provided
            if (newUser.role === "student" && newUser.parent_email && newUser.parent_name) {
                await api.post("/users/", {
                    email: newUser.parent_email,
                    password: newUser.password,
                    full_name: newUser.parent_name,
                    role: "parent",
                    parent_of_student_id: studentRes.data.id,
                });
            }

            setShowAdd(false);
            setNewUser({ email: "", password: "", full_name: "", role: "STUDENT", parent_name: "", parent_email: "" });
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
                await api.delete(`/users/${userId}`); // soft delete → sets is_active=false
            } else {
                await api.put(`/users/${userId}`, { is_active: true }); // re-activate
            }
            fetchUsers();
        } catch (err: any) {
            alert("Failed: " + (err.response?.data?.detail || "Unknown error"));
        } finally {
            setDeactivating(null);
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
                                <h4 className="md:col-span-2 text-sm font-semibold text-primary">Auto-Generate Parent Account (Optional)</h4>
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
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                                <td className="px-5 py-3 text-sm font-medium text-foreground">{u.full_name}</td>
                                <td className="px-5 py-3 text-sm text-muted-foreground">{u.email}</td>
                                <td className="px-5 py-3 text-sm capitalize">{u.role.toLowerCase()}</td>
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
                            <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;
