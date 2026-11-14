-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DOCTOR', 'RADIOLOGIST', 'LAB_TECH', 'PATIENT');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'ANALYZED', 'REVIEWED', 'REPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImageView" AS ENUM ('TRANSVERSE', 'SAGITTAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Lobe" AS ENUM ('RIGHT', 'LEFT', 'ISTHMUS');

-- CreateEnum
CREATE TYPE "LobeZone" AS ENUM ('UPPER', 'MIDDLE', 'LOWER');

-- CreateEnum
CREATE TYPE "Composition" AS ENUM ('CYSTIC', 'SPONGIFORM', 'MIXED', 'SOLID');

-- CreateEnum
CREATE TYPE "Echogenicity" AS ENUM ('ANECHOIC', 'HYPERECHOIC', 'ISOECHOIC', 'HYPOECHOIC', 'VERY_HYPOECHOIC');

-- CreateEnum
CREATE TYPE "Shape" AS ENUM ('WIDER_THAN_TALL', 'TALLER_THAN_WIDE');

-- CreateEnum
CREATE TYPE "Margin" AS ENUM ('SMOOTH', 'ILL_DEFINED', 'LOBULATED', 'EXTRATHYROIDAL');

-- CreateEnum
CREATE TYPE "EchogenicFoci" AS ENUM ('NONE', 'COMET_TAIL', 'MACRO', 'RIM', 'PUNCTATE');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('BENIGN', 'LOW', 'MODERATE', 'HIGH', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('CONFIRMED', 'MODIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('ROUTINE_FOLLOW_UP', 'US_FOLLOW_UP', 'FNA', 'ADDITIONAL_IMAGING', 'LAB_TESTS', 'SURGICAL_REFERRAL', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabType" AS ENUM ('TSH', 'FT3', 'FT4', 'ANTI_TPO', 'THYROGLOBULIN', 'CALCITONIN', 'FNA_CYTOLOGY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('HIGH_RISK', 'GROWTH_ALERT', 'ANALYSIS_DONE', 'REPORT_READY', 'FOLLOW_UP', 'MESSAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "specialty" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientAssignment" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "grantedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "mrn" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "phoneEnc" TEXT,
    "email" TEXT,
    "medicalHistory" TEXT,
    "familyHistory" TEXT,
    "medications" TEXT,
    "allergies" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UltrasoundStudy" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "orderedById" UUID,
    "accession" TEXT NOT NULL,
    "studyDate" TIMESTAMP(3) NOT NULL,
    "device" TEXT,
    "indication" TEXT,
    "status" "StudyStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UltrasoundStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UltrasoundImage" (
    "id" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "pixelSpacingMm" DOUBLE PRECISION,
    "view" "ImageView" NOT NULL DEFAULT 'UNKNOWN',
    "isDicom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UltrasoundImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nodule" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "lobe" "Lobe" NOT NULL,
    "zone" "LobeZone" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nodule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysisResult" (
    "id" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "imageQuality" DOUBLE PRECISION,
    "warnings" TEXT[],
    "rawOutput" JSONB NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoduleFinding" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "noduleId" UUID,
    "imageId" UUID,
    "lobe" "Lobe" NOT NULL,
    "zone" "LobeZone" NOT NULL,
    "nearCapsule" BOOLEAN NOT NULL DEFAULT false,
    "bbox" JSONB NOT NULL,
    "contour" JSONB NOT NULL,
    "lengthMm" DOUBLE PRECISION NOT NULL,
    "widthMm" DOUBLE PRECISION NOT NULL,
    "depthMm" DOUBLE PRECISION NOT NULL,
    "volumeMl" DOUBLE PRECISION NOT NULL,
    "composition" "Composition" NOT NULL,
    "echogenicity" "Echogenicity" NOT NULL,
    "shape" "Shape" NOT NULL,
    "margin" "Margin" NOT NULL,
    "echogenicFoci" "EchogenicFoci"[],
    "tiradsPoints" INTEGER NOT NULL,
    "tiradsLevel" INTEGER NOT NULL,
    "risk" "RiskCategory" NOT NULL,
    "malignancyProb" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoduleFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorReview" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "finalTirads" INTEGER,
    "finalRisk" "RiskCategory",
    "recommendation" "Recommendation" NOT NULL,
    "clinicalNotes" TEXT,
    "changeReason" TEXT,
    "modifiedFindings" JSONB,
    "signedAt" TIMESTAMP(3),
    "signatureHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfKey" TEXT,
    "shareToken" TEXT,
    "shareExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "enteredById" UUID,
    "type" "LabType" NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "bethesda" INTEGER,
    "notes" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientAssignment_doctorId_patientId_key" ON "PatientAssignment"("doctorId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "UltrasoundStudy_accession_key" ON "UltrasoundStudy"("accession");

-- CreateIndex
CREATE INDEX "UltrasoundStudy_patientId_studyDate_idx" ON "UltrasoundStudy"("patientId", "studyDate");

-- CreateIndex
CREATE UNIQUE INDEX "Nodule_patientId_label_key" ON "Nodule"("patientId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorReview_analysisId_key" ON "DoctorReview"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reviewId_key" ON "Report"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_shareToken_key" ON "Report"("shareToken");

-- CreateIndex
CREATE INDEX "LabResult_patientId_type_takenAt_idx" ON "LabResult"("patientId", "type", "takenAt");

-- CreateIndex
CREATE INDEX "FollowUp_scheduledAt_idx" ON "FollowUp"("scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAssignment" ADD CONSTRAINT "PatientAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAssignment" ADD CONSTRAINT "PatientAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UltrasoundStudy" ADD CONSTRAINT "UltrasoundStudy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UltrasoundStudy" ADD CONSTRAINT "UltrasoundStudy_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UltrasoundImage" ADD CONSTRAINT "UltrasoundImage_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "UltrasoundStudy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nodule" ADD CONSTRAINT "Nodule_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysisResult" ADD CONSTRAINT "AIAnalysisResult_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "UltrasoundStudy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoduleFinding" ADD CONSTRAINT "NoduleFinding_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysisResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoduleFinding" ADD CONSTRAINT "NoduleFinding_noduleId_fkey" FOREIGN KEY ("noduleId") REFERENCES "Nodule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoduleFinding" ADD CONSTRAINT "NoduleFinding_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "UltrasoundImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysisResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "UltrasoundStudy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "DoctorReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
