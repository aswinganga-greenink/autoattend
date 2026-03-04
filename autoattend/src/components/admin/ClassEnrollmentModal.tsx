import { useState, useEffect } from "react";
import { X, Search, UserPlus, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { User } from "@/types";
import { toast } from "sonner";

interface ClassEnrollmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    classGroupId: string;
    classGroupName: string;
}

const ClassEnrollmentModal = ({ isOpen, onClose, classGroupId, classGroupName }: ClassEnrollmentModalProps) => {
    const [students, setStudents] = useState<User[]>([]);
    const [enrolledStudentIds, setEnrolledStudentIds] = useState<Set<string>>(new Set());
    const [allEnrolledStudentIds, setAllEnrolledStudentIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && classGroupId) {
            fetchStudentsAndEnrollments();
        }
    }, [isOpen, classGroupId]);

    const fetchStudentsAndEnrollments = async () => {
        setLoading(true);
        try {
            // 1. Fetch all students
            const usersRes = await api.get("/users/");
            const allStudents = usersRes.data.filter((u: User) => u.role === "student");
            setStudents(allStudents);

            // 2. Fetch all classes to find all global enrollments
            const allClassRes = await api.get("/classes/");
            const allClasses = allClassRes.data;
            let globalEnrolledIds = new Set<string>();
            let thisClassEnrolls = new Set<string>();

            // Aggregate enrollments
            allClasses.forEach((cls: any) => {
                if (cls.enrollments) {
                    cls.enrollments.forEach((e: any) => {
                        globalEnrolledIds.add(e.student_id);
                        if (cls.id === classGroupId) {
                            thisClassEnrolls.add(e.student_id);
                        }
                    });
                }
            });

            setAllEnrolledStudentIds(globalEnrolledIds);
            setEnrolledStudentIds(thisClassEnrolls);

        } catch (err) {
            console.error("Failed to fetch data for enrollment", err);
            toast.error("Failed to load student data");
        } finally {
            setLoading(false);
        }
    };

    const handleEnroll = async (studentId: string) => {
        try {
            await api.post(`/classes/${classGroupId}/enroll/${studentId}`);
            setEnrolledStudentIds(prev => new Set(prev).add(studentId));
            setAllEnrolledStudentIds(prev => new Set(prev).add(studentId));
            toast.success("Student enrolled in class");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to enroll student");
        }
    };

    const handleUnenroll = async (studentId: string) => {
        try {
            await api.delete(`/classes/${classGroupId}/enroll/${studentId}`);
            setEnrolledStudentIds(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });
            setAllEnrolledStudentIds(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });
            toast.success("Student removed from class");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Failed to remove student");
        }
    };

    const filteredStudents = students.filter(student => {
        // Hide students already in a DIFFERENT class group
        if (allEnrolledStudentIds.has(student.id) && !enrolledStudentIds.has(student.id)) {
            return false;
        }

        return student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/30">
                    <div>
                        <h3 className="font-semibold text-lg text-foreground">Manage Class Students</h3>
                        <p className="text-sm text-muted-foreground">Class: <span className="font-medium text-primary">{classGroupName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-border">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search students by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                {/* Student List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No students found matching your search.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredStudents.map(student => {
                                const isEnrolled = enrolledStudentIds.has(student.id);

                                return (
                                    <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-secondary/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {student.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-foreground">{student.full_name}</p>
                                                <p className="text-xs text-muted-foreground">{student.email}</p>
                                            </div>
                                        </div>

                                        {isEnrolled ? (
                                            <button
                                                onClick={() => handleUnenroll(student.id)}
                                                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Enrolled
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleEnroll(student.id)}
                                                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Enroll
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassEnrollmentModal;
