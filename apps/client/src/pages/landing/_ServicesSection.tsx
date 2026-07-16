import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { CubeIcon, RobotIcon, BoxIcon, LightbulbIcon, CheckCircleIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const SERVICES = [
  {
    Icon: CubeIcon,
    titleKey: 'landing.services.service1_title',
    descKey: 'landing.services.service1_desc',
    whyKey: 'landing.services.service1_why',
    featureKeys: [
      'landing.services.service1_feature1',
      'landing.services.service1_feature2',
      'landing.services.service1_feature3',
      'landing.services.service1_feature4',
    ],
  },
  {
    Icon: RobotIcon,
    titleKey: 'landing.services.service2_title',
    descKey: 'landing.services.service2_desc',
    whyKey: 'landing.services.service2_why',
    featureKeys: [
      'landing.services.service2_feature1',
      'landing.services.service2_feature2',
      'landing.services.service2_feature3',
      'landing.services.service2_feature4',
    ],
  },
  {
    Icon: BoxIcon,
    titleKey: 'landing.services.service3_title',
    descKey: 'landing.services.service3_desc',
    whyKey: 'landing.services.service3_why',
    featureKeys: [
      'landing.services.service3_feature1',
      'landing.services.service3_feature2',
      'landing.services.service3_feature3',
      'landing.services.service3_feature4',
    ],
  },
];

export function ServicesSection() {
  const intl = useIntl();

  return (
    <section id="services" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {intl.formatMessage({ id: 'landing.services.title', defaultMessage: 'Services' })}
          </p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
            {intl.formatMessage({ id: 'landing.services.headline', defaultMessage: 'What I Offer' })}
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            {intl.formatMessage({
              id: 'landing.services.description',
              defaultMessage: 'Three core capabilities that turn complex business requirements into software people love.',
            })}
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-3">
          {SERVICES.map((service, i) => (
            <motion.div
              key={service.titleKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.12 } },
              }}
              className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-8 transition-shadow hover:shadow-md"
            >
              <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-blue-50">
                <service.Icon className="size-7 text-blue-900" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-900">
                {intl.formatMessage({ id: service.titleKey, defaultMessage: '' })}
              </h3>
              <p className="mb-4 leading-relaxed text-gray-600">
                {intl.formatMessage({ id: service.descKey, defaultMessage: '' })}
              </p>
              <p className="mb-5 rounded-lg bg-blue-50/50 px-3 py-2 text-xs leading-relaxed text-blue-800">
                <LightbulbIcon className="mr-1.5 inline size-3.5 text-blue-600" />
                {intl.formatMessage({ id: service.whyKey, defaultMessage: '' })}
              </p>
              <ul className="mt-auto space-y-2.5">
                {service.featureKeys.map((key) => (
                  <li key={key} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircleIcon className="size-4 text-blue-800" />
                    {intl.formatMessage({ id: key, defaultMessage: '' })}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}