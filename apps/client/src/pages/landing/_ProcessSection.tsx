import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const STEPS = [
  {
    icon: 'solar:magnifer-bold-duotone',
    title: 'Discover',
    description: 'I learn your operations, pain points, and business goals through deep-dive workshops.',
    color: 'text-blue-800',
    bg: 'bg-blue-50',
  },
  {
    icon: 'solar:pen-new-round-bold-duotone',
    title: 'Design',
    description: 'Wireframes, 3D prototypes, and architecture blueprints tailored to your workflow.',
    color: 'text-purple-800',
    bg: 'bg-purple-50',
  },
  {
    icon: 'solar:code-bold-duotone',
    title: 'Build',
    description: 'Iterative development with weekly demos and feedback loops — you see progress every step.',
    color: 'text-green-800',
    bg: 'bg-green-50',
  },
  {
    icon: 'solar:rocket-bold-duotone',
    title: 'Deliver',
    description: 'Production deployment, documentation, training, and ongoing support to ensure success.',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
  },
];

function ProcessSection() {
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
          <p className="text-xs font-bold uppercase tracking-widest text-blue-800">Process</p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">How I Work</h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            A proven 4-step process that turns complex requirements into production-ready systems.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
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
                  <Icon icon={step.icon} className={`size-7 ${step.color}`} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">0{i + 1}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { ProcessSection };
