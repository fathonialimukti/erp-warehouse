import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { QuotesIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const TESTIMONIALS = [
  {
    quoteKey: 'landing.testimonials.testimonial1_quote',
    nameKey: 'landing.testimonials.testimonial1_name',
    companyKey: 'landing.testimonials.testimonial1_company',
    initials: 'OD',
    color: 'bg-blue-700',
  },
  {
    quoteKey: 'landing.testimonials.testimonial2_quote',
    nameKey: 'landing.testimonials.testimonial2_name',
    companyKey: 'landing.testimonials.testimonial2_company',
    initials: 'PM',
    color: 'bg-green-700',
  },
  {
    quoteKey: 'landing.testimonials.testimonial3_quote',
    nameKey: 'landing.testimonials.testimonial3_name',
    companyKey: 'landing.testimonials.testimonial3_company',
    initials: 'ED',
    color: 'bg-purple-700',
  },
];

export function TestimonialsSection() {
  const intl = useIntl();

  return (
    <section className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {intl.formatMessage({ id: 'landing.testimonials.title', defaultMessage: 'Testimonials' })}
          </p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
            {intl.formatMessage({ id: 'landing.testimonials.headline', defaultMessage: 'What Clients Say' })}
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            {intl.formatMessage({
              id: 'landing.testimonials.description',
              defaultMessage: 'Trusted by businesses who needed complex systems delivered right.',
            })}
          </p>
          <p className="mx-auto max-w-lg text-xs italic text-gray-400">
            {intl.formatMessage({
              id: 'landing.testimonials.placeholder_note',
              defaultMessage: 'These are example testimonials. Your feedback could be here next.',
            })}
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.quoteKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 32 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.12 } },
              }}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
            >
              <QuotesIcon className="mb-4 size-8 text-blue-200" />
              <p className="mb-6 flex-1 leading-relaxed text-gray-700">
                &ldquo;{intl.formatMessage({ id: t.quoteKey, defaultMessage: '' })}&rdquo;
              </p>
              <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                <div className={`flex size-10 items-center justify-center rounded-full ${t.color}`}>
                  <span className="text-sm font-semibold text-white">{t.initials}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {intl.formatMessage({ id: t.nameKey, defaultMessage: '' })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {intl.formatMessage({ id: t.companyKey, defaultMessage: '' })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}