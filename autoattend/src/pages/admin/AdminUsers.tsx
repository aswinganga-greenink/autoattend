import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserPlus } from "lucide-react";

const AdminUsers = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newUser, setNewUser] = useState({
        email: "",
        password: "",
        full_name: "",
        role: "teacher",
        parent_name: "",
        parent_email: "",
        parent_relation: "Parent"
    });

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
            const studentRes = await api.post("/users/", {
                email: newUser.email,
                password: newUser.password,
                full_name: newUser.full_name,
                role: newUser.role
            });

            // Automatically create parent account if requested
            if (newUser.role === "student" && newUser.parent_email && newUser.parent_name) {
                await api.post("/users/", {
                    email: newUser.parent_email,
                    password: newUser.password, // System shares the same initial password
                    full_name: newUser.parent_name,
                    role: "parent",
                    parent_of_student_id: studentRes.data.id
                });
            }

            setShowAdd(false);
            setNewUser({ email: "", password: "", full_name: "", role: "teacher", parent_name: "", parent_email: "", parent_relation: "Parent" });
            fetchUsers();
        } catch (err) {
            console.error(err);
            alert("Failed to create user. Check console for details.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Manage Users</h2>
                <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 gradient-gold text-primary-foreground rounded-xl flex items-center gap-2 text-sm font-medium">
                    <UserPlus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            {showAdd && (
                <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4 text-foreground">Create New User</h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input required type="text" placeholder="Full Name" className="p-2.5 rounded-xl bg-secondary/50 border border-border text-sm" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                        <input required type="email" placeholder="Email Address" className="p-2.5 rounded-xl bg-secondary/50 border border-border text-sm" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                        <input required type="password" placeholder="Password" className="p-2.5 rounded-xl bg-secondary/50 border border-border text-sm" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                        <select className="p-2.5 rounded-xl bg-secondary/50 border border-border text-sm" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                        <div className="md:col-span-2"></div>

                        {newUser.role === 'student' && (
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-primary/20 bg-primary/5 rounded-xl mt-2">
                                <h4 className="md:col-span-3 text-sm font-semibold text-primary">Auto-Generate Parent Account</h4>
                                <input required type="text" placeholder="Parent Full Name" className="p-2.5 rounded-xl bg-background border border-border text-sm" value={newUser.parent_name} onChange={e => setNewUser({ ...newUser, parent_name: e.target.value })} />
                                <input required type="email" placeholder="Parent Email Address" className="p-2.5 rounded-xl bg-background border border-border text-sm" value={newUser.parent_email} onChange={e => setNewUser({ ...newUser, parent_email: e.target.value })} />
                                <input required type="text" placeholder="Relation (e.g. Mother, Father)" className="p-2.5 rounded-xl bg-background border border-border text-sm" value={newUser.parent_relation} onChange={e => setNewUser({ ...newUser, parent_relation: e.target.value })} />
                                <p className="md:col-span-3 text-xs text-muted-foreground">The generated parent account will share the student's initial password.</p>
                            </div>
                        )}

                        <button type="submit" className="md:col-span-2 mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
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
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b border-border/50">
                                <td className="px-5 py-3 text-sm font-medium">{u.full_name}</td>
                                <td className="px-5 py-3 text-sm text-muted-foreground">{u.email}</td>
                                <td className="px-5 py-3 text-sm capitalize">{u.role}</td>
                                <td className="px-5 py-3 text-sm">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                        {u.is_active ? "Active" : "Inactive"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No users found</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;
