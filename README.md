# ThyroTrack AI

Clinical decision support for thyroid nodules. ThyroTrack analyses thyroid ultrasound images, locates the nodule, proposes an ACR TI-RADS classification, and produces a report the doctor reviews, edits and signs. It supports the doctor and does not replace them: no AI result reaches a patient before a doctor has approved it.

> **This is a portfolio project. All data is fictional and the ultrasound images are synthetic.** It is not a medical device and must not be used for real patients. Clinical use would require regulatory clearance (SaMD: SFDA, EDA, FDA or CE).

---

## What it does

| | |
|---|---|
| **AI analysis** | Detects the nodule, segments its boundary, measures it, extracts the ACR TI-RADS features (composition, echogenicity, shape, margin, echogenic foci), scores TI-RADS and suggests FNA or follow-up from size thresholds. Warns about poor image quality, missing calibration and missing views. |
| **Doctor review** | The AI result and the doctor's final decision sit side by side. The doctor can change any feature or the measurements, or drag the nodule outline by hand. The final TI-RADS is recalculated on the server. Modifying or rejecting requires a reason. A signed review is immutable and carries a SHA-256 hash. |
| **Viewer** | Zoom and pan, brightness and contrast, a millimetre caliper, ROI, an AI overlay, manual contour editing and keyboard shortcuts. Accepts DICOM, PNG and JPG. DICOM is converted to PNG and patient tags are dropped. |
| **Follow-up** | Tracks each nodule across studies, plots its volume over time, and alerts on significant growth (ATA: ≥20% in two dimensions and ≥2 mm, or >50% in volume). Includes scheduling and a timeline. |
| **Reports** | Arabic PDF (rendered with headless Chromium) containing the image and outline, the AI-versus-doctor table, the recommendation and the signature. Sent to the patient through the portal plus a secure link that expires after 7 days. |
| **Patient portal** | Plain-language status, a 3D thyroid model showing the nodule coloured by risk, appointments, TSH explained, PDF reports, and messages to the doctor. |
| **Labs** | TSH, FT3, FT4, Anti-TPO and FNA cytology (Bethesda I–VI). Bethesda V or VI alerts the doctors. |

## Architecture

```
thyrotrack-ai/
├── web/                 Next.js 14 (App Router) — UI + REST API + Prisma
│   ├── prisma/          schema.prisma, migrations, seed.ts (fictional demo data)
│   ├── src/lib/         tirads.ts (rules), access.ts (RBAC), services/ (studies, reports, messages, 3D)
│   ├── src/app/api/     thin route handlers → services
│   └── tests/           unit (Jest) + e2e (Playwright)
├── ai-service/          FastAPI — image pipeline (Swagger at :8000/docs)
│   ├── app/pipeline/    preprocess → detect → segment → features → tirads (each stage swappable)
│   └── tests/           pytest on synthetic ultrasound
├── storage/             uploaded images + rendered PDFs (local driver; S3 interface ready)
├── docker-compose.yml   postgres (+ ai + web with --profile full)
└── backup-db.sh         pg_dump backup
```

```
Browser ──► Next.js (RBAC, audit, validation) ──► PostgreSQL
                │
                ├──► AI service (FastAPI): /v1/analyze, /v1/dicom/convert
                └──► Chromium (PDF)
```

**Data flow:** Patient → UltrasoundStudy → UltrasoundImage → AIAnalysisResult (the original output is stored and never changed) → NoduleFinding → DoctorReview (signed) → Report.

## The AI service, honestly

The bundled pipeline is a **classical computer-vision baseline with no trained weights**. It detects hypoechoic regions by comparing each area with its surroundings, rejects acoustic shadows such as the trachea, grows the segmentation to the real edge, and derives the features from intensity statistics. Against synthetic images it finds the nodule within 5% of its true centre and classifies lobe, composition and echogenicity correctly (24 pytest cases).

**Known limits:** it misses iso- and hyperechoic nodules and macrocalcifications, and it underestimates the cranio-caudal length. A trained model is meant to close those gaps. Each stage has a protocol in `app/pipeline/base.py`, so a MONAI U-Net can replace the segmenter by setting `SEGMENTER_BACKEND=torch` and adding weights (see `torch_backend.py`) without changing anything else. Public datasets to start from: TN3K, DDTI, and Stanford AIMI Thyroid Ultrasound Cine-clip.

## Security

- bcrypt passwords, JWT sessions (8 h), login rate limit (5 per 15 min per account).
- Role-based access (Admin, Doctor, Radiologist, Lab tech, Patient) plus row-level patient scoping. A doctor sees only assigned patients, and temporary access grants can expire. Out-of-scope records return 404, not 403.
- Patients see only reports a doctor has signed and sent, and the images from those studies.
- Patient phone numbers are encrypted at the field level with AES-256-GCM. Audit metadata stores IDs only, never names.
- Uploads are checked by magic bytes, limited in size and count, and stored under server-generated keys with path-traversal guards.
- Zod validation on every input, Prisma for queries (no SQL injection), React escaping plus HTML escaping in the PDF template, and security headers (X-Frame-Options, nosniff and others).
- Audit log covers login, failed login, patient and study views, upload, analysis, signature, report send and download, and labs.
- Database backups with `./backup-db.sh`.

## Run it locally

Requirements: Docker Desktop, Node 20+ and Python 3.12.

```bash
# 1. Database
docker compose up -d

# 2. AI service
cd ai-service
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000

# 3. Web app (new terminal)
cd web
cp ../.env.example .env        # then set NEXTAUTH_SECRET and FIELD_ENCRYPTION_KEY (64 hex chars)
npm install
npx playwright install chromium   # used for PDF reports
npx prisma migrate deploy
npm run db:seed                   # fictional data + synthetic ultrasound images
npm run dev                       # http://localhost:3000
```

**Demo accounts** (password `Demo@1234`; the login page has one-click buttons):

| Role | Email |
|---|---|
| Doctor (endocrinology) | dr.sara@thyrotrack.demo |
| Radiologist | dr.omar@thyrotrack.demo |
| Doctor (surgery) | dr.khaled@thyrotrack.demo |
| Lab technician | lab@thyrotrack.demo |
| Patient | patient1@thyrotrack.demo … patient10@thyrotrack.demo |
| Admin | admin@thyrotrack.demo |

**Full stack in containers:** `docker compose --profile full up -d --build`. Secrets are read from `web/.env`. Seed from the host with `npm run db:seed`.

## Tests

```bash
cd web && npm test            # Jest: TI-RADS rules, encryption, upload sniffing, validation (28)
cd web && npm run test:e2e    # Playwright: login, RBAC, calculator, review → sign → send (5)
cd ai-service && .venv/Scripts/python -m pytest   # pipeline + rules on synthetic images (24)
```

## API docs

- Web API: http://localhost:3000/api-docs (OpenAPI at `/api/openapi.json`)
- AI service: http://localhost:8000/docs

## A 5-minute demo

1. Log in as **Doctor**. The dashboard shows what is waiting for review.
2. Go to **الإشاعات → مراجعة** for Salma's study. Zoom, measure, and drag the outline.
3. Change a feature. TI-RADS updates live and the form asks for a reason. Sign the report.
4. **إرسال للمريض**: download the PDF and copy the secure link.
5. Log out, then log in as **Patient 1**. See the plain-language result, the 3D model and the report.
6. Upload a new study (**رفع إشاعة**) to watch the real pipeline run on a new image.

## Not included (next steps)

Admin user management UI, real email/SMS delivery, 2FA, field encryption for more columns, PACS/DICOMweb integration, a trained segmentation model, and ATA/EU-TIRADS as alternative scoring systems.
