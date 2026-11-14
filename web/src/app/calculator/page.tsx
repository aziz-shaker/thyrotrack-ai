import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TiradsCalculator } from "./TiradsCalculator";
import { TshCheck } from "./TshCheck";

export const metadata = { title: "حاسبة TI-RADS | ThyroTrack AI" };

export default function CalculatorPage() {
  return (
    <>
      <Navbar />
      <main className="bg-navy-50/60">
        <section className="bg-gradient-to-l from-surface to-[#D6E2E9] py-14">
          <div className="container-page">
            <h1 className="text-4xl font-extrabold text-navy-800">الأدوات الذكية</h1>
            <p className="mt-3 max-w-2xl text-lg text-navy-700">احسب تصنيف ACR TI-RADS وحجم العقدة وتوصية FNA، وافهم نتيجة تحليل TSH.</p>
          </div>
        </section>
        <section id="tirads" className="container-page scroll-mt-28 py-12">
          <h2 className="mb-6 text-2xl font-extrabold text-navy-800">حاسبة TI-RADS وحجم العقدة</h2>
          <TiradsCalculator />
        </section>
        <section id="tsh" className="container-page scroll-mt-28 pb-16">
          <h2 className="mb-6 text-2xl font-extrabold text-navy-800">تفسير تحليل TSH</h2>
          <TshCheck />
        </section>
      </main>
      <Footer />
    </>
  );
}
