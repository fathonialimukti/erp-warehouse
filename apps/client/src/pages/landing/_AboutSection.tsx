import { useNavigate } from 'react-router';
import { useIntl } from 'react-intl';
import { Button } from '@heroui/react';
import { motion } from 'framer-motion';
import { UserHandIcon, DiplomaIcon, ChatIcon, ShieldCheckIcon, PlayIcon, LetterIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const values = [
  { Icon: UserHandIcon, titleKey: 'landing.about.value1_title', descKey: 'landing.about.value1_desc' },
  { Icon: DiplomaIcon, titleKey: 'landing.about.value2_title', descKey: 'landing.about.value2_desc' },
  { Icon: ChatIcon, titleKey: 'landing.about.value3_title', descKey: 'landing.about.value3_desc' },
  { Icon: ShieldCheckIcon, titleKey: 'landing.about.value4_title', descKey: 'landing.about.value4_desc' },
];

export function AboutSection() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <section id="about" className="bg-blue-900 py-20 text-white lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="space-y-6"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
            {intl.formatMessage({ id: 'landing.about.title', defaultMessage: 'About Me' })}
          </p>
          <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
            {intl.formatMessage({ id: 'landing.about.headline_line1', defaultMessage: 'Your One-Man Agency for' })}
            <span className="block text-blue-300">
              {intl.formatMessage({ id: 'landing.about.headline_line2', defaultMessage: 'Complex Web Solutions' })}
            </span>
          </h2>
          <p className="leading-relaxed text-blue-100">
            {intl.formatMessage({
              id: 'landing.about.bio_line1',
              defaultMessage:
                "I'm Fathoni Ali Mukti — a full-stack developer and 3D web specialist. I design, build, and deliver production-ready enterprise applications solo, end-to-end.",
            })}
          </p>
          <p className="leading-relaxed text-blue-100">
            {intl.formatMessage({
              id: 'landing.about.bio_line2',
              defaultMessage:
                'This ERP warehouse suite is a live demonstration of my capabilities: real-time 3D scene management, AI-augmented workflows, role-based access, and a polished UI — all built by one person.',
            })}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="primary" onPress={() => navigate('/login')}>
              <PlayIcon className="size-4" />
              {intl.formatMessage({ id: 'landing.about.cta_demo', defaultMessage: 'Try the Demo' })}
            </Button>
            <Button
              variant="secondary"
              onPress={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <LetterIcon className="size-4" />
              {intl.formatMessage({ id: 'landing.about.cta_contact', defaultMessage: 'Get in Touch' })}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="space-y-4"
        >
          {values.map((item) => (
            <div
              key={item.titleKey}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-800">
                <item.Icon className="size-5 text-blue-200" />
              </div>
              <div>
                <h4 className="font-semibold text-white">
                  {intl.formatMessage({ id: item.titleKey, defaultMessage: '' })}
                </h4>
                <p className="mt-0.5 text-sm text-blue-200">
                  {intl.formatMessage({ id: item.descKey, defaultMessage: '' })}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}