# Discovery Checklist

**Goal:** find out which process this prospect actually wants to change, then map each answer to what can be customized in return. Capture answers in the prospect's own words — they become the talking points in the demo.

> **Open with this question:** **"Which process do you want to change?"** Let them answer before you describe the product. Everything else in this checklist is in service of that one answer.

For every item below, ask the question, record the answer, and note what gets customized in return. Customization means adapting the customer's warehouse pipelines and workflows to fit how their company operates — within the documented transaction types and platform (see the boundary in [`faq-objections.md`](faq-objections.md)).

---

## 1. The process to change (lead with this)

- Which process hurts most today — receiving, putaway, picking, dispatch/shipping, returns/RMA, WIP, stock counting, or reporting?
- What happens today, step by step, from goods arriving (or being requested) to the stock record being final?
- Where does it break down — delays, errors, double entry, lack of approval, no visibility?
- What would "fixed" look like for you?

**Customized in return:** the order and rules of that pipeline — which screens/steps a user moves through, what data is captured at each step, and which steps require approval — are aligned to this process. `[PLACEHOLDER: record the specific pipeline/flow to be configured]`

## 2. Warehouse type

- What kind of operation is this — raw materials, finished goods, distribution, cold chain, bonded, e-commerce fulfilment, manufacturing support?
- Do you hold stock at SKU level, pallet level, or both?
- Any special handling (expiry dates, lots, temperature, hazardous)?

**Customized in return:** how warehouses, storage locations, SKUs and pallets are set up, and which fields/attributes matter on each transaction. Expiry and aging views are available where relevant.

## 3. Transaction types used

Confirm which of these you actually run, and their local names:

- Receiving / inbound
- Putaway
- Picking
- Dispatch / shipment
- Returns / RMA (customer returns and returns to supplier)
- WIP issue / completion
- Disposals, losses, "found" stock
- Subinventory transfers
- Stock counts
- Purchase orders

**Customized in return:** the active transaction set and pipeline for your operation is configured around only the types you use; screens and approval rules are aligned to your real sequence. Documented screens include inbound (receiving, found, RMA receipt, WIP completion), outbound (shipment, disposal, loss, return-to-supplier, WIP issue), subinventory transfer, stock count and purchase order.

## 4. Approval rules

- Which transactions must be approved, and by whom?
- Do different values, warehouses or roles require different approvers?
- Should anything be auto-approved or require two steps?
- Do you need a full approval history for audits?

**Customized in return:** the DRAFT → PROPOSED → APPROVED/REJECTED flow is configured to your rules, with approver roles and per-entity approval history. `[PLACEHOLDER: record the customer's approval matrix]`

## 5. Scale — warehouses, locations, pallets, SKUs

- How many warehouses / sites?
- Storage locations per warehouse?
- Approximate active pallets?
- Approximate active SKUs?
- Transaction volume per day/week? `[PLACEHOLDER: capture real numbers]`

**Customized in return:** warehouse/location/pallet/SKU structure and reporting views are sized and organized to your operation; dashboards and drill-downs are configured around the entities you actually manage.

## 6. User roles

- Who uses the system, and in what roles (operator, admin, manager, department head, auditor)?
- What should each role be able to see and do?
- Any segregation-of-duties requirements (e.g. the recorder cannot approve)?

**Customized in return:** roles and the `resource@action` permission matrix are configured to match your org chart, driving menu visibility and permitted actions per role.

## 7. Existing systems and integrations

- What systems do you run today (ERP, accounting, WMS, warehouse automation, scanners)?
- Where does stock data come from and where does it need to go?
- Do you need XLSX import/export, QR labelling, or scanner/barcode workflows?
- What must be replaced vs. kept?

**Customized in return:** import/export templates and QR labelling are adapted to your data formats; integration scope is identified. `[PLACEHOLDER: document any integration requirements and confirm what is in scope with the owner — do not promise undocumented integrations]`

## 8. Reporting needs

- Which reports do you need to see, and who sees them?
- Monthly stock movement, inventory balance, inventory aging, expiry, dispatch/dispatch-queue monitoring, SKU-level detail?
- Any recurring report pack or export format?

**Customized in return:** which reports are emphasized, how dashboards are arranged, and which fields/filters matter — configured to the views your managers actually use.

## 9. Deployment constraints

- Desktop on the warehouse floor, browser access for remote staff, or both?
- Offline requirements?
- Where must data live — your own servers, a specific region, air-gapped?
- Any IT policies, OS requirements, or infrastructure limits?
- Language(s) needed — English, Indonesian, or both?

**Customized in return:** deployment shape (Tauri desktop, web, or both), language/locale set, and data placement are planned around your constraints. Ownership of the source code means deployment stays under your control. `[PLACEHOLDER: record specific infrastructure and hosting constraints]`

---

## Capture sheet (copy into your notes)

| Topic                                | Prospect's answer | What gets customized |
| ------------------------------------ | ----------------- | -------------------- |
| Process to change                    |                   |                      |
| Warehouse type                       |                   |                      |
| Transaction types                    |                   |                      |
| Approval rules                       |                   |                      |
| Scale (sites/locations/pallets/SKUs) |                   |                      |
| User roles                           |                   |                      |
| Existing systems                     |                   |                      |
| Reporting needs                      |                   |                      |
| Deployment constraints               |                   |                      |

**Owner sign-off before demo:** confirm the scope boundary and any numbers that must be filled with real values. `[PLACEHOLDER: owner name / approval]`
