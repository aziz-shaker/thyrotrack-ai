import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getSession } from "./auth";
import type { Actor } from "./access";

/** Small helpers for consistent JSON API responses. */
export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (status: number, message: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: message, ...extra }, { status });

/** Returns the actor or a 401/403 response. */
export async function requireActor(roles?: Role[]): Promise<Actor | NextResponse> {
  const s = await getSession();
  if (!s) return fail(401, "يجب تسجيل الدخول");
  if (roles && !roles.includes(s.user.role)) return fail(403, "ليس لديك صلاحية لهذه العملية");
  return { id: s.user.id, role: s.user.role };
}

export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
