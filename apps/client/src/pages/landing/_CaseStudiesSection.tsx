import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { BuildingsIcon, DangerIcon, BulbIcon, ChartIcon, CubeIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const CASES = [
  {
    Icon: BuildingsIcon,
    titleKey: 'landing.case_studies.case1_title',
    tagKey: 'landing.case_studies.case1_tag',
    challengeKey: 'landing.case_studies.case1_challenge',
    solutionKey: 'landing.case_studies.case1_solution',
    resultKey: 'landing.case_studies.case1_result',
    color: 'bg-blue-50 text-blue-800',
    borderColor: 'border-blue-200',
  },
  {
    Icon: BuildingsIcon,
    titleKey: 'landing.case_studies.case2_title',
    tagKey: 'landing.case_studies.case2_tag',
    challengeKey: 'landing.case_studies.case2_challenge',
    solutionKey: 'landing.case_studies.case2_solution',
    resultKey: 'landing.case_studies.case2_result',
    color: 'bg-green-50 text-green-800',
    borderColor: 'border-green-200',
  },
  {
    Icon: CubeIcon,
    titleKey: 'landing.case_studies.case3_title',
    tagKey: 'landing.case_studies.case3_tag',
    challengeKey: 'landing.case_studies.case3_challenge',
    solutionKey: 'landing.case_studies.case3_solution',
    resultKey: 'landing.case_studies.case3_result',
    color: 'bg-purple-50 text-purple-800',
    borderColor: 'border-purple-200',
  },
];

export function CaseStudiesSection() {
  const intl = useIntl();

  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {intl.formatMessage({ id: 'landing.case_studies.title', defaultMessage: 'Case Studies' })}
          </p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
            {intl.formatMessage({ id: 'landing.case_studies.headline', defaultMessage: 'Real Results' })}
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            {intl.formatMessage({
              id: 'landing.case_studies.description',
              defaultMessage: 'Deep dives into projects where complex problems met simple, powerful solutions.',
            })}
          </p>
        </motion.div>

        <div className="space-y-12">
          {CASES.map((c, i) => (
            <motion.div
              key={c.titleKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1 } },
              }}
              className={`rounded-2xl border ${c.borderColor} bg-white p-8 shadow-sm lg:p-10`}
            >
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex size-12 items-center justify-center rounded-xl ${c.color}`}>
                    <c.Icon className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {intl.formatMessage({ id: c.titleKey, defaultMessage: '' })}
                    </h3>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.color}`}>
                      {intl.formatMessage({ id: c.tagKey, defaultMessage: '' })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <DangerIcon className="size-4 text-amber-500" />
                    Challenge
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {intl.formatMessage({ id: c.challengeKey, defaultMessage: '' })}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <BulbIcon className="size-4 text-blue-500" />
                    Solution
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {intl.formatMessage({ id: c.solutionKey, defaultMessage: '' })}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ChartIcon className="size-4 text-green-500" />
                    Result
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {intl.formatMessage({ id: c.resultKey, defaultMessage: '' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}