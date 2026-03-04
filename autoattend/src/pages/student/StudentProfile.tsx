import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Save, User, Camera, Check } from "lucide-react";
import { api } from "@/lib/api";

const StudentProfile = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    password: "",
  });

  const [profile, setProfile] = useState<any>(null);
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/profiles/student/${user?.id}`);
      setProfile(res.data);
    } catch (err) {
      // 404 means profile doesn't exist yet
    }
  };

  const handleUpdateUser = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      await api.put('/users/me', {
        full_name: form.full_name,
        email: form.email,
        ...(form.password ? { password: form.password } : {})
      });
      setMessage("User details updated successfully!");
    } catch (error) {
      setMessage("Failed to update user details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!studentIdNumber) return;
    setIsLoading(true);
    setMessage("");
    try {
      const res = await api.post('/profiles/student', {
        user_id: user?.id,
        student_id_number: studentIdNumber
      });
      setProfile(res.data);
      setMessage("Student profile created!");
    } catch (error) {
      setMessage("Failed to create profile.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceUpload = async () => {
    if (!imageFile || !user?.id) return;
    setIsLoading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const res = await api.post(`/profiles/student/${user.id}/face`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setProfile(res.data);
      setImageFile(null);
      setMessage("Face registered successfully!");
    } catch (error) {
      setMessage("Failed to register face.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {message && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm text-center">
          {message}
        </div>
      )}

      {/* User Info Details */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Edit User Details</h3>
        </div>

        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-2xl font-bold">
            {user?.full_name?.split(" ").map((n) => n[0]).join("") || "S"}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">New Password (leave blank to keep)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <button onClick={handleUpdateUser} disabled={isLoading} className="w-full py-3 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            Save User Changes
          </button>
        </div>
      </div>

      {/* Student Profile & Face Registration */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Student Identity & Face</h3>
        </div>

        {!profile ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">You must create a student profile before you can upload your face for attendance.</p>
            <input
              type="text"
              placeholder="Enter Student ID Number (e.g., CS2021001)"
              value={studentIdNumber}
              onChange={(e) => setStudentIdNumber(e.target.value)}
              className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button onClick={handleCreateProfile} disabled={isLoading || !studentIdNumber} className="w-full py-3 bg-secondary border border-border text-foreground font-semibold rounded-xl hover:bg-secondary/70 transition-colors">
              Create Student Profile
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-secondary/50 border border-border rounded-xl">
              <p className="text-sm text-muted-foreground">Student ID Number</p>
              <p className="font-medium text-foreground">{profile.student_id_number}</p>
            </div>

            <div className="p-4 bg-secondary/50 border border-border rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Face Registration Status</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.face_encoding ? "Your face data is registered and ready for attendance." : "You have not registered your face yet."}
                  </p>
                </div>
                {profile.face_encoding && (
                  <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <label className="text-sm text-muted-foreground mb-2 block">
                  {profile.face_encoding ? "Update Face Image" : "Upload Face Image"}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <button
                  onClick={handleFaceUpload}
                  disabled={isLoading || !imageFile}
                  className="mt-3 w-full py-2.5 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Submit Face Scan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
