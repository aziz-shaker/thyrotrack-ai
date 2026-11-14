import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ShieldCheck, Bot, AlertTriangle, Info } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessPatient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { RISK_META } from "@/lib/tirads";
import { DECISION_AR, RECOMMENDATION_AR, STUDY_STATUS_AR, LOBE_AR, ZONE_AR, FEATURE_AR } from "@/lib/labels";
import { StudyWorkspace } from "@/components/study/StudyWorkspace";
import { AnalyzeButton } from "@/components/study/AnalyzeButton";
import { ReportActions } from "@/components/study/ReportActions";
import type { FindingDTO } from "@/components/study/ReviewPanel";
import type { Overlay, Pt } from "@/components/viewer/ImageViewer";

export const dynamic = "force-dynamic";

const RISK_COLOR = { BENIGN: "#22C55E", LOW: "#22C55E", MODERATE: "#EAB308", HIGH: "#F97316", SUSPICIOUS: "#EF4444" } as const;

export default async function StudyPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { id: session.user.id, role: session.user.role };
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const study = await db.ultrasoundStudy.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      patient: { select: { id: true, fullName: true, mrn: true } },
      images: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      reports: { where: { deletedAt: null }, take: 1 },
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { findings: true, review: { include: { reviewer: { select: { name: true } } } } },
      },
    },
  });
  if (!study || !(await canAccessPatient(actor, study.patientId))) notFound();
  await audit({ actorId: actor.id, action: "STUDY_VIEW", entityType: "UltrasoundStudy", entityId: study.id });

  const analysis = study.analyses[0];
  const finding = analysis?.findings[0] ?? null;
  const review = analysis?.review ?? null;
  const canReview = actor.role === "DOCTOR" || actor.role === "RADIOLOGIST";

  // Overlay: doctor-modified contour wins over the AI one after signing
  const mod = (review?.modifiedFindings ?? null) as { contour?: Pt[] } | null;
  const overlays: Overlay[] =
    analysis?.findings
      .filter((f) => f.imageId)
      .map((f) => ({
        imageId: f.imageId!,
        contour: (mod?.contour ?? (f.contour as Pt[])) as Pt[],
        bbox: f.bbox as Overlay["bbox"],
        label: `TR${review?.finalTirads ?? f.tiradsLevel}`,
        color: RISK_COLOR[review?.finalRisk ?? f.risk],
      })) ?? [];

  const images = study.images.map((i) => ({ id: i.id, view: i.view, width: i.width, height: i.height, pixelSpacingMm: i.pixelSpacingMm }));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm font-semibold text-ink-soft" aria-label="مسار التنقل">
        <Link href="/doctor/patients" className="hover:text-brand-600">المرضى</Link>
        <ChevronLeft className="h-4 w-4" />
        <Link href={`/doctor/patients/${study.patient.id}`} className="hover:text-brand-600">{study.patient.fullName}</Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">إشاعة سونار الغدة الدرقية</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {study.studyDate.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}، رقم الفحص{" "}
            <span dir="ltr">{study.accession}</span>
            {study.device ? `، جهاز ${study.device}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-navy-50 px-3 py-1.5 text-sm font-semibold text-navy-800">{STUDY_STATUS_AR[study.status]}</span>
      </header>

      <StudyWorkspace
        images={images}
        overlays={overlays}
        review={
          analysis && !review && canReview
            ? {
                analysisId: analysis.id,
                finding: finding ? (JSON.parse(JSON.stringify(finding)) as FindingDTO) : null,
                findingImageId: finding?.imageId ?? null,
                aiContour: finding ? (finding.contour as Pt[]) : null,
              }
            : undefined
        }
        side={
          <>
            {!analysis && canReview && <AnalyzeButton studyId={study.id} imageCount={images.length} />}
            {!analysis && !canReview && <Notice>لم يتم تحليل هذه الإشاعة بعد.</Notice>}

            {analysis && (
              <section className="rounded-2xl border border-navy-100 bg-white p-5">
                <h2 className="flex items-center gap-2 font-bold text-navy-800"><Bot className="h-5 w-5 text-brand-500" /> نتيجة مقترحة من الذكاء الاصطناعي</h2>
                <p className="mt-1 text-sm text-ink-soft">ليست تشخيصًا نهائيًا. دقتها تعتمد على جودة الصورة ونوع الجهاز، وقد تقل في التهاب هاشيموتو أو التغيرات غير العقدية.</p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <Kv k="جودة الصورة" v={analysis.imageQuality != null ? `${Math.round(analysis.imageQuality * 100)}%` : "—"} />
                  <Kv k="زمن التحليل" v={analysis.durationMs != null ? `${(analysis.durationMs / 1000).toFixed(1)} ث` : "—"} />
                  <Kv k="عدد العقد" v={String(analysis.findings.length)} />
                </dl>
                {analysis.warnings.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {analysis.warnings.map((w, i) => (
                      <li key={i} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900" dir="auto">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-ink-muted" dir="ltr">{analysis.modelVersion}</p>
              </section>
            )}

            {review && finding && (
              <section className="rounded-2xl border-2 border-navy-800 bg-white p-5">
                <h2 className="flex items-center gap-2 font-bold text-navy-800"><ShieldCheck className="h-5 w-5 text-green-600" /> التقرير معتمد</h2>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <Row k="القرار" v={DECISION_AR[review.decision]} />
                  <Row k="التصنيف" v={review.finalTirads ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${RISK_META[review.finalRisk!].bg} ${RISK_META[review.finalRisk!].color}`}><span dir="ltr">TR{review.finalTirads}</span>، {RISK_META[review.finalRisk!].ar}</span> : "مرفوض"} />
                  <Row k="نتيجة AI الأصلية" v={<span dir="ltr">TR{finding.tiradsLevel}</span>} />
                  <Row k="الموقع" v={`${LOBE_AR[finding.lobe]}، ${ZONE_AR[finding.zone]}`} />
                  <Row k="الصفات" v={`${FEATURE_AR.composition[finding.composition]}، ${FEATURE_AR.echogenicity[finding.echogenicity]}`} />
                  <Row k="التوصية" v={RECOMMENDATION_AR[review.recommendation]} />
                  {review.changeReason && <Row k="سبب التعديل" v={review.changeReason} />}
                  {review.clinicalNotes && <Row k="ملاحظات" v={review.clinicalNotes} />}
                  <Row k="وقّعه" v={`${review.reviewer.name}، ${review.signedAt?.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}`} />
                </dl>
                <p className="mt-4 break-all rounded-lg bg-navy-50 p-2.5 text-[11px] text-ink-soft" dir="ltr" title="SHA-256 signature hash">
                  SHA-256 {review.signatureHash}
                </p>
                {study.reports[0] && canReview && (
                  <div className="mt-4">
                    <ReportActions
                      reportId={study.reports[0].id}
                      status={study.reports[0].status}
                      shareToken={study.reports[0].shareToken}
                      shareExpiresAt={study.reports[0].shareExpiresAt?.toISOString() ?? null}
                    />
                  </div>
                )}
              </section>
            )}

            {analysis && !review && !canReview && <Notice>النتيجة بانتظار مراجعة الطبيب.</Notice>}
          </>
        }
      />
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-navy-50 p-2.5">
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className="mt-0.5 font-semibold text-navy-800" dir="auto">{v}</dd>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-navy-800">{v}</dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="flex gap-2 rounded-2xl border border-navy-100 bg-white p-5 text-sm text-ink-soft"><Info className="h-4 w-4 shrink-0" /> {children}</p>;
}
