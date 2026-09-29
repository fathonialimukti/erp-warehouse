import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useIntl } from "react-intl";
import { motion } from "framer-motion";
import { PlayIcon } from "./landing/_LandingIcons";
import { LandingNavbar } from "./landing/_LandingNavbar";
import { HeroSection } from "./landing/_HeroSection";
import { StatsBar } from "./landing/_StatsBar";
import { FeaturesSection } from "./landing/_FeaturesSection";
import { RagShowcase } from "./landing/_RagShowcase";
import { AiWorkflowShowcase } from "./landing/_AiWorkflowShowcase";
import { TechStackSection } from "./landing/_TechStackSection";
import { CtaSection } from "./landing/_CtaSection";
import { FooterSection } from "./landing/_FooterSection";

function LandingPage() {
  const intl = useIntl();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "WMS — Warehouse Management System";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc)
      metaDesc.setAttribute(
        "content",
        "Warehouse management with a live 3D warehouse map, stock tracking, approvals, and reports — plus an AI assistant.",
      );
  }, []);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-ai-context={JSON.stringify({ section: "landing" })}
    >
      <LandingNavbar />

      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <RagShowcase />
      <AiWorkflowShowcase />
      <TechStackSection />
      <CtaSection />
      <FooterSection />

      {/* Floating Mobile CTA */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md md:hidden"
      >
        <button
          onClick={() => navigate("/login")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg transition active:opacity-90"
        >
          <PlayIcon className="size-4" />
          {intl.formatMessage({
            id: "landing.mobile_cta",
            defaultMessage: "Try the Live Demo",
          })}
        </button>
      </motion.div>
      {/* Spacer for floating CTA */}
      <div className="h-16 md:hidden" />
    </div>
  );
}

export { LandingPage };
