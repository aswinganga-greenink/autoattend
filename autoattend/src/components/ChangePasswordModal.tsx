import { useState } from "react";
import { X, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await api.put("/users/me", { password });
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setPassword("");
                setConfirmPassword("");
            }, 2000);
        } catch (err: any) {
            setError("Failed to update password. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden glass-card">
                <div className="flex items-center justify-between p-6 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
                            <Lock className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Change Password</h2>
                            <p className="text-xs text-muted-foreground">Update your account security</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">Password Updated!</h3>
                            <p className="text-sm text-muted-foreground">Your password has been changed successfully.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm text-muted-foreground mb-1.5 block">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="Enter new password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground mb-1.5 block">Confirm Password</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-2.5 gradient-gold text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-6"
                            >
                                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isLoading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
