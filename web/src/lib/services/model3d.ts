import type { Lobe, LobeZone, RiskCategory } from "@prisma/client";
import { db } from "../db";

export interface Model3DPoint {
  studyDate: string;
  volumeMl: number;
  maxDimMm: number;
  risk: RiskCategory;
  tirads: number | null;
  reviewed: boolean;
}

export interface Model3DNodule {
  id: string;
  label: string;
  lobe: Lobe;
  zone: LobeZone;
  history: Model3DPoint[]; // oldest → newest
}

/**
 * Nodule map for the 3D thyroid. Patients only ever see doctor-approved results that were sent to them;
 * clinicians also see AI-only (unreviewed) findings, flagged as such.
 */
export async function thyroidModel(patientId: string, audience: "patient" | "clinician"): Promise<Model3DNodule[]> {
  const nodules = await db.nodule.findMany({
    where: { patientId },
    orderBy: { label: "asc" },
    include: {
      findings: {
        where: {
          analysis: {
            study: { deletedAt: null, ...(audience === "patient" ? { status: "REPORTED" } : {}) },
            ...(audience === "patient" ? { review: { isNot: null } } : {}),
          },
        },
        include: { analysis: { include: { study: { select: { studyDate: true } }, review: true } } },
      },
    },
  });

  return nodules
    .map((n) => ({
      id: n.id,
      label: n.label,
      lobe: n.lobe,
      zone: n.zone,
      history: n.findings
        .filter((f) => f.analysis.review?.decision !== "REJECTED")
        .map((f) => {
          const r = f.analysis.review;
          const mod = (r?.modifiedFindings ?? {}) as { volumeMl?: number; lengthMm?: number; widthMm?: number; depthMm?: number };
          return {
            studyDate: f.analysis.study.studyDate.toISOString(),
            volumeMl: mod.volumeMl ?? f.volumeMl,
            maxDimMm: Math.max(mod.lengthMm ?? f.lengthMm, mod.widthMm ?? f.widthMm, mod.depthMm ?? f.depthMm),
            risk: r?.finalRisk ?? f.risk,
            tirads: r?.finalTirads ?? f.tiradsLevel,
            reviewed: !!r,
          };
        })
        .sort((a, b) => a.studyDate.localeCompare(b.studyDate)),
    }))
    .filter((n) => n.history.length > 0);
}
