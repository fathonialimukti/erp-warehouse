import { useNavigate } from "react-router";
import { Button, Card, Chip } from "@heroui/react";
import { ArrowRightIcon, CheckCircleIcon } from "../landing/_LandingIcons";
import { contactEmail, pricingTiers } from "./marketingConfig";
import { usePageTitle } from "./usePageTitle";

function PricingPage() {
  const navigate = useNavigate();
  usePageTitle("Pricing — WMS", {
    description:
      "One-time buyout tiers for the WMS: Single Warehouse, Multi-Warehouse and Enterprise with full source code. No monthly fees.",
  });

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-pricing" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Pricing
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Own the system. One-time, no monthly fee.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The WMS application is bought once, not rented. Every tier
              includes the full application and its source code, plus a
              customization of your warehouse pipelines and workflows to fit how
              your company operates. Tiers differ by scope — single site,
              multi-site, or deeper customization and handover.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.id}
                className={`flex flex-col shadow-sm ${
                  tier.highlighted
                    ? "border-2 border-accent"
                    : "border border-border"
                }`}
              >
                <Card.Header>
                  <div className="flex items-center justify-between gap-3">
                    <Card.Title className="text-lg font-semibold text-foreground">
                      {tier.name}
                    </Card.Title>
                    {tier.highlighted && (
                      <Chip color="accent" variant="soft" size="sm">
                        Most common
                      </Chip>
                    )}
                  </div>
                  <Card.Description className="text-sm text-muted">
                    {tier.audience}
                  </Card.Description>
                </Card.Header>

                <Card.Content className="flex-1">
                  <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {tier.price}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {tier.priceNote}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {tier.inclusions.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-success" />
                        <span className="text-sm leading-relaxed text-foreground">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card.Content>

                <Card.Footer>
                  <Button
                    fullWidth
                    variant={tier.highlighted ? "primary" : "secondary"}
                    onPress={() => navigate("/contact")}
                  >
                    Contact us
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </Card.Footer>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-base font-semibold text-foreground">
              How one-time buyout works
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>
                You buy the application once — there is no monthly or per-seat
                subscription.
              </li>
              <li>
                Alongside the buyout we adapt your warehouse pipelines,
                approvals and roles to how your company operates, within the
                system&apos;s documented transaction types.
              </li>
              <li>
                Every tier includes the full application source code, so your
                team can maintain and extend the system directly. The Enterprise
                tier adds deeper customization and handover.
              </li>
              <li>
                Exact prices, inclusions and delivery terms are confirmed in
                writing before any engagement. Questions? Email{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-medium text-accent hover:underline"
                >
                  {contactEmail}
                </a>
                .
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PricingPage;
