import { contactEmail } from "./marketingConfig";
import { usePageTitle } from "./usePageTitle";

const SECTIONS = [
  {
    title: "One-time buyout",
    body: "The WMS application is sold as a one-time purchase of the application, not a subscription. There is no monthly fee and no per-seat charge. Alongside the buyout, we customize your warehouse pipelines and workflows to fit how your company operates, within the system's documented transaction types.",
  },
  {
    title: "License",
    body: "The license agreement provided with your purchase governs modification rights, internal use, redistribution and ownership of customizations.",
    pending: true, // PLACEHOLDER: owner legal review — real license terms must replace this paragraph.
  },
  {
    title: "Source code",
    body: "Every tier includes delivery of the full application source code. The exact delivery list and handover method are stated in your agreement.",
    pending: true, // PLACEHOLDER: owner legal review — confirm exact delivery list / handover method.
  },
  {
    title: "Support & maintenance",
    body: "Because you own the source code, your team can maintain and modify the system directly. Any additional support or maintenance arrangement is confirmed in writing with you.",
    pending: true, // PLACEHOLDER: owner legal review — real support/maintenance terms and response times. No SLA is documented.
  },
  {
    title: "Customization scope",
    body: "Customization adapts the order of steps, rules, captured fields and approvals within the system's supported screens — receiving, found, RMA receipt, WIP completion, shipment, disposal, loss, return-to-supplier, WIP issue, sub-inventory transfer, stock count, purchase order, pallets, warehouses, SKUs, products and suppliers. It does not include building brand-new transaction types or entirely new product modules outside that set, or undocumented third-party integrations. Anything outside this boundary is scoped separately.",
    pending: true, // PLACEHOLDER: owner legal review — confirm precise in-scope vs out-of-scope wording.
  },
  {
    title: "Payment & delivery terms",
    body: "Payment terms, delivery schedule and what is included per tier are confirmed in your written agreement before any engagement.",
    pending: true, // PLACEHOLDER: owner legal review — real payment terms, delivery dates, refund/cancellation policy.
  },
];

function TermsPage() {
  usePageTitle("Terms — WMS", {
    description:
      "How the WMS is sold: one-time buyout, license, source code and customization scope.",
  });

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-terms" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Terms
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Terms of sale
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              A short summary of how the WMS is sold. This page is a working
              draft — the final terms are provided with your agreement.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <div className="mb-8 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold">Draft notice:</span> this page is
              pending legal review. Items still to be finalized are summarized
              here and confirmed in writing before any purchase.
            </p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {section.body}
                </p>
                {section.pending && (
                  <p className="mt-2 text-sm font-medium text-accent">
                    Contact us for the current terms.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-surface p-6">
            <p className="text-sm leading-relaxed text-muted">
              For the current terms, email{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="font-medium text-accent hover:underline"
              >
                {contactEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TermsPage;
