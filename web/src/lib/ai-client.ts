/** Typed client for the Python AI service (ai-service/app/schemas.py). */
const BASE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const TOKEN = process.env.AI_SERVICE_TOKEN ?? "";

export interface AiNodule {
  image_index: number;
  lobe: "RIGHT" | "LEFT" | "ISTHMUS";
  zone: "UPPER" | "MIDDLE" | "LOWER";
  near_capsule: boolean;
  bbox: { x: number; y: number; w: number; h: number };
  contour: [number, number][];
  length_mm: number;
  width_mm: number;
  depth_mm: number;
  volume_ml: number;
  composition: "CYSTIC" | "SPONGIFORM" | "MIXED" | "SOLID";
  echogenicity: "ANECHOIC" | "HYPERECHOIC" | "ISOECHOIC" | "HYPOECHOIC" | "VERY_HYPOECHOIC";
  shape: "WIDER_THAN_TALL" | "TALLER_THAN_WIDE";
  margin: "SMOOTH" | "ILL_DEFINED" | "LOBULATED" | "EXTRATHYROIDAL";
  echogenic_foci: ("NONE" | "COMET_TAIL" | "MACRO" | "RIM" | "PUNCTATE")[];
  tirads_points: number;
  tirads_level: number;
  risk: "BENIGN" | "LOW" | "MODERATE" | "HIGH" | "SUSPICIOUS";
  malignancy_prob: number;
  confidence: number;
  suggested_action: "FNA" | "US_FOLLOW_UP" | "NO_ACTION";
  explanation: { feature: string; value: string; points: number; reason: string }[];
}

export interface AiAnalyzeResponse {
  model_version: string;
  image_quality: number;
  duration_ms: number;
  warnings: string[];
  nodules: AiNodule[];
  disclaimer: string;
}

export class AiServiceError extends Error {}

async function call<T>(path: string, form: FormData, timeoutMs = 60_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      body: form,
      headers: TOKEN ? { "X-Service-Token": TOKEN } : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AiServiceError("خدمة الذكاء الاصطناعي غير متاحة حاليًا. تأكد من تشغيلها ثم أعد المحاولة.");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new AiServiceError(typeof detail?.detail === "string" ? detail.detail : `AI service error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function analyzeImages(images: { data: Buffer; name: string; view: string; pixelSpacingMm: number | null }[]) {
  const form = new FormData();
  for (const img of images) form.append("images", new Blob([new Uint8Array(img.data)]), img.name);
  form.append("meta", JSON.stringify(images.map((i) => ({ view: i.view, pixel_spacing_mm: i.pixelSpacingMm }))));
  return call<AiAnalyzeResponse>("/v1/analyze", form);
}

export function convertDicom(data: Buffer) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)]), "image.dcm");
  return call<{ png_base64: string; width: number; height: number; pixel_spacing_mm: number | null; warnings: string[] }>(
    "/v1/dicom/convert",
    form,
  );
}
