import { useIntl } from "react-intl";
import { BrandIcon, type BrandName } from "../../components/BrandIcon";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const TECH_STACK: { label: string; icon: BrandName }[] = [
  { label: "React 19", icon: "react" },
  { label: "Three.js / R3F", icon: "threejs" },
  { label: "TypeScript", icon: "typescript" },
  { label: "tRPC", icon: "trpc" },
  { label: "Prisma", icon: "prisma" },
  { label: "Tauri", icon: "tauri" },
  { label: "HeroUI", icon: "heroui" },
  { label: "AI SDK", icon: "ai-sdk" },
  { label: "Tailwind CSS", icon: "tailwind" },
  { label: "PostgreSQL", icon: "postgresql" },
];

export function TechStackSection() {
  const intl = useIntl();

  return (
    <section id="tech-stack" className="bg-surface-secondary py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-10 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            {intl.formatMessage({
              id: "landing.tech_stack.title",
              defaultMessage: "Why You Can Trust It",
            })}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">
            {intl.formatMessage({
              id: "landing.tech_stack.headline",
              defaultMessage: "Your Data Stays Yours",
            })}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            {intl.formatMessage({
              id: "landing.tech_stack.description",
              defaultMessage:
                "Self-hosted database, role-based access, full audit trail — and a modern foundation that runs on desktop and in your browser.",
            })}
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
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm"
            >
              <BrandIcon name={t.icon} size={16} />
              {t.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
