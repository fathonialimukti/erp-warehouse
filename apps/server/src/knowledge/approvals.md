# How to Approve Documents

## Document Approval Workflow

Every transaction document in the system (Receiving, Shipment, WIP, etc.) follows a two-step process:

1. First a user creates and **proposes** the document (changes status from DRAFT to PROPOSED)
2. Then an approver **approves** or **rejects** the document

## Steps to Approve a Receiving Transaction

1. Navigate to Receiving Transactions: go to `/inbound-transaction`
2. Find a document with status PROPOSED in the list
3. Click on the document to open its detail page (`/inbound-transaction/receiving/:id`)
4. On the detail page, look for the action buttons at the top right
5. Click the **Approve** button (`data-ai-target="approve-button"`) to approve
6. Or click the **Reject** button (`data-ai-target="reject-button"`) to reject with a reason

Required permission: `receiving@approve`

## Steps to Propose a Document (Submit for Approval)

1. Open or create a document (e.g., a Receiving Transaction)
2. Fill in all required fields
3. Click **Propose** (`data-ai-target="propose-button"`) to submit for approval
4. The document status changes to PROPOSED

Required permission: the resource's `@update` permission (e.g., `receiving@update`)

## Approval Buttons by Transaction Type

Each transaction type has the same approve/reject buttons but different required permissions:

| Transaction           | Approve Permission              | Detail Route                                   |
| --------------------- | ------------------------------- | ---------------------------------------------- |
| Receiving Transaction | `receiving@approve`             | `/inbound-transaction/receiving/:id`           |
| Shipment              | `shipment@approve`              | `/outbound-transaction/shipment/:id`           |
| WIP Completion        | `wip-completion@approve`        | `/inbound-transaction/wip-completion/:id`      |
| WIP Issue             | `wip-issue@approve`             | `/outbound-transaction/wip-issue/:id`          |
| RMA Receipt           | `rma-receipt@approve`           | `/inbound-transaction/rma-receipt/:id`         |
| Return to Supplier    | `return-to-supplier@approve`    | `/outbound-transaction/return-to-supplier/:id` |
| Subinventory Transfer | `subinventory-transfer@approve` | `/subinventory-transfer/:id`                   |
| Loss Transaction      | `loss@approve`                  | `/outbound-transaction/loss/:id`               |
| Found Transaction     | `found@approve`                 | `/inbound-transaction/found/:id`               |
| Disposal              | `disposal@approve`              | `/outbound-transaction/disposal/:id`           |

## What Happens After Approval

- The document status changes to **APPROVED**
- Inventory quantities are automatically updated
- An activity log entry is created
- The approve/reject buttons disappear (document is locked)

## If the Approve Button Is Not Visible

Possible reasons:

1. You do not have the `approve` permission for that resource — contact your system administrator
2. The document is not in PROPOSED status — it must be proposed first before it can be approved
3. The document is already APPROVED or REJECTED — it cannot be changed again
