import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ChatFab } from "@/components/layout/ChatFab";
import { Hero } from "@/components/landing/Hero";
import { CareCards, RegionStats, VoicesBand, ToolsSection } from "@/components/landing/Sections";
import { ContactSection } from "@/components/landing/ContactSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <CareCards />
        <RegionStats />
        <VoicesBand />
        <ToolsSection />
        <ContactSection />
      </main>
      <Footer />
      <ChatFab />
    </>
  );
}
