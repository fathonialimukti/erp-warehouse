/**
 * Marketing site — single edit point.
 *
 * The owner edits THIS FILE to set prices, inclusions, contact details and
 * company copy. Every placeholder below is marked `PLACEHOLDER` — replace the
 * value and delete the comment once the real value is confirmed.
 *
 * Rules baked into the content:
 * - Business model is a ONE-TIME buyout of the app + source code. No monthly fee, no SaaS.
 * - No fabricated proof. No customer logos, testimonials, benchmarks, uptime/SLA claims.
 * - English only.
 */

export type PricingTier = {
  /** Stable id, used for React keys only. */
  id: "single" | "multi" | "enterprise";
  name: string;
  /** Short "who this is for" line. */
  audience: string;
  /** Displayed price. PLACEHOLDER until the owner sets final numbers. */
  price: string;
  /** Small print under the price (billing cadence, terms). */
  priceNote: string;
  /** Per-tier inclusions. Text only — keep grounded in PRODUCT.md capabilities. */
  inclusions: string[];
  /** Marks the recommended tier visually. */
  highlighted?: boolean;
};

// PLACEHOLDER: owner to set — exact tier names.
// PLACEHOLDER: owner to set — every price + priceNote value below.
// PLACEHOLDER: owner to set — depth of custom pipeline work per tier.
export const pricingTiers: PricingTier[] = [
  {
    id: "single",
    name: "Single Warehouse",
    audience: "One warehouse, one operating team.",
    price: "Price on request", // PLACEHOLDER: owner to set — one-time price
    priceNote: "One-time buyout", // PLACEHOLDER: owner to set — payment terms
    inclusions: [
      "Full WMS application — desktop (Tauri) and web, one codebase",
      "Single-warehouse deployment and data setup",
      "Warehouse pipeline and workflow customization for that site",
      "Inbound, outbound, WIP, transfers, stock counts and purchase orders",
      "Approval workflows (Draft → Proposed → Approved / Rejected) and roles",
      "Reports: stock movement, inventory aging, balance snapshots",
      "English and Indonesian UI",
    ],
  },
  {
    id: "multi",
    name: "Multi-Warehouse",
    audience: "Several warehouses under one operation.",
    price: "Price on request", // PLACEHOLDER: owner to set — one-time price
    priceNote: "One-time buyout", // PLACEHOLDER: owner to set — payment terms
    highlighted: true,
    inclusions: [
      "Everything in Single Warehouse",
      "Multi-warehouse deployment across sites",
      "Pipeline customization across warehouses",
      "Warehouse-scoped permissions and user assignments",
      "Cross-warehouse stock movement and 3D layout views",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "Teams that want to own and extend the codebase.",
    price: "Price on request", // PLACEHOLDER: owner to set — one-time price
    priceNote: "One-time buyout · source code included", // PLACEHOLDER: owner to set
    inclusions: [
      "Everything in Multi-Warehouse",
      "Full application source code delivery",
      "Deeper customization of pipelines and approvals",
      "WMS AI assistant knowledge base tuned to your processes",
      "Handover so your team can maintain and extend the system",
    ],
  },
];

// PLACEHOLDER: owner to set — real contact email.
export const contactEmail = "sales@example.com";
// PLACEHOLDER: owner to set — real booking / demo scheduling URL.
export const bookingUrl = "https://example.com/book-a-demo";
// PLACEHOLDER: owner to set — company legal name.
export const companyName = "WMS";
// PLACEHOLDER: owner to set — company / product blurb for about + footer.
export const companyBlurb =
  "WMS is a full-stack warehouse management system built end-to-end by a single developer: one React codebase that ships as a native desktop app and a web app, with a live 3D warehouse view and an integrated AI assistant.";

// PLACEHOLDER: owner to set — real social links. Empty string hides the link.
export const socialLinks: { label: string; url: string }[] = [
  { label: "GitHub", url: "" },
  { label: "LinkedIn", url: "" },
];
