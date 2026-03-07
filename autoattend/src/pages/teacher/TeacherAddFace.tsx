import { useState, useEffect } from "react";
import { ScanFace, RefreshCw, UserPlus, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

const TeacherAddFace = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registerResult, setRegisterResult] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchStudents();
    fetchMlStatus();
  }, []);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await api.get("/users/students");
      setStudents(res.data);
    } catch (e) {
      console.error("Failed to fetch students", e);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchMlStatus = async () => {
    try {
      const res = await api.get("/ml/status");
      setMlStatus(res.data);
    } catch (e) {
      console.error("Failed to fetch ML status", e);
    }
  };

  const handleRegister = async (userId: string) => {
    setRegistering(userId);
    setRegisterResult((prev) => ({ ...prev, [userId]: null }));
    try {
      // This call blocks until capture (180 photos) + model retrain are complete
      const res = await api.post(`/ml/register/${userId}`);
      setRegisterResult((prev) => ({
        ...prev,
        [userId]: {
          success: true,
          images: res.data.images_captured,
          total: res.data.total_registered_students,
        },
      }));
      fetchMlStatus();
    } catch (err: any) {
      setRegisterResult((prev) => ({
        ...prev,
        [userId]: {
          success: false,
          error: err.response?.data?.detail || "Registration failed",
        },
      }));
    } finally {
      setRegistering(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Student Face</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Launch webcam capture on the server — takes 180 photos across 3 angles, then
            retrains the model automatically
          </p>
        </div>
        <button
          onClick={() => { fetchStudents(); fetchMlStatus(); }}
          disabled={!!registering}
          className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Info banner */}
      <div className="glass-card p-4 border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <ScanFace className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How it works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click <strong>Register</strong> — a webcam window opens on the server machine.</li>
              <li>Press <kbd className="px-1 py-0.5 rounded bg-secondary text-xs font-mono">C</kbd> to start each angle: <em>Straight → Left → Right</em>.</li>
              <li>60 photos are captured per angle (180 total), then the model retrains automatically.</li>
              <li>The button updates to <strong>Re-register</strong> when done. The model is ready to use immediately.</li>
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
              Webcam window is open on the server. Follow the prompts, then wait for model retraining to finish.
            </p>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Students</h3>
          {mlStatus && (
            <span className="ml-auto text-xs text-muted-foreground">
              {mlStatus.registered_students} / {students.length} registered
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="text-left px-6 py-3">Student</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Face Data</th>
                <th className="text-right px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingStudents ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Loading students…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No students found in the system.
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const studentIdNumber =
                    s.student_id_number || `STU-${s.id.substring(0, 8).toUpperCase()}`;
                  const isRegistered = mlStatus?.student_ids?.includes(studentIdNumber);
                  const result = registerResult[s.id];
                  const isCapturing = registering === s.id;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-6 py-3 text-sm font-medium text-foreground">
                        {s.full_name}
                      </td>
                      <td className="px-6 py-3 text-sm text-muted-foreground">{s.email}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${isRegistered
                              ? "bg-success/10 text-success"
                              : "bg-secondary text-muted-foreground"
                            }`}
                        >
                          {isRegistered ? "Registered" : "Not registered"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Result feedback */}
                          {result && !isCapturing && (
                            <span className={`flex items-center gap-1 text-xs ${result.success ? "text-success" : "text-destructive"}`}>
                              {result.success ? (
                                <><CheckCircle2 className="w-3 h-3" />{result.images} photos · {result.total} students in model</>
                              ) : (
                                <><XCircle className="w-3 h-3" />{result.error}</>
                              )}
                            </span>
                          )}

                          <button
                            onClick={() => handleRegister(s.id)}
                            disabled={!!registering}
                            className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherAddFace;
