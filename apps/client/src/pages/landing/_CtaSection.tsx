import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { motion } from 'framer-motion';
import { PlayIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export function CtaSection() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#1e3a8a,#1e40af_50%,#2563eb)] px-8 py-16 text-center text-white shadow-xl lg:px-16 lg:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative mx-auto max-w-2xl space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">
              {intl.formatMessage({ id: 'landing.cta.title', defaultMessage: 'See It in Action' })}
            </p>
            <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
              {intl.formatMessage({ id: 'landing.cta.headline_line1', defaultMessage: 'The Best Way to Understand' })}
              <span className="block text-blue-200">
                {intl.formatMessage({ id: 'landing.cta.headline_line2', defaultMessage: 'Is to Try It Yourself.' })}
              </span>
            </h2>
            <p className="mx-auto max-w-lg text-blue-100">
              {intl.formatMessage({
                id: 'landing.cta.description',
                defaultMessage:
                  'Log into the live demo and explore the 3D warehouse, chat with the AI assistant, and run real transactions. No signup required.',
              })}
            </p>
            <Button
              variant="primary"
              className="bg-white text-blue-900 hover:bg-blue-50"
              onPress={() => navigate('/login')}
              size="lg"
            >
              <PlayIcon className="size-5" />
              {intl.formatMessage({ id: 'landing.cta.button', defaultMessage: 'Launch the Demo' })}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}