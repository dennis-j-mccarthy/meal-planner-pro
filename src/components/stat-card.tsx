type StatCardProps = {
  value: number | string;
  label: string;
  hint: string;
  color?: "teal" | "blue" | "amber" | "purple" | "pink" | "green" | "orange" | "indigo";
  icon?: string;
};

const colorMap = {
  teal: {
    bg: "bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600",
    light: "bg-teal-300/30",
  },
  blue: {
    bg: "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600",
    light: "bg-sky-300/30",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-red-500",
    light: "bg-amber-300/30",
  },
  orange: {
    bg: "bg-gradient-to-br from-orange-400 via-red-500 to-pink-600",
    light: "bg-orange-300/30",
  },
  purple: {
    bg: "bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-600",
    light: "bg-violet-300/30",
  },
  pink: {
    bg: "bg-gradient-to-br from-pink-400 via-rose-500 to-red-500",
    light: "bg-pink-300/30",
  },
  green: {
    bg: "bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600",
    light: "bg-lime-300/30",
  },
  indigo: {
    bg: "bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-600",
    light: "bg-indigo-300/30",
  },
};

export function StatCard({ value, label, hint, color = "teal", icon }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={`rounded-2xl p-5 ${c.bg} relative overflow-hidden shadow-md hover:shadow-xl transition-shadow`}>
      {icon && (
        <>
          <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full ${c.light}`} />
          <div className={`absolute -right-8 -bottom-8 h-20 w-20 rounded-full ${c.light} opacity-60`} />
        </>
      )}
      <div className="relative">
        <p className="text-3xl font-bold text-white drop-shadow-sm">{value}</p>
        <h3 className="mt-1 text-sm font-semibold text-white">
          {label}
        </h3>
        <p className="mt-2 text-xs text-white/80">{hint}</p>
      </div>
    </div>
  );
}
