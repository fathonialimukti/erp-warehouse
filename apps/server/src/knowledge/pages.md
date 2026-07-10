# Page Purpose Reference

Use this document to map user intent to the correct page. It is intentionally written for RAG so the assistant can infer where to navigate for any module.

## Core Navigation Pattern

For most modules:
- List page: browse, search, or manage records
- `/new`: create a new record
- `/:id`: view a specific record
- `/:id/edit`: edit a specific record

If the user says "add", "create", or "new", prefer the create page.
If the user says "view", "manage", "search", or "browse", prefer the list page.
If the user references an existing record by name or id, prefer the detail page.

## Main Pages

| Route | Purpose |
|---|---|
| `/dashboard` | Overview of the ERP system and key operational entry point |
| `/notifications` | View system notifications and alerts |
| `/stock-movement` | Inspect stock movement history across the warehouse |
| `/activity-logs` | Review audit trail and system actions |
| `/login` | Authenticate into the application |

## Master Data Modules

| Module | List Route | Create Route | Detail Route | Edit Route | Purpose |
|---|---|---|---|---|---|
| Users | `/users` | `/users/new` | `/users/:id` | `/users/:id/edit` | Manage system users and their access |
| Roles | `/access-control/roles` | `/access-control/roles/new` | n/a | `/access-control/roles/:id/edit` | Manage roles and permissions |
| Warehouses | `/warehouse` | `/warehouse/new` | `/warehouse/:id` | `/warehouse/:id/edit` | Manage warehouse master data and storage site details |
| Suppliers | `/suppliers` | `/suppliers/new` | `/suppliers/:id` | `/suppliers/:id/edit` | Manage supplier info and their raw/packaging material SKUs |
| Products | `/products` | `/products/new` | `/products/:id` | `/products/:id/edit` | Manage finished good SKUs |
| SKU Overview | `/skus` | n/a | `/skus/:id` | n/a | Read-only view of all SKUs across Raw Material, Packaging Material, and Finished Goods tabs |

## SKU Page Notes

- `/skus` is a **read-only** overview — no create or edit actions from this page
- It shows 3 tabs: **Raw Material**, **Packaging Material**, **Finished Goods**
- To create or edit a raw/packaging material SKU → go to the Supplier page (`/suppliers/:id`)
- To create or edit a finished good SKU → go to the Product page (`/products`)

## Inbound Transaction Modules

| Module | List Route | Create Route | Detail Route | Edit Route | Purpose |
|---|---|---|---|---|---|
| Receiving | `/inbound-transaction` | `/inbound-transaction/receiving/new` | `/inbound-transaction/receiving/:id` | `/inbound-transaction/receiving/:id/edit` | Record incoming goods from suppliers |
| Found | `/inbound-transaction` | `/inbound-transaction/found/new` | `/inbound-transaction/found/:id` | `/inbound-transaction/found/:id/edit` | Record stock found during cycle count or inspection |
| RMA Receipt | `/inbound-transaction` | `/inbound-transaction/rma-receipt/new` | `/inbound-transaction/rma-receipt/:id` | `/inbound-transaction/rma-receipt/:id/edit` | Record returned merchandise received back into stock |
| WIP Completion | `/inbound-transaction` | `/inbound-transaction/wip-completion/new` | `/inbound-transaction/wip-completion/:id` | `/inbound-transaction/wip-completion/:id/edit` | Record completed work-in-progress output into inventory |

## Outbound Transaction Modules

| Module | List Route | Create Route | Detail Route | Edit Route | Purpose |
|---|---|---|---|---|---|
| Shipment | `/outbound-transaction` | `/outbound-transaction/shipment/new` | `/outbound-transaction/shipment/:id` | `/outbound-transaction/shipment/:id/edit` | Record outbound shipments to customers |
| Disposal | `/outbound-transaction` | `/outbound-transaction/disposal/new` | `/outbound-transaction/disposal/:id` | `/outbound-transaction/disposal/:id/edit` | Record scrapped or disposed inventory |
| Loss | `/outbound-transaction` | `/outbound-transaction/loss/new` | `/outbound-transaction/loss/:id` | `/outbound-transaction/loss/:id/edit` | Record inventory losses or damages |
| Return to Supplier | `/outbound-transaction` | `/outbound-transaction/return-to-supplier/new` | `/outbound-transaction/return-to-supplier/:id` | `/outbound-transaction/return-to-supplier/:id/edit` | Record goods returned to suppliers |
| WIP Issue | `/outbound-transaction` | `/outbound-transaction/wip-issue/new` | `/outbound-transaction/wip-issue/:id` | `/outbound-transaction/wip-issue/:id/edit` | Record materials issued to work-in-progress production |

## Detail Page Purpose Hints

When the user asks about a record or action on a detail page:
- `edit` means open the matching edit route
- `delete` means use the delete action on the detail or list page if available
- `approve`, `reject`, or `propose` means stay on the document detail page and use the workflow buttons
- `layout` for warehouse means open `/warehouse/:id/layout` to inspect the warehouse layout view

## Usage Guidance for the Assistant

- Use the page purpose above to infer the most likely destination from plain language.
- If the user request is ambiguous, ask one short clarifying question instead of guessing.
- For navigation requests, call `navigateTo` with the inferred route.
- For page actions, describe where to click or find what they need in plain language after navigating.

## Analytics & Reports

| Module | Route | Purpose |
|---|---|---|
| Inventory Aging Analyzer | `/inventory-aging` | Dashboard for dead stock, slow-moving inventory, value-at-risk with 3D zone heatmap |
| Analytics Charts | `/reports/charts` | Tabs: Transaction Velocity (stacked bars), ABC Pareto (bar+line), Approval Cycle Time (horizontal bars) |
| Monthly Stock Report | `/reports/monthly-stock-movement` | Stock list per warehouse, drill-down to SKU detail |
| Inventory Balance | `/reports/inventory-balance` | Monthly inventory snapshot with ComposedChart and summary table |
| Pallets | `/pallets` | Pallet-level inventory — view all pallets and their details |
