"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileDown, Loader2, Send } from "lucide-react";

/** Download PDF + send to patient (with confirm) + copy the expiring secure link. */
export function ReportActions(props: { reportId: string; status: "DRAFT" | "APPROVED" | "SENT"; shareToken: string | null; shareExpiresAt: string | null; compact?: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ token: string; expires: string } | null>(
    props.shareToken && props.shareExpiresAt ? { token: props.shareToken, expires: props.shareExpiresAt } : null,
  );
  const [copied, setCopied] = useState(false);
  const expired = link ? new Date(link.expires) < new Date() : false;

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${props.reportId}/send`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirm(false);
    if (!res.ok) return setError(json.error ?? "تعذّر الإرسال");
    setLink({ token: json.shareToken, expires: json.shareExpiresAt });
    router.refresh();
  }

  const url = link ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${link.token}` : "";

  return (
    <div className="space-y-3">
      <div className={props.compact ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
        <a href={`/api/reports/${props.reportId}/pdf`} target="_blank" rel="noopener" className="btn-outline px-3 py-2 text-sm">
          <FileDown className="h-4 w-4" /> تحميل PDF
        </a>
        {props.status !== "SENT" ? (
          <button onClick={() => setConfirm(true)} className="btn-primary px-3 py-2 text-sm">
            <Send className="h-4 w-4" /> إرسال للمريض
          </button>
        ) : (
          <span className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
            <Check className="h-4 w-4" /> أُرسل للمريض
          </span>
        )}
      </div>

      {link && !props.compact && (
        <div className="rounded-lg bg-navy-50 p-3 text-xs text-ink-soft">
          <p>{expired ? "انتهت صلاحية الرابط الآمن." : `رابط آمن صالح حتى ${new Date(link.expires).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}:`}</p>
          {!expired && (
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1" dir="ltr">{url}</code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex items-center gap-1 font-semibold text-brand-700"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "نُسخ" : "نسخ"}
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="send-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h3 id="send-title" className="text-lg font-bold text-navy-800">إرسال التقرير للمريض؟</h3>
            <p className="mt-2 text-sm text-ink-soft">سيظهر التقرير في بوابة المريض، ويُنشأ رابط آمن صالح لمدة 7 أيام.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={send} disabled={busy} className="btn-primary flex-1" autoFocus>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} إرسال
              </button>
              <button onClick={() => setConfirm(false)} disabled={busy} className="btn-outline flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
