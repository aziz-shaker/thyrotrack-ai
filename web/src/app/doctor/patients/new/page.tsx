import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { NewPatientForm } from "./NewPatientForm";

export const metadata = { title: "إضافة مريض | ThyroTrack AI" };

export default async function NewPatientPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "DOCTOR" && session.user.role !== "RADIOLOGIST") redirect("/doctor/patients");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/doctor/patients" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-brand-600">
        المرضى <ChevronLeft className="h-4 w-4" />
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-navy-800">إضافة مريض</h1>
        <p className="mt-1 text-ink-soft">سيُسند المريض إليك تلقائيًا ويظهر في قائمة مرضاك.</p>
      </div>
      <NewPatientForm />
    </div>
  );
}
