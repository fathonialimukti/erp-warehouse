import { Accordion } from "@heroui/react";
import { ChevronDownIcon } from "../landing/_LandingIcons";
import { contactEmail } from "./marketingConfig";
import { usePageTitle } from "./usePageTitle";

interface FaqItem {
  /** Stable slug — used for the Accordion key and React key. */
  id: string;
  question: string;
  answer: string;
  /** Rendered under the answer as a neutral line when a real value is pending. */
  pending?: boolean;
}

interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

// Source: docs/marketing/faq-objections.md — answers kept faithful to the doc.
// Where the doc carries a `[PLACEHOLDER]`, the answer stays neutral and links
// the reader to "contact us" instead of inventing a value.
const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "pricing",
    title: "Pricing & one-time buyout",
    items: [
      {
        id: "buyout-vs-saas",
        question: "Why a one-time buyout instead of a monthly subscription?",
        answer:
          "This is a one-time purchase of the full WMS application and its source code — not SaaS, and there's no monthly fee. You own the system. Alongside the buyout, we adjust your warehouse pipelines and workflows to fit how your company operates.",
        pending: true, // PLACEHOLDER: real one-time price, inclusions, tiers/options
      },
      {
        id: "price-inclusions",
        question: "What does the price include?",
        answer:
          "Pricing tiers and what each one includes are listed on the pricing page. Exact inclusions — application, source code, workflow customization scope and delivery — are confirmed in writing before any engagement.",
        pending: true, // PLACEHOLDER: exact inclusions
      },
      {
        id: "maintenance-value",
        question: "Isn't ongoing maintenance worth paying for?",
        answer:
          "The buyout covers the application and source code. What is included for updates and support after delivery is confirmed in writing as part of your agreement — see the support questions below.",
        pending: true, // PLACEHOLDER: real support/maintenance terms
      },
    ],
  },
  {
    id: "customization",
    title: "Customized pipelines",
    items: [
      {
        id: "customize-meaning",
        question: "What do you mean by “we'll customize it for us”?",
        answer:
          "It means adapting your warehouse pipelines and workflows — the order of steps, the rules, the fields captured and the approvals — so the system fits how your company actually operates. For example, how a receiving or dispatch flow runs in your warehouse, and who signs off at each stage.",
      },
      {
        id: "customize-limits",
        question: "What's the limit? What won't you build?",
        answer:
          "Customization works within the system's documented transaction types and platform. We configure flows around the supported screens — receiving, found, RMA receipt, WIP completion, shipment, disposal, loss, return-to-supplier, WIP issue, sub-inventory transfer, stock count, purchase order, pallets, warehouses, SKUs/products/suppliers — and the approval and permission rules around them. It does not mean building brand-new transaction types or entirely new product modules outside that set, or undocumented third-party integrations. If you need something outside that boundary, we'll scope it separately with you.",
        pending: true, // PLACEHOLDER: confirm precise in-scope vs out-of-scope list with owner
      },
    ],
  },
  {
    id: "deployment",
    title: "Deployment — desktop and web",
    items: [
      {
        id: "desktop-and-web",
        question: "Does it run on our warehouse floor PCs and in the browser?",
        answer:
          "Yes. The same React application ships as a Tauri desktop app and as a web app — one codebase, so features ship in both. Desktop gives an install-once presence on the floor; web gives remote managers access.",
      },
      {
        id: "data-storage",
        question: "Where is data stored?",
        answer:
          "The app uses PostgreSQL via Prisma. With the buyout and source code, deployment and data placement are under your control. Deployment options and infrastructure requirements are confirmed with you before go-live.",
        pending: true, // PLACEHOLDER: real deployment options, infrastructure requirements, hosting/support offering
      },
    ],
  },
  {
    id: "source",
    title: "Source code ownership",
    items: [
      {
        id: "source-code-delivery",
        question: "Do we actually get the source code?",
        answer:
          "The Enterprise tier is a one-time buyout that includes the full application source code. The exact delivery list and handover method are confirmed in writing.",
        pending: true, // PLACEHOLDER: exact delivery list / repository handover method
      },
      {
        id: "license-terms",
        question: "What license applies, and what can we do with it?",
        answer:
          "License terms — modification rights, internal use, redistribution, sublicensing and ownership of customizations — are provided with your agreement. Contact us for the current terms.",
        pending: true, // PLACEHOLDER: real license terms
      },
    ],
  },
  {
    id: "support",
    title: "Support & maintenance",
    items: [
      {
        id: "post-launch-support",
        question: "What happens if something breaks after we go live?",
        answer:
          "Because you own the source code, your team can maintain and modify the system directly. Any additional support or maintenance arrangement is confirmed with you — and we'll be clear about what is included in the buyout versus what is a separate arrangement.",
        pending: true, // PLACEHOLDER: real support/maintenance offering and terms — no SLA documented
      },
      {
        id: "training",
        question: "Do you provide training?",
        answer:
          "The integrated WMS AI assistant helps users learn screens and forms by navigating and filling them on command. Training offerings are confirmed with you as part of the engagement.",
        pending: true, // PLACEHOLDER: real training offering and whether it is included
      },
    ],
  },
  {
    id: "delivery",
    title: "Implementation & migration",
    items: [
      {
        id: "timeline",
        question: "How long until we're live?",
        answer:
          "That depends on the scope of workflow customization, data migration and your deployment environment. We'll give you a written timeline after discovery. Indicative phases: discovery → customization of pipelines, approvals and roles → data setup and migration → testing → go-live.",
        pending: true, // PLACEHOLDER: real timeline / phase durations
      },
      {
        id: "data-migration",
        question: "Can you bring over our existing stock, SKUs and pallets?",
        answer:
          "We can plan a migration of your master data and opening balances. The app supports XLSX import and export, which we can use where formats align. Scope and approach depend on your current source systems and are agreed during discovery.",
        pending: true, // PLACEHOLDER: real migration scope, format requirements, and who performs it
      },
    ],
  },
  {
    id: "security",
    title: "Security & permissions",
    items: [
      {
        id: "permissions",
        question: "How do you control who sees and does what?",
        answer:
          "Every route and action is gated by resource@action permission pairs, and a role/permission matrix drives UI visibility. Authentication is JWT cookie-based with protected routes. Approval history is tracked per entity, and activity logs are available for audit.",
      },
      {
        id: "segregation-of-duties",
        question:
          "Can we enforce that the person who records a transaction cannot approve it?",
        answer:
          "Yes — that kind of segregation of duties can be configured through roles and approval rules. We'll map your approval matrix during discovery.",
        pending: true, // PLACEHOLDER: record and confirm compliance/audit requirements — do not claim certifications
      },
    ],
  },
];

