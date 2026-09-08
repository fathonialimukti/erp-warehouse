import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { motion } from 'framer-motion';
import { LandingHeroScene } from './_LandingHeroScene';
import { StarIcon, PlayIcon, CheckCircleIcon, CubeIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export function HeroSection() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(219,234,254,0.6),transparent_55%)] pt-16 pb-24 lg:pt-24 lg:pb-32">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-10">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-8">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-800">
              <StarIcon className="size-3" />
              {intl.formatMessage({ id: 'landing.hero.badge', defaultMessage: 'Warehouse Management System' })}
            </span>
            <h1 className="text-4xl leading-tight font-bold tracking-tight text-gray-900 lg:text-5xl xl:text-6xl">
              {intl.formatMessage({ id: 'landing.hero.headline_line1', defaultMessage: 'Warehouse Management' })}
              <span className="block text-blue-900">
                {intl.formatMessage({ id: 'landing.hero.headline_line2', defaultMessage: 'with AI Built In.' })}
              </span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-gray-600">
              {intl.formatMessage({
                id: 'landing.hero.description',
                defaultMessage:
                  'Receive goods, put them away, pick and ship — and see it all live on a 3D map of your warehouse. An AI assistant answers questions and does the paperwork for you.',
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onPress={() => navigate('/login')}>
              <PlayIcon className="size-4" />
              {intl.formatMessage({ id: 'landing.hero.cta_demo', defaultMessage: 'Try the Live Demo' })}
            </Button>
            <Button
              variant="secondary"
              onPress={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <CubeIcon className="size-4" />
              {intl.formatMessage({ id: 'landing.hero.cta_features', defaultMessage: 'Explore Features' })}
            </Button>
          </div>

          <p className="text-sm text-gray-500">
            {intl.formatMessage({
              id: 'landing.hero.demo_credentials',
              defaultMessage: 'Demo login: admin@mail.com / password',
            })}
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-sm text-gray-500">
            {[
              { id: 'landing.hero.badge_3d', defaultMessage: 'Live 3D warehouse map' },
              { id: 'landing.hero.badge_ai', defaultMessage: 'AI assistant included' },
              { id: 'landing.hero.badge_typescript', defaultMessage: 'Works in your browser' },
            ].map((badge) => (
              <div key={badge.id} className="flex items-center gap-1.5">
                <CheckCircleIcon className="size-4 text-blue-800" />
                {intl.formatMessage({ id: badge.id, defaultMessage: badge.defaultMessage })}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative h-105 overflow-hidden rounded-3xl border border-blue-100 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96)_60%,rgba(37,99,235,0.8))] shadow-2xl lg:h-125"
        >
          <LandingHeroScene />
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-black/40 px-3 py-2 text-xs font-medium text-white/80 backdrop-blur-sm">
            <CubeIcon className="mr-1.5 inline size-3.5 text-blue-300" />
            {intl.formatMessage({ id: 'landing.hero.scene_badge', defaultMessage: 'Live 3D Warehouse Model — Interactive' })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
