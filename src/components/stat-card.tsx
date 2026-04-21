type StatCardProps = {
  value: number | string;
  label: string;
  hint: string;
  color?: "teal" | "blue" | "amber" | "purple";
  icon?: string;
};

const colorMap = {
  teal: {
    bg: "bg-gradient-to-br from-teal-500 to-teal-600",
    light: "bg-teal-400/20",
    text: "text-white",
    hint: "text-teal-100",
  },
  blue: {
    bg: "bg-gradient-to-br from-blue-500 to-blue-600",
    light: "bg-blue-400/20",
    text: "text-white",
    hint: "text-blue-100",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-500 to-orange-500",
    light: "bg-amber-400/20",
    text: "text-white",
    hint: "text-amber-100",
  },
  purple: {
    bg: "bg-gradient-to-br from-purple-500 to-purple-600",
    light: "bg-purple-400/20",
    text: "text-white",
    hint: "text-purple-100",
  },
};

export function StatCard({ value, label, hint, color = "teal", icon }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={`rounded-xl p-5 ${c.bg} relative overflow-hidden`}>
      {icon && (
        <div className={`absolute -right-3 -top-3 h-20 w-20 rounded-full ${c.light}`} />
      )}
      <div className="relative">
        <p className={`text-3xl font-bold ${c.text}`}>{value}</p>
        <h3 className={`mt-1 text-sm font-semibold ${c.text}`}>
          {label}
        </h3>
        <p className={`mt-2 text-xs ${c.hint}`}>{hint}</p>
      </div>
    </div>
  );
}