function FaqPage() {
  usePageTitle("FAQ — WMS", {
    description:
      "Honest answers on the WMS one-time buyout, customization, deployment, source code and support.",
  });

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-faq" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              FAQ
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Questions, answered honestly.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Common questions about the one-time buyout, customization,
              deployment, source code and support. Where a detail depends on
              your agreement, we say so rather than guess.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-4xl space-y-10 px-6 lg:px-10">
          {FAQ_GROUPS.map((group) => (
            <div key={group.id}>
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                {group.title}
              </h2>
              <Accordion variant="surface" className="w-full">
                {group.items.map((item) => (
                  <Accordion.Item key={item.id} id={item.id}>
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        {item.question}
                        <Accordion.Indicator>
                          <ChevronDownIcon className="size-4" />
                        </Accordion.Indicator>
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body>
                        <p className="text-sm leading-relaxed text-muted">
                          {item.answer}
                        </p>
                        {item.pending && (
                          <p className="mt-2 text-sm font-medium text-accent">
                            Contact us for current terms.
                          </p>
                        )}
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </div>
          ))}

          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-sm text-muted">
              Still have a question? Email{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="font-medium text-accent hover:underline"
              >
                {contactEmail}
              </a>{" "}
              or{" "}
              <a
                href="/contact"
                className="font-medium text-accent hover:underline"
              >
                request a demo
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FaqPage;
