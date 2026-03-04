import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface CircularProgressProps {
  percentage: number;
  size?: number;
  label?: string;
}

const CircularProgress = ({ percentage, size = 160, label }: CircularProgressProps) => {
  const data = [
    { value: percentage },
    { value: 100 - percentage },
  ];

  const getColor = (pct: number) => {
    if (pct >= 85) return "hsl(var(--success))";
    if (pct >= 75) return "hsl(var(--primary))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.35}
            outerRadius={size * 0.45}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={getColor(percentage)} />
            <Cell fill="hsl(var(--border))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{percentage}%</span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
};

export default CircularProgress;
