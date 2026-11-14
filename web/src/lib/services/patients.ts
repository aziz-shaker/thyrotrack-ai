import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { encrypt } from "../crypto";
import type { Actor } from "../access";
import { HttpError } from "./studies";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createPatientSchema = z.object({
  fullName: z.string().trim().min(3, "اكتب اسم المريض بالكامل").max(120),
  dateOfBirth: z.coerce
    .date()
    .max(new Date(), "تاريخ الميلاد لا يمكن أن يكون في المستقبل")
    .min(new Date("1900-01-01"), "تاريخ الميلاد غير صحيح"),
  sex: z.enum(["MALE", "FEMALE"]),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "رقم الهاتف غير صحيح")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("").transform(() => undefined)),
  medicalHistory: optionalText(2000),
  familyHistory: optionalText(2000),
  medications: optionalText(1000),
  allergies: optionalText(500),
  createPortalAccount: z.boolean().default(false),
});

/** Readable one-time password: 10 chars from an unambiguous alphabet + a symbol and digit. */
function tempPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const core = Array.from({ length: 9 }, () => abc[randomInt(abc.length)]).join("");
  return `${core}#${randomInt(10)}`;
}

/**
 * Create a patient. The creating clinician becomes the primary (assigned) doctor, so the patient
 * immediately appears in their list. Optionally creates a portal login with a one-time password.
 */
export async function createPatient(actor: Actor, input: z.infer<typeof createPatientSchema>) {
  if (actor.role !== "DOCTOR" && actor.role !== "RADIOLOGIST") throw new HttpError(403, "إضافة المرضى متاحة للأطباء فقط");
  const doctor = await db.doctorProfile.findUnique({ where: { userId: actor.id } });
  if (!doctor) throw new HttpError(403, "حسابك غير مرتبط بملف طبيب");

  if (input.createPortalAccount && !input.email) throw new HttpError(400, "أدخل البريد الإلكتروني لإنشاء حساب المريض");
  if (input.email && (await db.user.findUnique({ where: { email: input.email } }))) {
    throw new HttpError(409, "هذا البريد مسجّل لمستخدم آخر");
  }

  // Next MRN in the MRN-xxxxxx sequence
  const last = await db.patient.findFirst({ where: { mrn: { startsWith: "MRN-" } }, orderBy: { mrn: "desc" }, select: { mrn: true } });
  const next = (last ? parseInt(last.mrn.slice(4), 10) : 100200) + 1;

  const password = input.createPortalAccount ? tempPassword() : null;

  const patient = await db.$transaction(async (tx) => {
    const user = password
      ? await tx.user.create({ data: { email: input.email!, name: input.fullName, role: "PATIENT", passwordHash: await bcrypt.hash(password, 10) } })
      : null;
    return tx.patient.create({
      data: {
        userId: user?.id,
        mrn: `MRN-${next}`,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        sex: input.sex,
        phoneEnc: input.phone ? encrypt(input.phone) : null,
        email: input.email,
        medicalHistory: input.medicalHistory,
        familyHistory: input.familyHistory,
        medications: input.medications,
        allergies: input.allergies,
        assignments: { create: { doctorId: doctor.id, isPrimary: true, grantedBy: actor.id } },
      },
    });
  });

  await audit({ actorId: actor.id, action: "PATIENT_CREATE", entityType: "Patient", entityId: patient.id, meta: { portal: !!password } });
  return { id: patient.id, mrn: patient.mrn, portalEmail: password ? input.email : null, tempPassword: password };
}
