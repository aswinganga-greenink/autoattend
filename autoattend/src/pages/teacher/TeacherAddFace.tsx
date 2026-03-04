import { useState } from "react";
import { Upload, Save, UserPlus, CheckCircle } from "lucide-react";

const TeacherAddFace = () => {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", registerNumber: "", className: "", image: null as File | null });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ name: "", registerNumber: "", className: "", image: null });
    }, 3000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Add Student Face</h3>
            <p className="text-xs text-muted-foreground">Enroll a new student into the AI recognition system</p>
          </div>
        </div>

        {saved ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Encoding Saved Successfully</h3>
            <p className="text-sm text-muted-foreground">Face encoding has been stored securely in the database.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Student Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Enter student name"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Register Number</label>
              <input
                required
                value={form.registerNumber}
                onChange={(e) => setForm({ ...form, registerNumber: e.target.value })}
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. CS2021045"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Class</label>
              <select
                required
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
                className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select class</option>
                <option value="CSE - A">CSE - A</option>
                <option value="CSE - B">CSE - B</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Upload Image</label>
              <label className="flex flex-col items-center justify-center w-full h-32 bg-secondary/30 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {form.image ? form.image.name : "Click to upload face image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-2">Image is processed server-side. Raw images are never stored or displayed.</p>
            </div>
            <button
              type="submit"
              className="w-full py-3 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Face Encoding
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default TeacherAddFace;
