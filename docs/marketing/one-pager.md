# WMS — Enterprise Systems That Think

## What it is

A full-stack **Warehouse Management System** that tracks stock movement across warehouses and storage locations in real time. Staff record inbound receipts, RMA returns, WIP completions, shipments, disposals, losses and subinventory transfers at SKU and pallet granularity; managers approve drafts, review inventory aging, monitor dispatch and audit activity. The same application ships as an install-once Tauri desktop app for the warehouse floor and as a browser app for remote management.

## Who it's for

- **Warehouses and distribution companies** that need real-time stock visibility at SKU and pallet level.
- **Primary users:** warehouse administration staff and operators who record transactions, and the managers / department heads who approve transactions, review aging, monitor dispatch and audit activity.
- Teams operating in **English or Indonesian** (both locales supported).
- Organizations that want to **own their system** — the application and its source code — rather than rent it.

## What's included in the buyout

A one-time purchase delivers the full WMS application **and its source code**:

- **Inbound workflows:** receiving, "found" stock, RMA receipts, WIP completions.
- **Outbound workflows:** shipment, disposal, loss, return-to-supplier, WIP issue.
- **Supporting operations:** subinventory transfers, stock counts, purchase orders, pallets, warehouses, SKUs, products, suppliers.
- **Approval workflow:** every transaction moves DRAFT → PROPOSED → APPROVED / REJECTED, with approval history tracked per entity.
- **Reporting:** monthly stock movement with SKU-level detail, inventory balance snapshot, inventory aging, expiry report, and chart dashboards.
- **Access control:** role/permission matrix driving UI visibility, with every route gated by `resource@action` permission pairs.
- **AI assistant ("WMS AI"):** an integrated agent with knowledge-base retrieval, page navigation, form filling and page-context reading.
- **Platform:** Tauri desktop shell + web client from one codebase, JWT cookie authentication, SSE notifications, XLSX import/export, QR generation, light/dark themes.
- **Source code:** the complete codebase, delivered with the buyout — see [`faq-objections.md`](faq-objections.md) for ownership terms. `[PLACEHOLDER: exact list/locations of source delivered, license terms, and delivery method]`

## Differentiators (grounded in the product)

- **Desktop + web parity from one codebase.** The same React/Vite application ships as both a Tauri desktop app and a web app — no duplicated native-wrapper and browser products. Features ship everywhere.
- **3D warehouse visualizer.** A React Three Fiber layout viewer shows real-time pallet positioning, with GLTF/OBJ model support — spatial understanding of stock, not just rows in a table.
- **Integrated AI agent ("WMS AI").** Built on the Vercel AI SDK with SSE streaming, retrieval from the knowledge base via PostgreSQL full-text search, and tool-calling that can navigate pages, fill forms and read page context. It is part of the WMS, not a separate add-on product.
- **Approval on every transaction type.** DRAFT → PROPOSED → APPROVED/REJECTED, with per-entity approval history — control built into the workflow, not bolted on.
- **`resource@action` permissions.** Every route and action is gated by resource-action pairs and surfaced in the UI; the role/permission matrix drives what each user sees and can do.
- **Multi-language (EN / ID).** English and Indonesian locales via react-intl — one system for mixed-language teams.
- **Real reporting.** Monthly stock movement, inventory balance, inventory aging, expiry and chart dashboards, with SKU-level drill-down.

## The offer

**One-time buyout. Own the system.**

- Pay once for the full WMS application **and its source code** — no SaaS subscription, no monthly fee.
- Your purchase includes **workflow customization**: your warehouse pipelines and transaction flows are adjusted to fit how your company actually operates.
- Deploy on your own infrastructure, on the desktop floor or in the browser. `[PLACEHOLDER: deployment/support options and terms]`

**Pricing:** `[PLACEHOLDER: one-time buyout price, what it includes, any tiers/options]`

**Contact / next step:** `[PLACEHOLDER: sales contact name, email, phone, booking URL]`

---

_All capabilities above are documented in the product repository. Specific customers, benchmarks, case studies, prices and SLA targets are not asserted here — fill real values via placeholders before external use._
