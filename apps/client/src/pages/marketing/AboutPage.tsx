import { Card } from "@heroui/react";
import { companyBlurb, companyName, contactEmail } from "./marketingConfig";
import { usePageTitle } from "./usePageTitle";

const PRINCIPLES = [
  {
    title: "Parity first",
    body: "Desktop and web share one codebase, so every feature ships in both places. No feature is stranded on one platform.",
  },
  {
    title: "Warehouse-native",
    body: "The interface is designed for floor operators — keyboard shortcuts, dense data and fast transactions — not for a demo screen.",
  },
  {
    title: "Visibility through 3D",
    body: "Spatial understanding of stock comes from a live 3D warehouse layout, showing where pallets actually sit.",
  },
  {
    title: "Agent-assisted workflows",
    body: "The integrated AI assistant handles navigation and form filling, so people spend their attention on exceptions instead.",
  },
  {
    title: "Permissioned transparency",
    body: "Every route and action is gated by a resource@action permission, and the UI reflects exactly what a role can do.",
  },
];

function AboutPage() {
  usePageTitle("About — WMS", {
    description:
      "WMS is a full-stack warehouse management system built end-to-end by a single developer, shipping as desktop and web from one codebase.",
  });

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-about" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              About
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Built end-to-end, from the warehouse floor up.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              {companyBlurb}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                The product
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                {companyName} tracks stock movement across warehouses and
                storage locations in real time. Staff record inbound receipts,
                putaway, picking, dispatch, returns, disposals, losses and WIP
                against SKU and pallet granularity, while managers approve draft
                transactions, review inventory aging and audit activity logs.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Every transaction type runs through a Draft → Proposed →
                Approved / Rejected approval workflow, with history tracked per
                entity. The same client ships as a Tauri desktop app for the
                warehouse floor and a web app for remote management.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                How it&apos;s built
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PRINCIPLES.map((p) => (
                  <Card
                    key={p.title}
                    className="border border-border shadow-sm"
                  >
                    <Card.Header>
                      <Card.Title className="text-sm font-semibold text-foreground">
                        {p.title}
                      </Card.Title>
                    </Card.Header>
                    <Card.Content>
                      <p className="text-sm leading-relaxed text-muted">
                        {p.body}
                      </p>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-background p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Want to see it against your own process?
              </h2>
              <p className="mt-1 text-sm text-muted">
                Tell us how your warehouse runs and we&apos;ll map it to what
                gets customized.
              </p>
            </div>
            <a
              href={`mailto:${contactEmail}`}
              className="shrink-0 text-sm font-semibold text-accent transition hover:opacity-80"
            >
              {contactEmail}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;
