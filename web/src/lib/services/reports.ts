/**
 * Reports: build the clinical report (HTML → PDF via headless Chromium), send to the patient
 * with an expiring secure link. A report can only leave the system after the doctor signed it.
 */
import { randomBytes } from "crypto";
import type { Browser } from "playwright-core";
import { db } from "../db";
import { canAccessPatient, type Actor } from "../access";
import { audit } from "../audit";
import { storage } from "../storage";
import { RISK_META } from "../tirads";
import { FEATURE_AR, LOBE_AR, ZONE_AR, RECOMMENDATION_AR, DECISION_AR } from "../labels";
import { HttpError } from "./studies";

const SHARE_DAYS = 7;

const reportInclude = {
  patient: true,
  study: { include: { images: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const } } } },
  review: {
    include: {
      reviewer: { select: { name: true, doctor: { select: { title: true, licenseNumber: true } } } },
      analysis: { include: { findings: true } },
    },
  },
};

export async function loadReport(reportId: string) {
  return db.report.findFirst({ where: { id: reportId, deletedAt: null }, include: reportInclude });
}
type ReportFull = NonNullable<Awaited<ReturnType<typeof loadReport>>>;

/** Staff: patient scope. Patient: own reports, only once sent. */
export async function getReportForActor(actor: Actor, reportId: string) {
  const r = await loadReport(reportId);
  if (!r) throw new HttpError(404, "التقرير غير موجود");
  if (actor.role === "PATIENT") {
    if (r.patient.userId !== actor.id || r.status !== "SENT") throw new HttpError(404, "التقرير غير موجود");
  } else if (!(await canAccessPatient(actor, r.patientId))) {
    throw new HttpError(404, "التقرير غير موجود");
  }
  return r;
}

export async function getReportByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const r = await db.report.findFirst({ where: { shareToken: token, deletedAt: null, status: "SENT" }, include: reportInclude });
  if (!r || !r.shareExpiresAt || r.shareExpiresAt < new Date()) return null;
  return r;
}

// ---------- Send ----------

export async function sendReport(actor: Actor, reportId: string) {
  if (actor.role !== "DOCTOR" && actor.role !== "RADIOLOGIST") throw new HttpError(403, "الإرسال متاح للأطباء فقط");
  const r = await getReportForActor(actor, reportId);
  if (r.status === "DRAFT" || !r.review.signedAt) throw new HttpError(409, "لا يمكن إرسال تقرير قبل اعتماد الطبيب");

  const shareToken = randomBytes(32).toString("base64url");
  const shareExpiresAt = new Date(Date.now() + SHARE_DAYS * 86_400_000);
  const updated = await db.report.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), shareToken, shareExpiresAt } });
  await db.ultrasoundStudy.update({ where: { id: r.studyId }, data: { status: "REPORTED" } });
  if (r.patient.userId) {
    await db.notification.create({
      data: { userId: r.patient.userId, type: "REPORT_READY", title: "تقريرك جاهز", body: "راجع طبيبك نتيجة الإشاعة واعتمد التقرير.", link: "/patient/reports" },
    });
  }
  // Email delivery would be queued here (SMTP not configured in the demo); the secure link is returned instead.
  await audit({ actorId: actor.id, action: "REPORT_SEND", entityType: "Report", entityId: r.id, meta: { expiresAt: shareExpiresAt.toISOString() } });
  return { shareToken, shareExpiresAt: updated.shareExpiresAt };
}

// ---------- PDF ----------

let browserPromise: Promise<Browser> | null = null;
async function browser() {
  if (!browserPromise) {
    const { chromium } = await import("playwright-core");
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      // Serverless: a compressed Chromium build that fits in a function bundle.
      // It unpacks its Amazon Linux 2023 libraries (libnss3…) only when it recognises a Node 20/22 runtime;
      // newer Vercel runtimes use the same AL2023 base, so declare it before the module loads.
      if (!/(20|22)\.x/.test(`${process.env.AWS_EXECUTION_ENV ?? ""}${process.env.AWS_LAMBDA_JS_RUNTIME ?? ""}`)) {
        process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs22.x";
      }
      const serverless = (await import("@sparticuz/chromium")).default;
      browserPromise = chromium.launch({ executablePath: await serverless.executablePath(), args: serverless.args, headless: true });
    } else {
      // Local / Docker: the Chromium installed by `npx playwright install chromium`
      browserPromise = chromium.launch({ args: ["--no-sandbox"] });
    }
    // If Chromium dies (or the serverless instance is recycled), relaunch next time
    browserPromise.then((b) => b.on("disconnected", () => (browserPromise = null))).catch(() => (browserPromise = null));
  }
  return browserPromise;
}

