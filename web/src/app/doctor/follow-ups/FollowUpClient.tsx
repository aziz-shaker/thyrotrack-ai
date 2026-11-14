"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function FollowUpForm({ patients }: { patients: { id: string; fullName: string }[] }) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [reason, setReason] = useState("سونار متابعة للعقيدة");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, scheduledAt: new Date(`${date}T${time}`).toISOString(), reason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "تعذّر حفظ الموعد" });
    setMsg({ ok: true, text: "تم تحديد الموعد وإبلاغ المريض" });
    setDate("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-navy-800">
        المريض
        <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input mt-1 font-normal">
          <option value="">اختر المريض…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-navy-800">
          التاريخ
          <input type="date" required min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1 font-normal" />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          الوقت
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="input mt-1 font-normal" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-navy-800">
        السبب
        <input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1 font-normal" />
      </label>
      {msg && <p role="status" className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <button disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />} تحديد الموعد</button>
    </form>
  );
}

export function FollowUpStatusButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(status: "COMPLETED" | "CANCELLED") {
    setBusy(true);
    await fetch(`/api/follow-ups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex gap-2 text-sm">
      <button disabled={busy} onClick={() => set("COMPLETED")} className="rounded-md px-2.5 py-1.5 font-semibold text-green-700 hover:bg-green-50">تم</button>
      <button disabled={busy} onClick={() => set("CANCELLED")} className="rounded-md px-2.5 py-1.5 font-semibold text-ink-soft hover:bg-red-50 hover:text-red-600">إلغاء</button>
    </div>
  );
}
