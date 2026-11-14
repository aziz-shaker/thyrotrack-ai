import { db } from "../db";
import { canAccessPatient, type Actor } from "../access";
import { HttpError } from "./studies";

/**
 * In-app messaging. A patient can only write to their assigned doctors;
 * a clinician can only write to patients within their access scope.
 */
export async function allowedCounterpart(actor: Actor, otherUserId: string): Promise<boolean> {
  // Messaging is strictly patient ↔ treating clinician (no admin / lab staff)
  if (actor.role !== "PATIENT" && actor.role !== "DOCTOR" && actor.role !== "RADIOLOGIST") return false;
  if (actor.role === "PATIENT") {
    const n = await db.patientAssignment.count({
      where: { patient: { userId: actor.id }, doctor: { userId: otherUserId }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    return n > 0;
  }
  const patient = await db.patient.findUnique({ where: { userId: otherUserId }, select: { id: true } });
  return !!patient && (await canAccessPatient(actor, patient.id));
}

export async function primaryDoctorUserId(patientUserId: string) {
  const a = await db.patientAssignment.findFirst({
    where: { patient: { userId: patientUserId }, isPrimary: true },
    select: { doctor: { select: { userId: true, user: { select: { name: true } } } } },
  });
  return a ? { id: a.doctor.userId, name: a.doctor.user.name } : null;
}

export async function thread(actor: Actor, otherUserId: string) {
  if (!(await allowedCounterpart(actor, otherUserId))) throw new HttpError(404, "المحادثة غير موجودة");
  const msgs = await db.message.findMany({
    where: { OR: [{ senderId: actor.id, recipientId: otherUserId }, { senderId: otherUserId, recipientId: actor.id }] },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  await db.message.updateMany({ where: { senderId: otherUserId, recipientId: actor.id, readAt: null }, data: { readAt: new Date() } });
  return msgs;
}

export async function send(actor: Actor, recipientId: string, body: string) {
  if (!(await allowedCounterpart(actor, recipientId))) throw new HttpError(404, "المستلم غير موجود");
  const msg = await db.message.create({ data: { senderId: actor.id, recipientId, body } });
  await db.notification.create({
    data: {
      userId: recipientId,
      type: "MESSAGE",
      title: actor.role === "PATIENT" ? "رسالة جديدة من مريض" : "رسالة جديدة من طبيبك",
      body: body.length > 80 ? `${body.slice(0, 80)}…` : body,
      link: actor.role === "PATIENT" ? `/doctor/messages?with=${actor.id}` : "/patient/messages",
    },
  });
  return msg;
}
