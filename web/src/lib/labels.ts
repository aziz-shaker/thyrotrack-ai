/** Arabic labels for clinical enums (shared by doctor & patient UIs). */
export const FEATURE_AR = {
  composition: { CYSTIC: "كيسية", SPONGIFORM: "إسفنجية", MIXED: "مختلطة", SOLID: "صلبة" },
  echogenicity: { ANECHOIC: "عديمة الصدى", HYPERECHOIC: "عالية الصدى", ISOECHOIC: "متساوية الصدى", HYPOECHOIC: "منخفضة الصدى", VERY_HYPOECHOIC: "منخفضة الصدى جدًا" },
  shape: { WIDER_THAN_TALL: "أعرض من طولها", TALLER_THAN_WIDE: "أطول من عرضها" },
  margin: { SMOOTH: "ناعمة", ILL_DEFINED: "غير محددة", LOBULATED: "مفصّصة/غير منتظمة", EXTRATHYROIDAL: "امتداد خارج الغدة" },
  echogenicFoci: { NONE: "لا يوجد", COMET_TAIL: "ذيل المذنب", MACRO: "تكلسات كبيرة", RIM: "تكلس طرفي", PUNCTATE: "بؤر نقطية" },
} as const;

export const FEATURE_NAME_AR: Record<string, string> = {
  composition: "التركيب",
  echogenicity: "الصدى",
  shape: "الشكل",
  margin: "الحواف",
  echogenicFoci: "البؤر الصدوية",
};

export const LOBE_AR = { RIGHT: "الفص الأيمن", LEFT: "الفص الأيسر", ISTHMUS: "البرزخ" } as const;
export const ZONE_AR = { UPPER: "الثلث العلوي", MIDDLE: "الثلث الأوسط", LOWER: "الثلث السفلي" } as const;

export const RECOMMENDATION_AR = {
  ROUTINE_FOLLOW_UP: "مراجعة دورية",
  US_FOLLOW_UP: "متابعة بالسونار",
  FNA: "سحب عينة (FNA)",
  ADDITIONAL_IMAGING: "إشاعة إضافية",
  LAB_TESTS: "تحاليل",
  SURGICAL_REFERRAL: "تحويل لجراح",
  NO_ACTION: "لا يلزم إجراء",
} as const;

export const STUDY_STATUS_AR = {
  UPLOADED: "بانتظار التحليل",
  ANALYZING: "جاري التحليل",
  ANALYZED: "بانتظار المراجعة",
  REVIEWED: "معتمد",
  REPORTED: "أُرسل للمريض",
  FAILED: "فشل",
} as const;

export const DECISION_AR = { CONFIRMED: "تأكيد نتيجة AI", MODIFIED: "تعديل النتيجة", REJECTED: "رفض النتيجة" } as const;
