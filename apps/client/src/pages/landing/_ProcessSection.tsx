import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { SearchIcon, PenIcon, CodeIcon, RocketIcon, ChecklistIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const STEPS = [
  {
    Icon: SearchIcon,
    titleKey: 'landing.process.step1_title',
    descKey: 'landing.process.step1_desc',
    deliverableKey: 'landing.process.step1_deliverable',
    color: 'text-blue-800',
    bg: 'bg-blue-50',
  },
  {
    Icon: PenIcon,
    titleKey: 'landing.process.step2_title',
    descKey: 'landing.process.step2_desc',
    deliverableKey: 'landing.process.step2_deliverable',
    color: 'text-purple-800',
    bg: 'bg-purple-50',
  },
  {
    Icon: CodeIcon,
    titleKey: 'landing.process.step3_title',
    descKey: 'landing.process.step3_desc',
    deliverableKey: 'landing.process.step3_deliverable',
    color: 'text-green-800',
    bg: 'bg-green-50',
  },
  {
    Icon: RocketIcon,
    titleKey: 'landing.process.step4_title',
    descKey: 'landing.process.step4_desc',
    deliverableKey: 'landing.process.step4_deliverable',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
  },
];

function ProcessSection() {
  const intl = useIntl();

  return (
    <section id="process" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {intl.formatMessage({ id: 'landing.process.title', defaultMessage: 'Process' })}
          </p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
            {intl.formatMessage({ id: 'landing.process.headline', defaultMessage: 'How I Work' })}
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            {intl.formatMessage({
              id: 'landing.process.description',
              defaultMessage: 'A proven 4-step process that turns complex requirements into production-ready systems.',
            })}
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.titleKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1 } },
              }}
              className="relative space-y-4"
            >
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="absolute top-7 left-full hidden w-full md:block">
                  <div className="h-0.5 w-full bg-gradient-to-r from-blue-200 to-transparent" />
                </div>
              )}

              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <div className={`flex size-14 items-center justify-center rounded-2xl ${step.bg}`}>
                  <step.Icon className={`size-7 ${step.color}`} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">0{i + 1}</span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {intl.formatMessage({ id: step.titleKey, defaultMessage: '' })}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-gray-600">
                  {intl.formatMessage({ id: step.descKey, defaultMessage: '' })}
                </p>
                <div className="flex items-start gap-2 rounded-lg bg-blue-50/40 px-3 py-2">
                  <ChecklistIcon className="mt-0.5 size-3.5 shrink-0 text-blue-600" />
                  <span className="text-xs font-medium text-blue-800">
                    {intl.formatMessage({ id: step.deliverableKey, defaultMessage: '' })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payment model callout */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        className="mx-auto mt-16 max-w-2xl rounded-2xl border border-blue-200 bg-blue-50/50 px-8 py-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <ChecklistIcon className="size-4 text-blue-800" />
          <span className="text-sm font-semibold text-blue-900">
            {intl.formatMessage({ id: 'landing.process.payment_title', defaultMessage: 'Checkpoint-Based Payment' })}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-blue-800">
          {intl.formatMessage({
            id: 'landing.process.payment_desc',
            defaultMessage: 'I work per checkpoint: deposit before work starts, then payment at each milestone delivery — including the final handoff. You only pay for what you\'ve seen and approved. No surprises, no risk.',
          })}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-blue-700">
          {[
            { labelKey: 'landing.process.payment_step1', defaultMsg: 'Deposit to start' },
            { labelKey: 'landing.process.payment_step2', defaultMsg: 'Checkpoint 1 — deliver & pay' },
            { labelKey: 'landing.process.payment_step3', defaultMsg: 'Checkpoint 2 — deliver & pay' },
            { labelKey: 'landing.process.payment_step4', defaultMsg: 'Final delivery & final payment' },
          ].map((s, i) => (
            <div key={s.labelKey} className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold text-blue-800">
                {i + 1}
              </span>
              <span>{intl.formatMessage({ id: s.labelKey, defaultMessage: s.defaultMsg })}</span>
              {i < 3 && <span className="text-blue-300">→</span>}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

export { ProcessSection };
