"use client";

import { useEffect, useState } from "react";
import { ChevronUp, Phone } from "lucide-react";

/** Floating square actions: call + scroll-to-top (appears after scrolling) */
export function ChatFab() {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cls = "grid h-11 w-11 place-items-center rounded-md bg-brand-500 text-white shadow-lg transition hover:bg-brand-600";
  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-2">
      <a href="#contact" aria-label="اتصل بنا" className={cls}>
        <Phone className="h-5 w-5" fill="currentColor" />
      </a>
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0 })} aria-label="العودة للأعلى" className={cls}>
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