export async function reportPdf(r: ReportFull): Promise<Buffer> {
  // Signed reports are immutable → cache the rendered PDF
  if (r.pdfKey) {
    try {
      return await storage.get(r.pdfKey);
    } catch {
      /* re-render below */
    }
  }
  const html = await reportHtml(r);
  const page = await (await browser()).newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => page.setContent(html, { waitUntil: "load" }));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#8597A2;text-align:center;font-family:sans-serif">ThyroTrack AI · ${r.study.accession} · <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
    });
    const key = `reports/${r.id}.pdf`;
    await storage.put(key, Buffer.from(pdf));
    await db.report.update({ where: { id: r.id }, data: { pdfKey: key } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/**
 * PDF when Chromium is available; otherwise the same report as print-ready HTML that opens the browser's
 * "Save as PDF" dialog — the user always gets the report instead of an error.
 */
export async function reportResponse(r: ReportFull, filename: string): Promise<Response> {
  try {
    const pdf = await reportPdf(r);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    console.error("[report] PDF rendering failed, serving printable HTML", (e as Error).message.slice(0, 300));
    const html = (await reportHtml(r)).replace("</body>", `<script>addEventListener("load",()=>setTimeout(()=>print(),400))</script></body>`);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  }
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Pt = [number, number];

/** Printable report. Everything is escaped; the image is embedded so the PDF is self-contained. */
export async function reportHtml(r: ReportFull): Promise<string> {
  const rv = r.review;
  const f = rv.analysis.findings[0];
  const mod = (rv.modifiedFindings ?? {}) as Partial<{ composition: string; echogenicity: string; shape: string; margin: string; echogenicFoci: string[]; lengthMm: number; widthMm: number; depthMm: number; volumeMl: number; contour: Pt[] }>;
  const img = r.study.images.find((i) => i.id === f?.imageId) ?? r.study.images[0];
  let imgData = "";
  if (img) {
    try {
      imgData = `data:${img.mimeType};base64,${(await storage.get(img.storageKey)).toString("base64")}`;
    } catch {
      /* image missing → report still renders */
    }
  }
  const age = Math.floor((Date.now() - r.patient.dateOfBirth.getTime()) / (365.25 * 86_400_000));
  const risk = rv.finalRisk ? RISK_META[rv.finalRisk] : null;
  const contour = (mod.contour ?? (f?.contour as Pt[] | undefined)) ?? [];
  const aspect = img?.width && img?.height ? img.height / img.width : 0.75;
  const dims = f ? { l: mod.lengthMm ?? f.lengthMm, w: mod.widthMm ?? f.widthMm, d: mod.depthMm ?? f.depthMm, v: mod.volumeMl ?? f.volumeMl } : null;
  const feat = (k: "composition" | "echogenicity" | "shape" | "margin") => {
    const final = (mod[k] ?? f?.[k]) as string;
    const ai = f?.[k] as string;
    const map = FEATURE_AR[k] as Record<string, string>;
    return `<tr><td>${esc({ composition: "التركيب", echogenicity: "الصدى", shape: "الشكل", margin: "الحواف" }[k])}</td><td>${esc(map[ai])}</td><td class="${final !== ai ? "chg" : ""}">${esc(map[final])}</td></tr>`;
  };
  const fociMap = FEATURE_AR.echogenicFoci as Record<string, string>;
  const fociAi = (f?.echogenicFoci ?? []).map((x) => fociMap[x]).join("، ");
  const fociFinal = (mod.echogenicFoci ?? f?.echogenicFoci ?? []).map((x) => fociMap[x]).join("، ");
  const fmt = (d: Date) => d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box} body{font-family:"Readex Pro",Tahoma,sans-serif;color:#0A2D40;font-size:11.5px;line-height:1.7;margin:0}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0A3D57;padding-bottom:10px}
.brand{font-weight:700;font-size:18px;color:#0A3D57}.brand small{display:block;font-weight:400;font-size:10px;color:#4E6472}
h1{font-size:17px;margin:0;color:#0A3D57} h2{font-size:13px;color:#0A3D57;margin:18px 0 6px;border-bottom:1px solid #DCE7ED;padding-bottom:3px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px;margin-top:10px}.grid div span{display:block;color:#8597A2;font-size:9.5px}
table{width:100%;border-collapse:collapse} td,th{padding:5px 8px;border-bottom:1px solid #EEF4F7;text-align:right;vertical-align:top} th{background:#EEF4F7;font-weight:600;font-size:10.5px}
.chg{background:#FEF3C7;font-weight:600} .ltr{direction:ltr;unicode-bidi:isolate}
.figure{display:grid;grid-template-columns:1.15fr 1fr;gap:14px;align-items:start}
.img{position:relative;width:100%;padding-top:${(aspect * 100).toFixed(2)}%;background:#000;border-radius:6px;overflow:hidden}
.img img,.img svg{position:absolute;inset:0;width:100%;height:100%}
.verdict{border:2px solid #0A3D57;border-radius:8px;padding:10px 12px}
.tr{display:inline-block;font-weight:700;font-size:20px;color:#0A3D57}
.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-weight:600;font-size:11px}
.sign{margin-top:18px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}
.hash{font-family:monospace;font-size:8px;color:#8597A2;word-break:break-all;direction:ltr}
.disc{margin-top:14px;padding:8px 10px;background:#EEF4F7;border-radius:6px;font-size:9.5px;color:#4E6472}
</style></head><body>
<div class="head"><div class="brand">ثايرو تراك <span class="ltr">ThyroTrack AI</span><small>تقرير سونار الغدة الدرقية</small></div>
<div style="text-align:left"><h1>تقرير طبي معتمد</h1><div class="ltr" style="color:#4E6472">${esc(r.study.accession)}</div></div></div>

<div class="grid">
<div><span>المريض</span>${esc(r.patient.fullName)}</div>
<div><span>رقم الملف</span><b class="ltr">${esc(r.patient.mrn)}</b></div>
<div><span>العمر / الجنس</span>${age} سنة، ${r.patient.sex === "FEMALE" ? "أنثى" : "ذكر"}</div>
<div><span>تاريخ الفحص</span>${fmt(r.study.studyDate)}</div>
<div><span>الجهاز</span><span class="ltr">${esc(r.study.device ?? "—")}</span></div>
<div style="grid-column:span 3"><span>سبب الفحص</span>${esc(r.study.indication ?? "—")}</div>
</div>

${
  f
    ? `<h2>صورة الإشاعة وتحديد العقدة</h2>
<div class="figure">
<div class="img">${imgData ? `<img src="${imgData}">` : ""}
<svg viewBox="0 0 1 1" preserveAspectRatio="none"><polygon points="${contour.map((p) => `${+p[0]},${+p[1]}`).join(" ")}" fill="rgba(14,159,220,.18)" stroke="#2DB2E8" stroke-width="0.004"/></svg></div>
<div class="verdict">
<div style="color:#4E6472">التصنيف النهائي (ACR TI-RADS)</div>
${rv.finalTirads ? `<span class="tr ltr">TR${rv.finalTirads}</span> &nbsp; <span class="pill" style="background:#EEF4F7">${esc(risk?.ar)}</span>` : `<b>رُفضت نتيجة الذكاء الاصطناعي</b>`}
<table style="margin-top:8px">
<tr><td>الموقع</td><td>${esc(LOBE_AR[f.lobe])}، ${esc(ZONE_AR[f.zone])}${f.nearCapsule ? "، قريبة من الغلاف" : ""}</td></tr>
<tr><td>الأبعاد</td><td class="ltr">${dims!.l} × ${dims!.w} × ${dims!.d} mm</td></tr>
<tr><td>الحجم التقريبي</td><td class="ltr">${dims!.v} ml</td></tr>
<tr><td>التوصية</td><td><b>${esc(RECOMMENDATION_AR[rv.recommendation])}</b></td></tr>
</table></div></div>

<h2>صفات العقدة: نتيجة الذكاء الاصطناعي وقرار الطبيب</h2>
<table><tr><th>الخاصية</th><th>نتيجة AI (مقترحة)</th><th>قرار الطبيب (نهائي)</th></tr>
${feat("composition")}${feat("echogenicity")}${feat("shape")}${feat("margin")}
<tr><td>البؤر الصدوية</td><td>${esc(fociAi)}</td><td class="${fociAi !== fociFinal ? "chg" : ""}">${esc(fociFinal)}</td></tr>
<tr><td>ACR TI-RADS</td><td class="ltr">TR${f.tiradsLevel} (${f.tiradsPoints} pts)</td><td class="ltr">${rv.finalTirads ? `TR${rv.finalTirads}` : "—"}</td></tr>
<tr><td>ثقة النظام</td><td class="ltr">${Math.round(f.confidence * 100)}%</td><td></td></tr>
</table>`
    : `<h2>النتيجة</h2><p>لم يحدد النظام عقدة في الصور المرفوعة.</p>`
}

<h2>رأي الطبيب</h2>
<p><b>القرار:</b> ${esc(DECISION_AR[rv.decision])}${rv.changeReason ? `، <b>السبب:</b> ${esc(rv.changeReason)}` : ""}</p>
<p>${esc(rv.clinicalNotes ?? "لا توجد ملاحظات إضافية.")}</p>

<div class="sign"><div>
<div style="color:#4E6472">اعتمده ووقّعه إلكترونيًا</div>
<b style="font-size:13px">${esc(rv.reviewer.name)}</b><br>${esc(rv.reviewer.doctor?.title ?? "")} ${rv.reviewer.doctor?.licenseNumber ? `<span class="ltr">(${esc(rv.reviewer.doctor.licenseNumber)})</span>` : ""}<br>
${rv.signedAt ? rv.signedAt.toLocaleString("ar-EG", { dateStyle: "long", timeStyle: "short" }) : ""}
</div><div style="max-width:52%"><div class="hash">SHA-256 ${esc(rv.signatureHash)}</div></div></div>

<div class="disc">النتائج المقترحة من الذكاء الاصطناعي أداة مساعدة وليست تشخيصًا. دقتها تعتمد على جودة الصورة واختيار المنطقة ونوع الجهاز، وقد تقل في التهاب هاشيموتو أو التغيرات غير العقدية. القرار النهائي للطبيب المعالج. <span class="ltr">Model: ${esc(rv.analysis.modelVersion)}</span></div>
</body></html>`;
}
