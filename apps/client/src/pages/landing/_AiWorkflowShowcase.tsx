import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { SearchIcon, CodeIcon, ChartIcon, BulbIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const PIPELINE_STEPS = [
  {
    icon: SearchIcon,
    titleKey: 'landing.ai.step1_title',
    descKey: 'landing.ai.step1_desc',
    color: 'bg-accent/10 text-accent',
    borderColor: 'border-accent/25',
  },
  {
    icon: CodeIcon,
    titleKey: 'landing.ai.step2_title',
    descKey: 'landing.ai.step2_desc',
    color: 'bg-success/10 text-success',
    borderColor: 'border-success/30',
  },
  {
    icon: ChartIcon,
    titleKey: 'landing.ai.step3_title',
    descKey: 'landing.ai.step3_desc',
    color: 'bg-warning/10 text-warning',
    borderColor: 'border-warning/30',
  },
  {
    icon: BulbIcon,
    titleKey: 'landing.ai.step4_title',
    descKey: 'landing.ai.step4_desc',
    color: 'bg-accent/10 text-accent',
    borderColor: 'border-accent/25',
  },
];

const STACK_CHIPS = ['landing.ai.chip_1', 'landing.ai.chip_2', 'landing.ai.chip_3', 'landing.ai.chip_4'];

export function AiWorkflowShowcase() {
  const intl = useIntl();

  return (
    <section id="ai" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-14 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            {intl.formatMessage({ id: 'landing.ai.badge', defaultMessage: 'AI Assistant' })}
          </p>
          <h2 className="text-3xl font-bold text-foreground lg:text-4xl">
            {intl.formatMessage({ id: 'landing.ai.title', defaultMessage: 'Your AI Warehouse Assistant' })}
          </h2>
          <p className="mx-auto max-w-2xl text-muted">
            {intl.formatMessage({
              id: 'landing.ai.description',
              defaultMessage:
                'Ask in plain language. The assistant checks your live warehouse data and can do the task for you.',
            })}
          </p>
        </motion.div>

        {/* Pipeline steps */}
        <div className="mb-14 grid gap-6 md:grid-cols-4">
          {PIPELINE_STEPS.map((step, i) => (
            <motion.div
              key={step.titleKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } },
              }}
              className={`rounded-2xl border ${step.borderColor} p-6`}
            >
              <div className={`mb-4 flex size-10 items-center justify-center rounded-xl ${step.color}`}>
                <step.icon className="size-5" />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {intl.formatMessage({ id: step.titleKey, defaultMessage: step.titleKey })}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {intl.formatMessage({ id: step.descKey, defaultMessage: step.descKey })}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Tech stack callout */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="rounded-2xl border border-accent/25 bg-accent/10 px-8 py-6 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
            {STACK_CHIPS.map((chipKey) => (
              <span key={chipKey} className="rounded-full border border-accent/25 bg-surface px-3 py-1 text-xs font-medium text-accent">
                {intl.formatMessage({ id: chipKey, defaultMessage: chipKey })}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-accent/80">
            {intl.formatMessage({
              id: 'landing.ai.stack_local_note',
              defaultMessage:
                'The AI can run on your own company servers — your data never has to leave the building.',
            })}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
