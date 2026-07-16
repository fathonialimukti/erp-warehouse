import { useIntl } from 'react-intl';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const TECH_STACK = [
  { label: 'React 19', icon: 'logos:react' },
  { label: 'Three.js / R3F', icon: 'logos:threejs' },
  { label: 'TypeScript', icon: 'logos:typescript-icon' },
  { label: 'tRPC', icon: 'solar:code-bold' },
  { label: 'Prisma', icon: 'simple-icons:prisma' },
  { label: 'Tauri', icon: 'simple-icons:tauri' },
  { label: 'HeroUI', icon: 'solar:palette-bold' },
  { label: 'AI SDK', icon: 'solar:stars-bold' },
  { label: 'Tailwind CSS', icon: 'logos:tailwindcss-icon' },
  { label: 'PostgreSQL', icon: 'logos:postgresql' },
];

export function TechStackSection() {
  const intl = useIntl();

  return (
    <section className="bg-gray-50 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-10 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {intl.formatMessage({ id: 'landing.tech_stack.title', defaultMessage: 'Tech Stack' })}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            {intl.formatMessage({ id: 'landing.tech_stack.headline', defaultMessage: 'Built With Modern Tools' })}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-600">
            {intl.formatMessage({
              id: 'landing.tech_stack.description',
              defaultMessage: 'Battle-tested technologies chosen for reliability, performance, and developer experience.',
            })}
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="flex flex-wrap justify-center gap-3"
        >
          {TECH_STACK.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm"
            >
              <Icon icon={t.icon} className="size-4" />
              {t.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}