import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Append an audit entry. `meta` must not contain PHI (names, phones...) — IDs only. */
export async function audit(e: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}) {
  try {
    await db.auditLog.create({ data: { ...e, actorId: e.actorId ?? null } });
  } catch (err) {
    // Auditing must never break the request, but should be visible to ops
    console.error("[audit] failed", e.action, (err as Error).message);
  }
}
