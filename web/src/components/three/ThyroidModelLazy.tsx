"use client";

import dynamic from "next/dynamic";

/** Three.js is client-only and heavy: load it lazily with a skeleton. */
export const ThyroidModelLazy = dynamic(() => import("./ThyroidModel").then((m) => m.ThyroidModel), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-navy-50" aria-label="جاري تحميل النموذج" />,
});
