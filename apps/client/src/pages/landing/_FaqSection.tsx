import { useState } from 'react';
import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon } from './_LandingIcons';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const FAQ_ITEMS = [
  { questionKey: 'landing.faq.q1_question', answerKey: 'landing.faq.q1_answer' },
  { questionKey: 'landing.faq.q2_question', answerKey: 'landing.faq.q2_answer' },
  { questionKey: 'landing.faq.q3_question', answerKey: 'landing.faq.q3_answer' },
  { questionKey: 'landing.faq.q4_question', answerKey: 'landing.faq.q4_answer' },
  { questionKey: 'landing.faq.q5_question', answerKey: 'landing.faq.q5_answer' },
  { questionKey: 'landing.faq.q6_question', answerKey: 'landing.faq.q6_answer' },
];

export function FaqSection() {
  const intl = useIntl();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 space-y-3 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
            {intl.formatMessage({ id: 'landing.faq.title', defaultMessage: 'FAQ' })}
          </p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
            {intl.formatMessage({ id: 'landing.faq.headline', defaultMessage: 'Frequently Asked Questions' })}
          </h2>
          <p className="mx-auto max-w-xl text-gray-600">
            {intl.formatMessage({
              id: 'landing.faq.description',
              defaultMessage: 'Common questions about working with me — from process to pricing to technology.',
            })}
          </p>
        </motion.div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <motion.div
              key={item.questionKey}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06 } },
              }}
              className="rounded-xl border border-gray-200"
            >
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="pr-4 text-sm font-medium text-gray-900">
                  {intl.formatMessage({ id: item.questionKey, defaultMessage: '' })}
                </span>
                {openIndex === i ? (
                  <ChevronUpIcon className={`size-4 shrink-0 text-blue-800`} />
                ) : (
                  <ChevronDownIcon className="size-4 shrink-0 text-gray-400" />
                )}
              </button>
              {openIndex === i && (
                <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                  <p className="text-sm leading-relaxed text-gray-600">
                    {intl.formatMessage({ id: item.answerKey, defaultMessage: '' })}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}