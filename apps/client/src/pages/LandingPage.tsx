import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { PlayIcon } from './landing/_LandingIcons';
import { LandingNavbar } from './landing/_LandingNavbar';
import { HeroSection } from './landing/_HeroSection';
import { StatsBar } from './landing/_StatsBar';
import { GallerySection } from './landing/_GallerySection';
import { ProcessSection } from './landing/_ProcessSection';
import { ServicesSection } from './landing/_ServicesSection';
import { RagShowcase } from './landing/_RagShowcase';
import { AiWorkflowShowcase } from './landing/_AiWorkflowShowcase';
import { TestimonialsSection } from './landing/_TestimonialsSection';
import { CaseStudiesSection } from './landing/_CaseStudiesSection';
import { TechStackSection } from './landing/_TechStackSection';
import { AboutSection } from './landing/_AboutSection';
import { CtaSection } from './landing/_CtaSection';
import { ContactSection } from './landing/_ContactSection';
import { FaqSection } from './landing/_FaqSection';
import { FooterSection } from './landing/_FooterSection';

function LandingPage() {
  const intl = useIntl();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'WMS — Enterprise Systems That Think';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'Full-stack enterprise applications with 3D interfaces, AI agents, and ERP logic. Built solo, end-to-end by Fathoni Ali Mukti.');
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNavbar />

      <HeroSection />
      <StatsBar />
      <GallerySection />
      <ProcessSection />
      <ServicesSection />
      <RagShowcase />
      <AiWorkflowShowcase />
      <TestimonialsSection />
      <CaseStudiesSection />
      <TechStackSection />
      <AboutSection />
      <CtaSection />
      <ContactSection />
      <FaqSection />
      <FooterSection />

      {/* Floating Mobile CTA */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md md:hidden"
      >
        <button
          onClick={() => navigate('/login')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition active:bg-blue-800"
        >
          <PlayIcon className="size-4" />
          {intl.formatMessage({ id: 'landing.mobile_cta', defaultMessage: 'Try the Live Demo' })}
        </button>
      </motion.div>
      {/* Spacer for floating CTA */}
      <div className="h-16 md:hidden" />
    </div>
  );
}

export { LandingPage };
