/** OpenAPI 3.1 description of the web API (served at /api/openapi.json, rendered at /api-docs). */
const err = { $ref: "#/components/responses/Error" };
const id = (name = "id") => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" } });
const json = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "ThyroTrack AI — Web API",
    version: "1.0.0",
    description:
      "Clinical decision support for thyroid nodules. Session cookie auth (NextAuth). All patient data is row-level scoped: doctors see assigned patients only; patients see their own sent reports only. Every sensitive action is written to the audit log.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "next-auth.session-token" } },
    responses: {
      Error: { description: "Error", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } } } } } },
    },
    schemas: {
      Features: {
        type: "object",
        properties: {
          composition: { enum: ["CYSTIC", "SPONGIFORM", "MIXED", "SOLID"] },
          echogenicity: { enum: ["ANECHOIC", "HYPERECHOIC", "ISOECHOIC", "HYPOECHOIC", "VERY_HYPOECHOIC"] },
          shape: { enum: ["WIDER_THAN_TALL", "TALLER_THAN_WIDE"] },
          margin: { enum: ["SMOOTH", "ILL_DEFINED", "LOBULATED", "EXTRATHYROIDAL"] },
          echogenicFoci: { type: "array", items: { enum: ["NONE", "COMET_TAIL", "MACRO", "RIM", "PUNCTATE"] } },
        },
      },
    },
  },
  security: [{ session: [] }],
  paths: {
    "/api/auth/callback/credentials": {
      post: { tags: ["auth"], summary: "Log in (email + password, rate-limited 5/15min)", security: [], responses: { 302: { description: "Session cookie set" } } },
    },
    "/api/patients/{id}/studies": {
      post: {
        tags: ["imaging"],
        summary: "Create an ultrasound study",
        parameters: [id()],
        requestBody: json({ type: "object", required: ["studyDate"], properties: { studyDate: { type: "string", format: "date" }, indication: { type: "string" }, device: { type: "string" } } }),
        responses: { 201: { description: "Study created" }, 400: err, 403: err, 404: err },
      },
    },
    "/api/studies/{id}/images": {
      post: {
        tags: ["imaging"],
        summary: "Upload images (DICOM/PNG/JPG, ≤15 MB, ≤8 per study). Type checked by magic bytes; DICOM converted to PNG and patient tags dropped.",
        parameters: [id()],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  files: { type: "array", items: { type: "string", format: "binary" } },
                  views: { type: "array", items: { enum: ["TRANSVERSE", "SAGITTAL", "UNKNOWN"] } },
                  pixelSpacing: { type: "array", items: { type: "number" }, description: "mm per pixel (manual calibration)" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Images stored" }, 409: err, 413: err, 415: err },
      },
    },
    "/api/studies/{id}/analyze": {
      post: { tags: ["analysis"], summary: "Run AI analysis (detection → segmentation → features → ACR TI-RADS)", parameters: [id()], responses: { 201: { description: "Analysis stored (original AI output kept immutable)" }, 409: err, 502: err } },
    },
    "/api/analysis/{id}/review": {
      post: {
        tags: ["analysis"],
        summary: "Doctor confirms / modifies / rejects the AI result and signs (one-time, immutable). Final TI-RADS is recomputed server-side.",
        parameters: [id()],
        requestBody: json({
          type: "object",
          required: ["decision", "recommendation"],
          properties: {
            decision: { enum: ["CONFIRMED", "MODIFIED", "REJECTED"] },
            features: { $ref: "#/components/schemas/Features" },
            dimensions: { type: "object", properties: { lengthMm: { type: "number" }, widthMm: { type: "number" }, depthMm: { type: "number" } } },
            contour: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 } },
            recommendation: { enum: ["ROUTINE_FOLLOW_UP", "US_FOLLOW_UP", "FNA", "ADDITIONAL_IMAGING", "LAB_TESTS", "SURGICAL_REFERRAL", "NO_ACTION"] },
            clinicalNotes: { type: "string" },
            changeReason: { type: "string", description: "Required unless CONFIRMED" },
          },
        }),
        responses: { 201: { description: "Signed review with SHA-256 signature hash" }, 400: err, 409: err },
      },
    },
    "/api/reports/{id}/pdf": { get: { tags: ["reports"], summary: "Report PDF (staff in scope, or the patient once sent)", parameters: [id()], responses: { 200: { description: "application/pdf" }, 404: err } } },
    "/api/reports/{id}/send": { post: { tags: ["reports"], summary: "Send a signed report to the patient (portal + 7-day secure link)", parameters: [id()], responses: { 200: { description: "Share token + expiry" }, 409: err } } },
    "/api/share/{token}/pdf": { get: { tags: ["reports"], summary: "Public expiring report link (256-bit token)", security: [], parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "application/pdf" }, 404: err } } },
    "/api/patients/{id}/3d-model": { get: { tags: ["patients"], summary: "Nodule positions, sizes and risk over time for the 3D thyroid", parameters: [id()], responses: { 200: { description: "Nodules with history" } } } },
    "/api/patients/{id}/labs": {
      post: {
        tags: ["patients"],
        summary: "Enter a lab or FNA cytology result (Bethesda V/VI alerts the doctors)",
        parameters: [id()],
        requestBody: json({ type: "object", required: ["type", "takenAt"], properties: { type: { enum: ["TSH", "FT3", "FT4", "ANTI_TPO", "THYROGLOBULIN", "CALCITONIN", "FNA_CYTOLOGY"] }, value: { type: "number" }, bethesda: { type: "integer", minimum: 1, maximum: 6 }, takenAt: { type: "string", format: "date" } } }),
        responses: { 201: { description: "Created" }, 403: err },
      },
    },
    "/api/follow-ups": {
      post: { tags: ["follow-ups"], summary: "Schedule a follow-up (notifies the patient)", requestBody: json({ type: "object", required: ["patientId", "scheduledAt", "reason"], properties: { patientId: { type: "string", format: "uuid" }, scheduledAt: { type: "string", format: "date-time" }, reason: { type: "string" } } }), responses: { 201: { description: "Created" } } },
    },
    "/api/follow-ups/{id}": { patch: { tags: ["follow-ups"], summary: "Mark completed / missed / cancelled", parameters: [id()], requestBody: json({ type: "object", properties: { status: { enum: ["COMPLETED", "MISSED", "CANCELLED"] } } }), responses: { 200: { description: "Updated" } } } },
    "/api/messages": {
      get: { tags: ["messages"], summary: "Conversation thread", parameters: [{ name: "with", in: "query", schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Messages" } } },
      post: { tags: ["messages"], summary: "Send a message (patient ↔ assigned doctor only)", requestBody: json({ type: "object", required: ["body"], properties: { recipientId: { type: "string", format: "uuid" }, body: { type: "string", maxLength: 2000 } } }), responses: { 201: { description: "Sent" } } },
    },
    "/api/images/{id}": { get: { tags: ["imaging"], summary: "Serve an ultrasound image (access-checked)", parameters: [id()], responses: { 200: { description: "image/png or image/jpeg" }, 404: err } } },
  },
} as const;
