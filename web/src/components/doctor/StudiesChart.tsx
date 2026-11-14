"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface MonthRow {
  month: string;
  low: number;
  moderate: number;
  high: number;
  suspicious: number;
}

// Risk = status semantics (reserved colors), always paired with a text legend
const SERIES = [
  { key: "low", label: "حميدة/منخفضة", color: "#22C55E" },
  { key: "moderate", label: "متوسطة", color: "#EAB308" },
  { key: "high", label: "عالية", color: "#F97316" },
  { key: "suspicious", label: "مشتبه بها", color: "#EF4444" },
] as const;

export function StudiesChart({ data }: { data: MonthRow[] }) {
  return (
    <div className="h-72 w-full" dir="ltr" role="img" aria-label="عدد الإشاعات شهريًا حسب درجة الخطورة">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#E9F0F0" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#8A959B", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#8A959B", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(27,181,163,0.08)" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #C9EFEA", fontFamily: "inherit", direction: "rtl" }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 13, direction: "rtl" }} />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="r"
              fill={s.color}
              stroke="#fff"
              strokeWidth={2}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
