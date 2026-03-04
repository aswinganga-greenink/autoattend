import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { X, UserPlus, UserMinus, Shield } from "lucide-react";

interface CourseEnrollmentModalProps {
    courseId: string;
    courseName: string;
    isOpen: boolean;
    onClose: () => void;
}

const CourseEnrollmentModal = ({ courseId, courseName, isOpen, onClose }: CourseEnrollmentModalProps) => {
    const [students, setStudents] = useState<any[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, courseId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all users to filter out students
            const usersRes = await api.get("/users/");
            const allStudents = usersRes.data.filter((u: any) => u.role === "student");
            setStudents(allStudents);

            // Fetch currently enrolled students for this course
            const enrolledRes = await api.get(`/courses/${courseId}/students`);
            setEnrolledStudents(enrolledRes.data);
        } catch (err) {
            console.error("Failed to fetch enrollment data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleEnroll = async (studentId: string) => {
        try {
            await api.post(`/courses/admin/${courseId}/enroll/${studentId}`);
            fetchData();
        } catch (err) {
            console.error("Enrollment failed", err);
            alert("Failed to enroll student.");
        }
    };

    const handleUnenroll = async (studentId: string) => {
        try {
            await api.delete(`/courses/admin/${courseId}/enroll/${studentId}`);
            fetchData();
        } catch (err) {
            console.error("Unenrollment failed", err);
            alert("Failed to remove student.");
        }
    };

    if (!isOpen) return null;

    const enrolledIds = new Set(enrolledStudents.map((s: any) => s.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Manage Enrollments</h2>
                        <p className="text-sm text-muted-foreground">Course: <span className="font-semibold text-primary">{courseName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {loading ? (
                        <p className="text-center text-muted-foreground py-8">Loading students...</p>
                    ) : (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-foreground mb-3">All Students ({students.length})</h3>
                            {students.map(student => {
                                const isEnrolled = enrolledIds.has(student.id);
                                return (
                                    <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-secondary/30 rounded-xl gap-4 border border-border/50">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{student.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{student.email}</p>
                                        </div>
                                        <div>
                                            {isEnrolled ? (
                                                <button
                                                    onClick={() => handleUnenroll(student.id)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 transition-colors w-full sm:w-auto justify-center"
                                                >
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                    Remove
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleEnroll(student.id)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors w-full sm:w-auto justify-center"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                    Enroll
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {students.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm glass-card border-dashed">
                                    No students found in the system. Create students first.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CourseEnrollmentModal;
