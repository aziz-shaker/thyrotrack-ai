import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

export default async function NewStudyPage({ searchParams }: { searchParams: { patient?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DOCTOR" && session.user.role !== "RADIOLOGIST") redirect("/doctor/studies");
  const scope = await patientScope({ id: session.user.id, role: session.user.role });
  const patients = await db.patient.findMany({ where: scope, select: { id: true, fullName: true, mrn: true }, orderBy: { fullName: "asc" } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">رفع إشاعة جديدة</h1>
        <p className="mt-1 text-ink-soft">ارفع صور السونار، ويفضَّل مقطع عرضي وآخر طولي لنفس العقدة لقياس أدق.</p>
      </div>
      <UploadForm patients={patients} defaultPatientId={patients.some((p) => p.id === searchParams.patient) ? searchParams.patient! : ""} />
    </div>
  );
}
