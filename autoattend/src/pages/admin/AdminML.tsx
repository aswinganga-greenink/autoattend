import { useState, useEffect } from "react";
import { ScanFace, Cpu, Users, RefreshCw, BookOpen, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

const AdminML = () => {
    const [status, setStatus] = useState<any>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [training, setTraining] = useState(false);
    const [trainResult, setTrainResult] = useState<any>(null);

    const [students, setStudents] = useState<any[]>([]);
    const [registering, setRegistering] = useState<string | null>(null);
    const [registerResult, setRegisterResult] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchStatus();
        fetchStudents();
    }, []);

    const fetchStatus = async () => {
        setLoadingStatus(true);
        try {
            const res = await api.get("/ml/status");
            setStatus(res.data);
        } catch (e) {
            console.error("Failed to fetch ML status", e);
        } finally {
            setLoadingStatus(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get("/users/students");
            setStudents(res.data);
        } catch (e) {
            console.error("Failed to fetch students", e);
        }
    };

    const handleTrain = async () => {
        setTraining(true);
        setTrainResult(null);
        try {
            const res = await api.post("/ml/train");
            setTrainResult({ success: true, ...res.data });
            fetchStatus();
        } catch (err: any) {
            setTrainResult({ success: false, error: err.response?.data?.detail || "Training failed" });
        } finally {
            setTraining(false);
        }
    };

    const handleRegister = async (userId: string) => {
        setRegistering(userId);
        setRegisterResult(prev => ({ ...prev, [userId]: null }));
        try {
            // Blocks until capture (180 photos) + model retrain are complete
            const res = await api.post(`/ml/register/${userId}`);
            setRegisterResult(prev => ({
                ...prev,
                [userId]: {
                    success: true,
                    images: res.data.images_captured,
                    total: res.data.total_registered_students,
                },
            }));
            fetchStatus();
        } catch (err: any) {
            setRegisterResult(prev => ({
                ...prev,
                [userId]: { success: false, error: err.response?.data?.detail || "Failed" },
            }));
        } finally {
            setRegistering(null);
        }
    };

    const modelAgeLabel = (seconds: number | null) => {
        if (seconds === null) return "—";
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">AI Attendance Module</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage face registration, model training, and recognition
                    </p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
                    title="Refresh status"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Model Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${status?.model_ready ? "bg-success animate-pulse" : "bg-destructive"}`} />
                        <p className="text-sm font-medium text-foreground">Model Status</p>
                    </div>
                    <p className={`text-2xl font-bold ${status?.model_ready ? "text-success" : "text-destructive"}`}>
                        {loadingStatus ? "…" : status?.model_ready ? "Ready" : "Not Trained"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Last trained: {loadingStatus ? "…" : modelAgeLabel(status?.model_age_seconds ?? null)}
                    </p>
                </div>
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Registered Students</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                        {loadingStatus ? "…" : status?.registered_students ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Face datasets in dataset/</p>
                </div>
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Total Students</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{students.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">In the system</p>
                </div>
            </div>

            {/* Train Model */}
            <div className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-primary" />
                            Train Recognition Model
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Reads all registered face images and (re)trains the LBPH model.
                            Run this after registering new students.
                        </p>
                    </div>
                    <button
                        onClick={handleTrain}
                        disabled={training || (status?.registered_students ?? 0) === 0}
                        className="px-4 py-2 gradient-gold text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2 shrink-0"
                    >
                        {training ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" />Training…</>
                        ) : (
                            <><Cpu className="w-4 h-4" />Train Now</>
                        )}
                    </button>
                </div>
                {trainResult && (
                    <div className={`p-3 rounded-xl text-sm ${trainResult.success
                        ? "bg-success/10 border border-success/20 text-success"
                        : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
                        {trainResult.success
                            ? `✓ Trained on ${trainResult.student_count} student(s)`
                            : `✗ ${trainResult.error}`}
                    </div>
                )}
            </div>

            {/* Register Students */}
            <div className="glass-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <ScanFace className="w-4 h-4 text-primary" />
                        Register Student Faces
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Click <strong>Register</strong> to launch the webcam capture on the server machine.
                        Follow the on-screen prompts (Straight → Left → Right angles).
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                                <th className="text-left px-6 py-3">Student</th>
                                <th className="text-left px-6 py-3">Email</th>
                                <th className="text-left px-6 py-3">Registered</th>
                                <th className="text-right px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No students found</td></tr>
                            )}
                            {/* Capturing in progress banner */}
                            {registering && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/20">
                                        <div className="flex items-center gap-2 text-xs text-amber-600">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Webcam is open on the server — follow the prompts (press C per angle). Waiting for 180 photos + model retrain…
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {students.map(s => {
                                const isRegistered = status?.student_ids?.includes(
                                    s.student_id_number || `STU-${s.id.substring(0, 8).toUpperCase()}`
                                );
                                const result = registerResult[s.id];
                                const isCapturing = registering === s.id;
                                return (
                                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                                        <td className="px-6 py-3 text-sm font-medium text-foreground">{s.full_name}</td>
                                        <td className="px-6 py-3 text-sm text-muted-foreground">{s.email}</td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isRegistered ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"
                                                }`}>
                                                {isRegistered ? "Registered" : "Not registered"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {result && !isCapturing && (
                                                    <span className={`flex items-center gap-1 text-xs ${result.success ? "text-success" : "text-destructive"
                                                        }`}>
                                                        {result.success ? (
                                                            <><CheckCircle2 className="w-3 h-3" />{result.images} photos · {result.total} in model</>
                                                        ) : (
                                                            <><XCircle className="w-3 h-3" />{result.error}</>
                                                        )}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => handleRegister(s.id)}
                                                    disabled={!!registering}
                                                    className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                                                >
                                                    {isCapturing ? (
                                                        <><Loader2 className="w-3 h-3 animate-spin" />Capturing…</>
                                                    ) : (
                                                        <><ScanFace className="w-3 h-3" />{isRegistered ? "Re-Register" : "Register"}</>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminML;
