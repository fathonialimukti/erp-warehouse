import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';

const STATS = [
  { value: '3', labelKey: 'landing.stats.warehouses' },
  { value: '15', labelKey: 'landing.stats.demo_skus' },
  { value: '12', labelKey: 'landing.stats.demo_months' },
  { value: '38', labelKey: 'landing.stats.ai_tools' },
];

export function StatsBar() {
  const intl = useIntl();

  return (
    <section className="border-y border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.labelKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08 } },
              }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-blue-900 lg:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm text-gray-500">
                {intl.formatMessage({ id: stat.labelKey, defaultMessage: stat.labelKey })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
