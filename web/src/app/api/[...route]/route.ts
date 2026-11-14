/**
 * Single entry point for the REST API (except NextAuth and the static OpenAPI file).
 * Each handler module keeps the Next.js route signature; this file only matches the path.
 * Why: one serverless function instead of ~15 (Vercel Hobby allows 12 per deployment),
 * and one place to see every endpoint.
 */
import { fail } from "@/lib/api";
import * as analysisReview from "@/server/handlers/analysis-review";
import * as followUp from "@/server/handlers/follow-up";
import * as followUps from "@/server/handlers/follow-ups";
import * as image from "@/server/handlers/image";
import * as messages from "@/server/handlers/messages";
import * as patients from "@/server/handlers/patients";
import * as patient3d from "@/server/handlers/patient-3d-model";
import * as patientLabs from "@/server/handlers/patient-labs";
import * as patientStudies from "@/server/handlers/patient-studies";
import * as reportPdf from "@/server/handlers/report-pdf";
import * as reportSend from "@/server/handlers/report-send";
import * as sharePdf from "@/server/handlers/share-pdf";
import * as studyAnalyze from "@/server/handlers/study-analyze";
import * as studyImages from "@/server/handlers/study-images";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // PDF rendering / AI analysis

type Method = "GET" | "POST" | "PATCH";
// Params are guaranteed by the matched pattern (e.g. ":id"), so handlers keep their precise param types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: { params: any }) => Response | Promise<Response>;
type Module = Partial<Record<Method, Handler>>;

// Order matters only for overlapping patterns (none currently)
const ROUTES: [pattern: string, mod: Module][] = [
  ["patients", patients],
  ["patients/:id/studies", patientStudies],
  ["patients/:id/labs", patientLabs],
  ["patients/:id/3d-model", patient3d],
  ["studies/:id/images", studyImages],
  ["studies/:id/analyze", studyAnalyze],
  ["analysis/:id/review", analysisReview],
  ["images/:id", image],
  ["reports/:id/pdf", reportPdf],
  ["reports/:id/send", reportSend],
  ["share/:token/pdf", sharePdf],
  ["follow-ups", followUps],
  ["follow-ups/:id", followUp],
  ["messages", messages],
];

function match(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = pattern.split("/");
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

function dispatch(method: Method) {
  return async (req: Request, ctx: { params: { route: string[] } }) => {
    const segments = ctx.params.route ?? [];
    for (const [pattern, mod] of ROUTES) {
      const params = match(pattern, segments);
      if (!params) continue;
      const handler = mod[method];
      if (!handler) return fail(405, "Method not allowed");
      return handler(req, { params });
    }
    return fail(404, "Not found");
  };
}

export const GET = dispatch("GET");
export const POST = dispatch("POST");
export const PATCH = dispatch("PATCH");
