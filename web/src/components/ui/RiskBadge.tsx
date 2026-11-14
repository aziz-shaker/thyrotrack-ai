import type { RiskCategory } from "@prisma/client";
import { AlertTriangle, CheckCircle2, AlertCircle, OctagonAlert } from "lucide-react";
import clsx from "clsx";
import { RISK_META } from "@/lib/tirads";

const ICON = { BENIGN: CheckCircle2, LOW: CheckCircle2, MODERATE: AlertCircle, HIGH: AlertTriangle, SUSPICIOUS: OctagonAlert };

/** Risk is never shown by color alone: icon + text label + color */
export function RiskBadge({ risk, tirads }: { risk: RiskCategory; tirads?: number | null }) {
  const m = RISK_META[risk];
  const Icon = ICON[risk];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", m.bg, m.color)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {tirads ? <span dir="ltr">TR{tirads}</span> : null}
      {tirads ? "·" : null} {m.ar}
    </span>
  );
}
