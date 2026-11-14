/**
 * Illustrative ultrasound frame with an AI-detected nodule:
 * segmentation contour + bounding box + TI-RADS badge. Purely decorative (demo data).
 */
export function ScanMockup() {
  return (
    <figure
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/40 bg-[#0b0f12] shadow-2xl"
      aria-label="مثال توضيحي لإشاعة سونار مع تحديد العقدة"
    >
      <svg viewBox="0 0 400 300" className="h-full w-full">
        <defs>
          <radialGradient id="fan" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#5d6a70" />
            <stop offset="55%" stopColor="#2b3236" />
            <stop offset="100%" stopColor="#0b0f12" />
          </radialGradient>
          <filter id="speckle">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0" />
          </filter>
          <clipPath id="fanClip">
            <path d="M200 10 L385 250 Q200 300 15 250 Z" />
          </clipPath>
        </defs>

        {/* Ultrasound fan + speckle */}
        <g clipPath="url(#fanClip)">
          <rect width="400" height="300" fill="url(#fan)" />
          <rect width="400" height="300" filter="url(#speckle)" opacity="0.55" />
          {/* Thyroid lobe (brighter tissue) */}
          <ellipse cx="200" cy="150" rx="150" ry="70" fill="#9aa6ab" opacity="0.28" />
          {/* Hypoechoic nodule */}
          <ellipse cx="218" cy="150" rx="46" ry="36" fill="#14191c" opacity="0.85" />
          <circle cx="226" cy="142" r="2.4" fill="#f4f4f4" />
          <circle cx="210" cy="160" r="1.8" fill="#f4f4f4" />
        </g>

        {/* AI segmentation contour */}
        <path
          d="M172 150 C172 118 205 110 228 113 C256 117 266 138 263 156 C260 178 236 189 214 187 C190 185 172 172 172 150 Z"
          fill="rgba(27,181,163,0.18)"
          stroke="#2EBDAC"
          strokeWidth="2"
        />
        {/* Bounding box */}
        <rect x="166" y="106" width="104" height="88" fill="none" stroke="#F97316" strokeWidth="1.6" strokeDasharray="6 4" />

        {/* Caliper measurement */}
        <g stroke="#facc15" strokeWidth="1.4">
          <line x1="172" y1="200" x2="263" y2="200" />
          <line x1="172" y1="196" x2="172" y2="204" />
          <line x1="263" y1="196" x2="263" y2="204" />
        </g>
        <text x="217" y="216" textAnchor="middle" fill="#facc15" fontSize="11" fontFamily="monospace">
          18.4 mm
        </text>

        {/* Scanner HUD */}
        <text x="12" y="20" fill="#9ca3af" fontSize="9" fontFamily="monospace">L-LOBE · TRANS</text>
        <text x="12" y="32" fill="#9ca3af" fontSize="9" fontFamily="monospace">12 MHz · D 4.0cm</text>
      </svg>

      {/* Result badge */}
      <figcaption className="absolute bottom-3 start-3 end-3 flex items-center justify-between gap-3 rounded-xl bg-white/95 px-4 py-2.5 shadow-card">
        <div>
          <p className="text-xs text-ink-muted">نتيجة AI مقترحة</p>
          <p className="font-bold text-ink">
            ACR TI-RADS <span className="text-risk-high">TR4</span> · خطورة متوسطة
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-ink-muted">الثقة</p>
          <p className="font-bold text-brand-600" dir="ltr">87%</p>
        </div>
      </figcaption>
    </figure>
  );
}
