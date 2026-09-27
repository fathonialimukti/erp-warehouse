import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import {
  DocumentIcon,
  CubeIcon,
  ShieldCheckIcon,
  ChecklistIcon,
  DeliveryIcon,
  ChartIcon,
  RobotIcon,
  BrainIcon,
} from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const FEATURES = [
  {
    icon: DocumentIcon,
    titleKey: 'landing.features.f1_title',
    descKey: 'landing.features.f1_desc',
    color: 'bg-accent/10 text-accent',
  },
  {
    icon: CubeIcon,
    titleKey: 'landing.features.f2_title',
    descKey: 'landing.features.f2_desc',
    color: 'bg-success/10 text-success',
  },
  {
    icon: ShieldCheckIcon,
    titleKey: 'landing.features.f3_title',
    descKey: 'landing.features.f3_desc',
    color: 'bg-warning/10 text-warning',
  },
  {
    icon: ChecklistIcon,
    titleKey: 'landing.features.f4_title',
    descKey: 'landing.features.f4_desc',
    color: 'bg-accent/10 text-accent',
  },
  {
    icon: DeliveryIcon,
    titleKey: 'landing.features.f5_title',
    descKey: 'landing.features.f5_desc',
    color: 'bg-success/10 text-success',
  },
  {
    icon: ChartIcon,
    titleKey: 'landing.features.f6_title',
    descKey: 'landing.features.f6_desc',
    color: 'bg-warning/10 text-warning',
  },
  {
    icon: RobotIcon,
    titleKey: 'landing.features.f7_title',
    descKey: 'landing.features.f7_desc',
    color: 'bg-accent/10 text-accent',
  },
  {
    icon: BrainIcon,
    titleKey: 'landing.features.f8_title',
    descKey: 'landing.features.f8_desc',
    color: 'bg-success/10 text-success',
  },
];

export function FeaturesSection() {
  const intl = useIntl();

  return (
    <section id="features" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-14 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            {intl.formatMessage({ id: 'landing.features.badge', defaultMessage: 'Features' })}
          </p>
          <h2 className="mt-2 text-3xl font-bold text-foreground lg:text-4xl">
            {intl.formatMessage({ id: 'landing.features.title', defaultMessage: "What's Inside" })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            {intl.formatMessage({
              id: 'landing.features.description',
              defaultMessage:
                'Everything below is implemented and running in the demo — seeded with a year of realistic operations.',
            })}
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: (i % 4) * 0.08 } },
              }}
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <div className={`mb-4 flex size-12 items-center justify-center rounded-xl ${feature.color}`}>
                <feature.icon className="size-6" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                {intl.formatMessage({ id: feature.titleKey, defaultMessage: feature.titleKey })}
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                {intl.formatMessage({ id: feature.descKey, defaultMessage: feature.descKey })}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
