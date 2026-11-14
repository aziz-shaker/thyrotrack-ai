import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { primaryDoctorUserId, thread } from "@/lib/services/messages";
import { Thread } from "@/components/messages/Thread";

export const dynamic = "force-dynamic";

export default async function PatientMessages() {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { id: session.user.id, role: session.user.role };
  const doctor = await primaryDoctorUserId(actor.id);

  if (!doctor) return <p className="rounded-2xl border border-navy-100 bg-white p-6 text-ink-soft">لا يوجد طبيب مسؤول عن حالتك بعد.</p>;
  const msgs = await thread(actor, doctor.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy-800">اسأل طبيبك</h1>
      <Thread
        meId={actor.id}
        otherId={doctor.id}
        otherName={doctor.name}
        hint="يرد الطبيب خلال أيام العمل. في الحالات الطارئة اتصل بالطوارئ مباشرة."
        initial={msgs.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() }))}
      />
    </div>
  );
}
