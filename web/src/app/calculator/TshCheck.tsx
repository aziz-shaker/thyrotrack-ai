"use client";

import { useState } from "react";

/** Simple TSH interpretation against the common adult reference range (0.4–4.0 mIU/L) */
export function TshCheck() {
  const [v, setV] = useState("2.1");
  const n = Number(v);
  const res =
    !v || Number.isNaN(n)
      ? null
      : n < 0.4
        ? { t: "أقل من الطبيعي", d: "قد يشير لنشاط زائد في الغدة — راجع طبيبك مع تحليل Free T4.", c: "bg-orange-100 text-orange-800" }
        : n > 4.0
          ? { t: "أعلى من الطبيعي", d: "قد يشير لخمول في الغدة — راجع طبيبك مع تحليل Free T4 و Anti-TPO.", c: "bg-orange-100 text-orange-800" }
          : { t: "في المعدل الطبيعي", d: "النتيجة ضمن المدى المرجعي الشائع للبالغين.", c: "bg-green-100 text-green-800" };

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-6">
      <label className="text-sm font-bold text-navy-800">
        قيمة TSH (mIU/L)
        <input type="number" step="0.01" min="0" value={v} onChange={(e) => setV(e.target.value)} className="input mt-2 max-w-40" dir="ltr" />
      </label>
      {res && (
        <div className={`mt-4 rounded-lg p-4 ${res.c}`} aria-live="polite">
          <p className="font-extrabold">{res.t}</p>
          <p className="mt-1 text-sm">{res.d}</p>
        </div>
      )}
      <p className="mt-4 text-xs text-ink-muted">المدى المرجعي يختلف حسب المعمل والعمر والحمل. للتثقيف فقط.</p>
    </div>
  );
}
