# Application Navigation & Routes

## Main Navigation Routes

| Route                                               | Description                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/dashboard`                                        | Dashboard / home overview                                                          |
| `/suppliers`                                        | Supplier list                                                                      |
| `/suppliers/new`                                    | Create new supplier                                                                |
| `/suppliers/:id`                                    | Supplier detail (includes linked raw & packaging material SKUs)                    |
| `/suppliers/:id/edit`                               | Edit supplier                                                                      |
| `/products`                                         | Product (finished goods) list                                                      |
| `/products/new`                                     | Create new product (finished good SKU)                                             |
| `/products/:id`                                     | Product detail                                                                     |
| `/products/:id/edit`                                | Edit product                                                                       |
| `/skus`                                             | SKU overview — read-only, 3 tabs: Raw Material, Packaging Material, Finished Goods |
| `/skus/:id`                                         | SKU detail (read-only)                                                             |
| `/inbound-transaction`                              | Inbound transaction hub and list page                                              |
| `/inbound-transaction/receiving/new`                | Create a new receiving transaction                                                 |
| `/inbound-transaction/receiving/:id`                | Receiving transaction detail                                                       |
| `/inbound-transaction/receiving/:id/edit`           | Edit a receiving transaction                                                       |
| `/inbound-transaction/found/new`                    | Create a found transaction                                                         |
| `/inbound-transaction/found/:id`                    | Found transaction detail                                                           |
| `/inbound-transaction/found/:id/edit`               | Edit a found transaction                                                           |
| `/inbound-transaction/rma-receipt/new`              | Create an RMA receipt                                                              |
| `/inbound-transaction/rma-receipt/:id`              | RMA receipt detail                                                                 |
| `/inbound-transaction/rma-receipt/:id/edit`         | Edit an RMA receipt                                                                |
| `/inbound-transaction/wip-completion/new`           | Create a WIP completion                                                            |
| `/inbound-transaction/wip-completion/:id`           | WIP completion detail                                                              |
| `/inbound-transaction/wip-completion/:id/edit`      | Edit a WIP completion                                                              |
| `/outbound-transaction`                             | Outbound transaction hub and list page                                             |
| `/outbound-transaction/shipment/new`                | Create a new shipment                                                              |
| `/outbound-transaction/shipment/:id`                | Shipment detail                                                                    |
| `/outbound-transaction/shipment/:id/edit`           | Edit a shipment                                                                    |
| `/outbound-transaction/disposal/new`                | Create a disposal                                                                  |
| `/outbound-transaction/disposal/:id`                | Disposal detail                                                                    |
| `/outbound-transaction/disposal/:id/edit`           | Edit a disposal                                                                    |
| `/outbound-transaction/loss/new`                    | Create a loss transaction                                                          |
| `/outbound-transaction/loss/:id`                    | Loss transaction detail                                                            |
| `/outbound-transaction/loss/:id/edit`               | Edit a loss transaction                                                            |
| `/outbound-transaction/return-to-supplier/new`      | Create a return to supplier transaction                                            |
| `/outbound-transaction/return-to-supplier/:id`      | Return to supplier detail                                                          |
| `/outbound-transaction/return-to-supplier/:id/edit` | Edit a return to supplier transaction                                              |
| `/outbound-transaction/wip-issue/new`               | Create a WIP issue                                                                 |
| `/outbound-transaction/wip-issue/:id`               | WIP issue detail                                                                   |
| `/outbound-transaction/wip-issue/:id/edit`          | Edit a WIP issue                                                                   |
| `/inventory-aging`                                  | Inventory Aging Analyzer — dead stock, slow-moving, value-at-risk dashboard        |
| `/reports/monthly-stock-movement`                   | Monthly stock movement report per SKU                                              |
| `/reports/monthly-stock-movement/:skuId`            | SKU-level 12-month stock movement detail                                           |
| `/reports/inventory-balance`                        | Monthly inventory balance chart & table                                            |
| `/reports/charts`                                   | Analytics dashboard — Transaction Velocity, ABC Pareto, Approval Cycle tabs        |
| `/pallets`                                          | Pallet list (inventory atomic unit)                                                |
| `/pallets/:id`                                      | Pallet detail                                                                      |
| `/subinventory-transfer`                            | Subinventory transfer list                                                         |
| `/subinventory-transfer/new`                        | Create subinventory transfer                                                       |
| `/subinventory-transfer/:id`                        | Subinventory transfer detail                                                       |
| `/subinventory-transfer/:id/edit`                   | Edit subinventory transfer                                                         |
| `/warehouse`                                        | Warehouse list                                                                     |
| `/warehouse/new`                                    | Create warehouse                                                                   |
| `/warehouse/:id`                                    | Warehouse detail                                                                   |
| `/warehouse/:id/edit`                               | Edit warehouse                                                                     |
| `/warehouse/:id/layout`                             | Warehouse 3D layout page                                                           |
| `/stock-movement`                                   | Stock movement history                                                             |
| `/users`                                            | User management (admin)                                                            |
| `/users/new`                                        | Create new user                                                                    |
| `/users/:id`                                        | User detail                                                                        |
| `/users/:id/edit`                                   | Edit user                                                                          |
| `/access-control/roles`                             | Roles & permissions management (admin)                                             |
| `/access-control/roles/new`                         | Create role                                                                        |
| `/access-control/roles/:id/edit`                    | Edit role                                                                          |
| `/notifications`                                    | Notifications page                                                                 |
| `/activity-logs`                                    | System audit log                                                                   |

## Key UI Elements (data-ai-target values)

These are HTML attribute values used to identify interactive elements:

| data-ai-target   | Description                             |
| ---------------- | --------------------------------------- |
| `approve-button` | Approve button on document detail pages |
| `reject-button`  | Reject button on document detail pages  |
| `propose-button` | Propose/Submit for approval button      |
| `edit-button`    | Edit button on detail pages             |
| `delete-button`  | Delete button on detail pages           |
| `create-button`  | Create new record button on list pages  |
| `search-input`   | Search input on list pages              |
| `page-header`    | Page title and breadcrumb area          |
