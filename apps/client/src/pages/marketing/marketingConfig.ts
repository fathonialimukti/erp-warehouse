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
  /** Displayed starting price (USD, one-time). */
  price: string;
  /** Small print under the price (IDR equivalent, cadence, terms). */
  priceNote: string;
  /** Per-tier inclusions. Text only — keep grounded in PRODUCT.md capabilities. */
  inclusions: string[];
  /** Marks the recommended tier visually. */
  highlighted?: boolean;
};

// Starting prices from PRICING-RESEARCH.md §1, fixed 2026-11-27. One-time, source included; final scope quoted after discovery.
export const pricingTiers: PricingTier[] = [
  {
    id: "single",
    name: "Single Warehouse",
    audience: "One warehouse, one operating team.",
    price: "From $12,000",
    priceNote: "≈ Rp 218 jt · one-time · source included",
    inclusions: [
      "Full application + source code",
      "Full WMS web application, deployed to your infrastructure",
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
    price: "From $24,000",
    priceNote: "≈ Rp 437 jt · one-time · source included",
    highlighted: true,
    inclusions: [
      "Full application + source code",
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
    price: "From $40,000",
    priceNote: "≈ Rp 728 jt · one-time · source included",
    inclusions: [
      "Full application + source code + deeper pipeline/approval customization + handover",
      "Everything in Multi-Warehouse",
      "Deeper customization of pipelines and approvals",
      "WMS AI assistant knowledge base tuned to your processes",
      "Handover so your team can maintain and extend the system",
    ],
  },
];

/** Published program — makes discounts visible so buyers never feel cheated. */
export const foundingPartnerNote =
  "From prices cover a standard deployment. Pipelines, approvals, roles, reports and printout documents are scoped and quoted after discovery — every warehouse works differently. Founding Partner: 25% off the starting price for our first 2–3 customers, in exchange for a case study and two reference calls. Local Indonesian buyers may qualify for the same 25% when they self-host and self-load data.";

/** What the "from" price includes, and how extra scope is priced. */
export const scopeNote =
  "Each starting price includes a standard deployment plus initial workflow configuration. Additional workflows, custom documents and integrations are quoted per item after discovery. Pricing is USD-denominated; IDR is shown at the current rate, not locked.";

// PLACEHOLDER: owner to set — real contact email.
export const contactEmail = "sales@example.com";
// PLACEHOLDER: owner to set — real booking / demo scheduling URL.
export const bookingUrl = "https://example.com/book-a-demo";
// PLACEHOLDER: owner to set — company legal name.
export const companyName = "WMS";
// PLACEHOLDER: owner to set — company / product blurb for about + footer.
export const companyBlurb =
  "WMS is a full-stack warehouse management system built end-to-end by a single developer: one React codebase that ships as a web app, with a live 3D warehouse view and an integrated AI assistant.";

// PLACEHOLDER: owner to set — real social links. Empty string hides the link.
export const socialLinks: { label: string; url: string }[] = [
  { label: "GitHub", url: "" },
  { label: "LinkedIn", url: "" },
];
