import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  variant?: "default" | "success" | "warning" | "gold";
}

const variantStyles = {
  default: "border-border",
  success: "border-success/20 glow-success",
  warning: "border-warning/20",
  gold: "border-primary/20 glow-gold",
};

const StatCard = ({ label, value, icon, trend, variant = "default" }: StatCardProps) => (
  <div className={`glass-card p-5 ${variantStyles[variant]} transition-all hover:scale-[1.02] duration-200`}>
    <div className="flex items-start justify-between mb-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="p-2 rounded-lg bg-secondary/50">{icon}</div>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    {trend && <p className="text-xs text-success mt-1">{trend}</p>}
  </div>
);

export default StatCard;
