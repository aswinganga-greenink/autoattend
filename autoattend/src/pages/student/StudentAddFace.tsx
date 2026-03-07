import { useState, useEffect } from "react";
import { ScanFace, RefreshCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const StudentAddFace = () => {
    const { user } = useAuth();
    const [mlStatus, setMlStatus] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statusRes, profileRes] = await Promise.all([
                api.get("/ml/status"),
                api.get("/profiles/student/me"),
            ]);
            setMlStatus(statusRes.data);
            setProfile(profileRes.data);
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setLoading(false);
        }
    };

    const studentIdNumber = profile?.student_id_number;
    const isRegistered = mlStatus?.student_ids?.includes(studentIdNumber);

    const handleRegister = async () => {
        if (!user?.id) return;
        setRegistering(true);
        setResult(null);
        try {
            const res = await api.post(`/ml/register/${user.id}`);
            setResult({
                success: true,
                images: res.data.images_captured,
                total: res.data.total_registered_students,
            });
            fetchData();
        } catch (err: any) {
            setResult({
                success: false,
                error: err.response?.data?.detail || "Registration failed",
            });
        } finally {
            setRegistering(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Register My Face</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Enroll your face into the AI attendance system
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading || registering}
                    className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground disabled:opacity-40"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Status card */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-foreground">Registration Status</p>
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                        <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isRegistered
                                ? "bg-success/10 text-success"
                                : "bg-secondary text-muted-foreground"
                                }`}
                        >
                            {isRegistered ? "Registered ✓" : "Not registered"}
                        </span>
                    )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                    <p>Name: <span className="text-foreground font-medium">{user?.full_name}</span></p>
                    <p>Student ID: <span className="text-foreground font-medium">{studentIdNumber || "—"}</span></p>
                    {mlStatus && (
                        <p>Total registered students: <span className="text-foreground font-medium">{mlStatus.registered_students}</span></p>
                    )}
                </div>
            </div>

            {/* How it works */}
            <div className="glass-card p-5 border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-3">
                    <ScanFace className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-2">How face registration works</p>
                        <ol className="list-decimal list-inside space-y-1.5">
                            <li>Click <strong>Start Registration</strong> below.</li>
                            <li>A webcam window opens on the server.</li>
                            <li>
                                Press{" "}
                                <kbd className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">C</kbd>{" "}
                                to begin each angle: <em>Straight → Left → Right</em>.
                            </li>
                            <li>60 photos are taken per angle (180 total).</li>
                            <li>Once complete, the model retrains automatically. You're ready to go!</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Active capture banner */}
            {registering && (
                <div className="glass-card p-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/5">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-foreground">Capture in progress…</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Follow the webcam prompts on the server machine. This may take a few minutes.
                        </p>
                    </div>
                </div>
            )}

            {/* Result */}
            {result && !registering && (
                <div
                    className={`glass-card p-4 flex items-start gap-3 border ${result.success
                        ? "border-success/20 bg-success/5"
                        : "border-destructive/20 bg-destructive/5"
                        }`}
                >
                    {result.success ? (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="text-sm">
                        {result.success ? (
                            <>
                                <p className="font-medium text-success">Registration complete!</p>
                                <p className="text-muted-foreground mt-0.5">
                                    {result.images} photos captured · {result.total} student(s) in model
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium text-destructive">Registration failed</p>
                                <p className="text-muted-foreground mt-0.5">{result.error}</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Register button */}
            <button
                onClick={handleRegister}
                disabled={registering || loading || !studentIdNumber}
                className="w-full py-3 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {registering ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Capturing &amp; Training…</>
                ) : (
                    <><ScanFace className="w-4 h-4" />{isRegistered ? "Re-Register My Face" : "Start Registration"}</>
                )}
            </button>

            {!studentIdNumber && !loading && (
                <p className="text-xs text-center text-destructive">
                    Your student profile is not set up yet. Contact an admin.
                </p>
            )}
        </div>
    );
};

export default StudentAddFace;
