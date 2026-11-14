"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single-series line: nodule volume (ml) across studies — title names the series, so no legend */
export function GrowthChart({ data }: { data: { date: string; volume: number; maxDim: number }[] }) {
  return (
    <div className="h-56 w-full" dir="ltr" role="img" aria-label="حجم العقدة عبر الفحوصات">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E9F0F0" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#8A959B", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8A959B", fontSize: 12 }} unit=" ml" width={64} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #C9EFEA", direction: "rtl" }}
            formatter={(v: number, k) => (k === "volume" ? [`${v} ml`, "الحجم"] : [v, k])}
          />
          <Line type="monotone" dataKey="volume" stroke="#1BB5A3" strokeWidth={2} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
