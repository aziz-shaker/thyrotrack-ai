import type { Prisma, Role } from "@prisma/client";
import { db } from "./db";

export interface Actor {
  id: string;
  role: Role;
}

const CLINICAL: Role[] = ["DOCTOR", "RADIOLOGIST"];

/**
 * Row-level filter: which patients may this actor see?
 * - Admin: all
 * - Doctor/Radiologist: only assigned patients (non-expired temporary grants included)
 * - Lab tech: all (to enter results) — but no imaging/review permissions
 * - Patient: only themself
 */
export async function patientScope(actor: Actor): Promise<Prisma.PatientWhereInput> {
  const base: Prisma.PatientWhereInput = { deletedAt: null };
  if (actor.role === "ADMIN" || actor.role === "LAB_TECH") return base;
  if (actor.role === "PATIENT") return { ...base, userId: actor.id };

  const doctor = await db.doctorProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!doctor) return { id: "00000000-0000-0000-0000-000000000000" }; // nothing
  return {
    ...base,
    assignments: {
      some: { doctorId: doctor.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    },
  };
}

export async function canAccessPatient(actor: Actor, patientId: string) {
  const scope = await patientScope(actor);
  return (await db.patient.count({ where: { AND: [scope, { id: patientId }] } })) > 0;
}

export const can = {
  manageUsers: (r: Role) => r === "ADMIN",
  uploadImaging: (r: Role) => CLINICAL.includes(r),
  reviewAnalysis: (r: Role) => CLINICAL.includes(r),
  signReport: (r: Role) => r === "DOCTOR",
  enterLabs: (r: Role) => r === "LAB_TECH" || CLINICAL.includes(r),
};
