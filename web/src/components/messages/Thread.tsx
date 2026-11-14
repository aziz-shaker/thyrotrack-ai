"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import clsx from "clsx";

export interface Msg {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** Chat thread with light polling (15s) for new messages. */
export function Thread({ meId, otherId, otherName, initial, hint }: { meId: string; otherId: string; otherName: string; initial: Msg[]; hint?: string }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs.length]);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch(`/api/messages?with=${otherId}`).catch(() => null);
      if (r?.ok) setMsgs((await r.json()).messages);
    }, 15_000);
    return () => clearInterval(t);
  }, [otherId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId: otherId, body: text }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error ?? "تعذّر الإرسال");
    setMsgs((m) => [...m, j]);
    setText("");
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white">
      <header className="border-b border-navy-50 px-5 py-3">
        <p className="font-bold text-navy-800">{otherName}</p>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-navy-50/40 p-5" aria-live="polite">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">لا توجد رسائل بعد. اكتب سؤالك بالأسفل.</p>}
        {msgs.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={clsx("flex", mine ? "justify-start" : "justify-end")}>
              <div className={clsx("max-w-[78%] rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-ss-sm bg-navy-800 text-white" : "rounded-se-sm bg-white text-navy-800 ring-1 ring-navy-100")}>
                <p className="whitespace-pre-wrap leading-6">{m.body}</p>
                <p className={clsx("mt-1 text-[10px]", mine ? "text-white/60" : "text-ink-muted")}>
                  {new Date(m.createdAt).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-navy-50 p-3">
        <label className="sr-only" htmlFor="msg">الرسالة</label>
        <textarea
          id="msg"
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
          placeholder="اكتب رسالتك…"
          className="input flex-1 resize-none"
        />
        <button disabled={busy || !text.trim()} className="btn-primary h-11 px-4 disabled:opacity-50" aria-label="إرسال">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
        </button>
      </form>
      {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
