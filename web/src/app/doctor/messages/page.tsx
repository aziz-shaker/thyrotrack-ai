import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { thread } from "@/lib/services/messages";
import { Thread } from "@/components/messages/Thread";
import { EmptyState } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function DoctorMessages({ searchParams }: { searchParams: { with?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { id: session.user.id, role: session.user.role };
  if (actor.role !== "DOCTOR" && actor.role !== "RADIOLOGIST") {
    return <EmptyState text="المراسلة متاحة بين المريض وطبيبه المعالج فقط." />;
  }
  const scope = await patientScope(actor);

  const patients = await db.patient.findMany({
    where: { AND: [scope, { userId: { not: null } }] },
    select: { fullName: true, userId: true },
    orderBy: { fullName: "asc" },
  });
  const userIds = patients.map((p) => p.userId!);
  const [lastMsgs, unread] = await Promise.all([
    db.message.findMany({
      where: { OR: [{ senderId: { in: userIds }, recipientId: actor.id }, { senderId: actor.id, recipientId: { in: userIds } }] },
      orderBy: { createdAt: "desc" },
      select: { senderId: true, recipientId: true, body: true, createdAt: true },
    }),
    db.message.groupBy({ by: ["senderId"], where: { recipientId: actor.id, readAt: null, senderId: { in: userIds } }, _count: true }),
  ]);
  const last = new Map<string, { body: string; createdAt: Date }>();
  for (const m of lastMsgs) {
    const other = m.senderId === actor.id ? m.recipientId : m.senderId;
    if (!last.has(other)) last.set(other, m);
  }
  const unreadMap = new Map(unread.map((u) => [u.senderId, u._count]));
  const convs = patients
    .filter((p) => last.has(p.userId!))
    .sort((a, b) => last.get(b.userId!)!.createdAt.getTime() - last.get(a.userId!)!.createdAt.getTime());

  const active = patients.find((p) => p.userId === searchParams.with) ?? convs[0];
  const msgs = active ? await thread(actor, active.userId!) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-800">الرسائل</h1>
      {convs.length === 0 && !active ? (
        <EmptyState text="لا توجد رسائل من المرضى بعد." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <ul className="h-fit overflow-hidden rounded-2xl border border-navy-100 bg-white">
            {convs.map((p) => (
              <li key={p.userId}>
                <Link href={`/doctor/messages?with=${p.userId}`} className={clsx("block border-b border-navy-50 px-4 py-3", active?.userId === p.userId ? "bg-navy-50" : "hover:bg-navy-50/50")}>
                  <span className="flex items-center justify-between gap-2">
                    <b className="text-sm text-navy-800">{p.fullName}</b>
                    {(unreadMap.get(p.userId!) ?? 0) > 0 && <span className="rounded-full bg-coral-500 px-2 text-xs text-white">{unreadMap.get(p.userId!)}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">{last.get(p.userId!)!.body}</span>
                </Link>
              </li>
            ))}
          </ul>
          {active && (
            <Thread
              key={active.userId}
              meId={actor.id}
              otherId={active.userId!}
              otherName={active.fullName}
              initial={msgs.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
