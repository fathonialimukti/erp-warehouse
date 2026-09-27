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
    <section className="bg-background pb-20 lg:pb-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl bg-accent px-8 py-16 text-center text-accent-foreground shadow-xl lg:px-16 lg:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_60%)]" />
          <div className="relative mx-auto max-w-2xl space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-accent-foreground/70">
              {intl.formatMessage({ id: 'landing.cta.title', defaultMessage: 'Live Demo' })}
            </p>
            <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
              {intl.formatMessage({ id: 'landing.cta.headline_line1', defaultMessage: 'Explore the' })}
              <span className="block text-accent-foreground/70">
                {intl.formatMessage({ id: 'landing.cta.headline_line2', defaultMessage: 'Full System.' })}
              </span>
            </h2>
            <p className="mx-auto max-w-lg text-accent-foreground/80">
              {intl.formatMessage({
                id: 'landing.cta.description',
                defaultMessage:
                  'Fully seeded demo environment — 3 warehouses, a year of transactions, every role from admin to finance.',
              })}
            </p>
            <Button
              variant="primary"
              className="bg-white text-accent hover:bg-white/90"
              onPress={() => navigate('/login')}
              size="lg"
            >
              <PlayIcon className="size-5" />
              {intl.formatMessage({ id: 'landing.cta.button', defaultMessage: 'Open the Demo' })}
            </Button>
            <p className="font-mono text-xs text-accent-foreground/70">
              {intl.formatMessage({
                id: 'landing.cta.credentials',
                defaultMessage: 'Demo login: admin@mail.com / password',
              })}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
