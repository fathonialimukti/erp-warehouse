import { useNavigate } from 'react-router';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { LandingNavbar } from './landing/_LandingNavbar';
import { LandingHeroScene } from './landing/_LandingHeroScene';
import { GallerySection } from './landing/_GallerySection';
import { ProcessSection } from './landing/_ProcessSection';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const STATS = [
  { value: '5+', label: 'Years Experience' },
  { value: '20+', label: 'Projects Delivered' },
  { value: '100%', label: 'TypeScript Strict' },
  { value: 'Solo', label: 'End-to-End Delivery' },
];

const SERVICES = [
  {
    icon: 'solar:3d-square-bold-duotone',
    title: '3D Interactive Applications',
    description:
      'Immersive web experiences built with React Three Fiber — from product configurators to spatial dashboards and virtual environments.',
    features: ['Real-time 3D rendering', 'Interactive scene navigation', 'GLB/GLTF model integration', 'WebGL optimization'],
  },
  {
    icon: 'solar:robot-bold-duotone',
    title: 'AI Agent Integration',
    description:
      'Intelligent assistants embedded into your business tools — natural language queries, automated workflows, and context-aware recommendations.',
    features: ['Custom RAG pipelines', 'Natural language interfaces', 'Tool-calling agents', 'Business logic integration'],
  },
  {
    icon: 'solar:box-minimalistic-bold-duotone',
    title: 'Enterprise Systems & ERP',
    description:
      'Full-stack business applications with complex workflows, role-based access, audit trails, and production-grade reliability.',
    features: ['Transaction management', 'Approval workflows', 'Role-based access control', 'Reporting & analytics'],
  },
];

