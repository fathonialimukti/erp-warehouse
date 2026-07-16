import { useState } from 'react';
import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { CheckCircleIcon, LetterIcon, SendIcon, RefreshIcon } from './_LandingIcons';
import { Icon } from '@iconify/react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export function ContactSection() {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data: { name: string; email: string; company?: string; message: string }) =>
      trpcClient.landing.submitContact.mutate(data),
    onSuccess: () => {
      setSuccess(true);
      setName('');
      setEmail('');
      setCompany('');
      setMessage('');
      setErrors({});
    },
    onError: () => {
      setErrors({ form: intl.formatMessage({ id: 'landing.contact.form_error_message', defaultMessage: 'Please try again or email me directly.' }) });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = intl.formatMessage({ id: 'landing.contact.form_name_required', defaultMessage: 'Name is required' });
    if (!email.trim()) newErrors.email = intl.formatMessage({ id: 'landing.contact.form_email_required', defaultMessage: 'Email is required' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = intl.formatMessage({ id: 'landing.contact.form_email_invalid', defaultMessage: 'Please enter a valid email' });
    if (!message.trim()) newErrors.message = intl.formatMessage({ id: 'landing.contact.form_message_required', defaultMessage: 'Message is required' });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    submitMutation.mutate({ name: name.trim(), email: email.trim(), company: company.trim() || undefined, message: message.trim() });
  };

  return (
    <section id="contact" className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto max-w-2xl space-y-8 text-center"
        >
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
              {intl.formatMessage({ id: 'landing.contact.title', defaultMessage: 'Contact' })}
            </p>
            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              {intl.formatMessage({ id: 'landing.contact.headline', defaultMessage: 'Ready to Build Something?' })}
            </h2>
            <p className="text-gray-600">
              {intl.formatMessage({ id: 'landing.contact.description', defaultMessage: "Have a project in mind? Let's talk about how I can help your business." })}
            </p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-green-200 bg-green-50 px-8 py-10"
            >
              <CheckCircleIcon className="mx-auto mb-3 size-10 text-green-600" />
              <h3 className="text-lg font-semibold text-green-900">
                {intl.formatMessage({ id: 'landing.contact.form_success_title', defaultMessage: 'Message Sent!' })}
              </h3>
              <p className="mt-1 text-sm text-green-700">
                {intl.formatMessage({ id: 'landing.contact.form_success_message', defaultMessage: "Thanks for reaching out. I'll get back to you within 24 hours." })}
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-4 text-sm font-medium text-green-800 underline transition hover:text-green-900"
              >
                {intl.formatMessage({ id: 'landing.contact.form_submit', defaultMessage: 'Send another message' })}
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {errors.form && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {errors.form}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700">
                    {intl.formatMessage({ id: 'landing.contact.form_name_label', defaultMessage: 'Name' })}
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: '' })); }}
                    placeholder={intl.formatMessage({ id: 'landing.contact.form_name_placeholder', defaultMessage: 'Your name' })}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700">
                    {intl.formatMessage({ id: 'landing.contact.form_email_label', defaultMessage: 'Email' })}
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: '' })); }}
                    placeholder={intl.formatMessage({ id: 'landing.contact.form_email_placeholder', defaultMessage: 'you@company.com' })}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${errors.email ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-company" className="block text-sm font-medium text-gray-700">
                  {intl.formatMessage({ id: 'landing.contact.form_company_label', defaultMessage: 'Company (optional)' })}
                </label>
                <input
                  id="contact-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={intl.formatMessage({ id: 'landing.contact.form_company_placeholder', defaultMessage: 'Your company' })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700">
                  {intl.formatMessage({ id: 'landing.contact.form_message_label', defaultMessage: 'Message' })}
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: '' })); }}
                  placeholder={intl.formatMessage({ id: 'landing.contact.form_message_placeholder', defaultMessage: 'Tell me about your project...' })}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none ${errors.message ? 'border-red-300' : 'border-gray-200'}`}
                />
                {errors.message && <p className="text-xs text-red-600">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full rounded-xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshIcon className="size-4 animate-spin" />
                    {intl.formatMessage({ id: 'landing.contact.form_submitting', defaultMessage: 'Sending…' })}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <SendIcon className="size-4" />
                    {intl.formatMessage({ id: 'landing.contact.form_submit', defaultMessage: 'Send Message' })}
                  </span>
                )}
              </button>
            </form>
          )}

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <a
              href="mailto:hello@fathonidev.com"
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
            >
              <LetterIcon className="size-4 text-blue-800" />
              hello@fathonidev.com
            </a>
            <a
              href="https://github.com/fathonialimukti"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
            >
              <Icon icon="mdi:github" className="size-4" />
              {intl.formatMessage({ id: 'landing.contact.github_label', defaultMessage: 'GitHub' })}
            </a>
            <a
              href="https://linkedin.com/in/fathonialimukti"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
            >
              <Icon icon="mdi:linkedin" className="size-4 text-blue-700" />
              {intl.formatMessage({ id: 'landing.contact.linkedin_label', defaultMessage: 'LinkedIn' })}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}