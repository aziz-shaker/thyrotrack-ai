import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";

// Geometric Arabic + Latin in one family — keeps mixed AR/EN medical terms visually consistent
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThyroTrack AI | متابعة عقيدات الغدة الدرقية",
  description:
    "نظام دعم قرار ذكي لأطباء الغدد والأشعة لتحليل ومتابعة عقيدات الغدة الدرقية وفق ACR TI-RADS.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={readex.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