const TECH_STACK = [
  { label: 'React 19', icon: 'logos:react' },
  { label: 'Three.js / R3F', icon: 'logos:threejs' },
  { label: 'TypeScript', icon: 'logos:typescript-icon' },
  { label: 'tRPC', icon: 'solar:code-bold' },
  { label: 'Prisma', icon: 'simple-icons:prisma' },
  { label: 'Tauri', icon: 'simple-icons:tauri' },
  { label: 'HeroUI', icon: 'solar:palette-bold' },
  { label: 'AI SDK', icon: 'solar:stars-bold' },
  { label: 'Tailwind CSS', icon: 'logos:tailwindcss-icon' },
  { label: 'PostgreSQL', icon: 'logos:postgresql' },
];

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNavbar />

      {/* ── 1. Hero ── */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(219,234,254,0.6),transparent_55%)] pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-8">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-800">
                <Icon icon="solar:star-bold" className="size-3" />
                One-Man Enterprise Studio
              </span>
              <h1 className="text-4xl leading-tight font-bold tracking-tight text-gray-900 lg:text-5xl xl:text-6xl">
                Enterprise Systems
                <span className="block text-blue-900">That Think.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-gray-600">
                I build complex business applications that combine{' '}
                <strong className="text-gray-800">3D interfaces</strong>,{' '}
                <strong className="text-gray-800">AI agents</strong>, and{' '}
                <strong className="text-gray-800">ERP logic</strong> — turning operations into tools
                people actually want to use.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onPress={() => navigate('/login')}>
                <Icon icon="solar:play-bold" className="size-4" />
                Try the Live Demo
              </Button>
              <Button
                variant="secondary"
                onPress={() => document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Icon icon="solar:gallery-bold" className="size-4" />
                See My Work
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-sm text-gray-500">
              {['Production-Ready', 'End-to-End Solo', 'TypeScript Strict'].map((badge) => (
                <div key={badge} className="flex items-center gap-1.5">
                  <Icon icon="solar:check-circle-bold" className="size-4 text-blue-800" />
                  {badge}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative h-105 overflow-hidden rounded-3xl border border-blue-100 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96)_60%,rgba(37,99,235,0.8))] shadow-2xl lg:h-125"
          >
            <LandingHeroScene />
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-black/40 px-3 py-2 text-xs font-medium text-white/80 backdrop-blur-sm">
              <Icon icon="solar:3d-square-bold-duotone" className="mr-1.5 inline size-3.5 text-blue-300" />
              Live 3D Warehouse Model — Interactive
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. Social Proof Bar ── */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
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
                <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Portfolio Showcase ── */}
      <GallerySection />

      {/* ── 4. Process (How I Work) ── */}
      <ProcessSection />

      {/* ── 5. Services ── */}
      <section id="services" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-16 space-y-3 text-center"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-blue-800">Services</p>
            <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">What I Offer</h2>
            <p className="mx-auto max-w-2xl text-gray-600">
              Three core capabilities that turn complex business requirements into software people love.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
            {SERVICES.map((service, i) => (
              <motion.div
                key={service.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 32 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.12 } },
                }}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-8 transition-shadow hover:shadow-md"
              >
                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-blue-50">
                  <Icon icon={service.icon} className="size-7 text-blue-900" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-900">{service.title}</h3>
                <p className="mb-6 leading-relaxed text-gray-600">{service.description}</p>
                <ul className="space-y-2.5">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <Icon icon="solar:check-circle-bold" className="size-4 text-blue-800" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Tech Stack ── */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-10 text-center"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-blue-800">Tech Stack</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Built With Modern Tools</h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-600">
              Battle-tested technologies chosen for reliability, performance, and developer experience.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-wrap justify-center gap-3"
          >
            {TECH_STACK.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm"
              >
                <Icon icon={t.icon} className="size-4" />
                {t.label}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 7. About ── */}
      <section id="about" className="bg-blue-900 py-20 text-white lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="space-y-6"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-blue-300">About Me</p>
            <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
              Your One-Man Agency for
              <span className="block text-blue-300"> Complex Web Solutions</span>
            </h2>
            <p className="leading-relaxed text-blue-100">
              I'm <strong className="text-white">Fathoni Ali Mukti</strong> — a full-stack developer
              and 3D web specialist. I design, build, and deliver production-ready enterprise
              applications solo, end-to-end.
            </p>
            <p className="leading-relaxed text-blue-100">
              This ERP warehouse suite is a live demonstration of my capabilities: real-time 3D scene
              management, AI-augmented workflows, role-based access, and a polished UI — all built by
              one person.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="primary" onPress={() => navigate('/login')}>
                <Icon icon="solar:play-bold" className="size-4" />
                Try the Demo
              </Button>
              <Button
                variant="secondary"
                onPress={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Icon icon="solar:letter-linear" className="size-4" />
                Get in Touch
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="space-y-4"
          >
            {[
              {
                icon: 'solar:user-hand-up-bold',
                title: 'Solo Delivery',
                desc: 'No handoffs. I own the project from discovery to deployment.',
              },
              {
                icon: 'solar:diploma-bold',
                title: 'Full-Stack Specialist',
                desc: 'Frontend 3D, backend APIs, database design, and DevOps — all in-house.',
              },
              {
                icon: 'solar:chat-round-bold',
                title: 'Direct Communication',
                desc: 'No project managers. You talk to the engineer building your system.',
              },
              {
                icon: 'solar:shield-check-bold',
                title: 'Production-Proven',
                desc: 'Real transaction workflows, audit trails, and role-based security.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-800">
                  <Icon icon={item.icon} className="size-5 text-blue-200" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{item.title}</h4>
                  <p className="mt-0.5 text-sm text-blue-200">{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 8. CTA Section ── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#1e3a8a,#1e40af_50%,#2563eb)] px-8 py-16 text-center text-white shadow-xl lg:px-16 lg:py-20"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
            <div className="relative mx-auto max-w-2xl space-y-6">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-200">
                See It in Action
              </p>
              <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
                The Best Way to Understand
                <span className="block text-blue-200">Is to Try It Yourself.</span>
              </h2>
              <p className="mx-auto max-w-lg text-blue-100">
                Log into the live demo and explore the 3D warehouse, chat with the AI assistant, and
                run real transactions. No signup required.
              </p>
              <Button
                variant="primary"
                className="bg-white text-blue-900 hover:bg-blue-50"
                onPress={() => navigate('/login')}
                size="lg"
              >
                <Icon icon="solar:play-bold" className="size-5" />
                Launch the Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 9. Contact ── */}
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
              <p className="text-xs font-bold uppercase tracking-widest text-blue-800">Contact</p>
              <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl">Ready to Build Something?</h2>
              <p className="text-gray-600">
                Have a project in mind? Let's talk about how I can help your business.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="mailto:hello@fathonidev.com"
                className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
              >
                <Icon icon="solar:letter-bold" className="size-4 text-blue-800" />
                hello@fathonidev.com
              </a>
              <a
                href="https://github.com/fathonialimukti"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
              >
                <Icon icon="mdi:github" className="size-4" />
                GitHub
              </a>
              <a
                href="https://linkedin.com/in/fathonialimukti"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
              >
                <Icon icon="mdi:linkedin" className="size-4 text-blue-700" />
                LinkedIn
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 10. Footer ── */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row lg:px-10">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-blue-900">
              <Icon icon="solar:buildings-3-bold" className="size-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-700">FAM Studio</span>
          </div>
          <p className="text-sm text-gray-500">© 2025 Fathoni Ali Mukti · All rights reserved.</p>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium text-blue-800 transition hover:text-blue-900"
          >
            Try the Demo →
          </button>
        </div>
      </footer>
    </div>
  );
}

export { LandingPage };
