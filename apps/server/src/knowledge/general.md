# ERP Warehouse Management System Overview

This is a Warehouse ERP (Enterprise Resource Planning) system for managing warehouse operations including receiving goods, shipping, inventory, and stock management.

## Catalog Structure

The item catalog is split into three types, all stored as SKUs:

- **Raw Material** (`type: RAW_MATERIAL`) — input materials received from suppliers (e.g. Rice Paddy 25kg, Palm Oil Drum 20L)
- **Packaging Material** (`type: PACKAGING_MATERIAL`) — packaging components received from suppliers (e.g. PET Bottle 1L, PP Woven Sack)
- **Finished Good** (`type: FINISHED_GOOD`) — manufactured products ready for sale (e.g. Refined Cooking Oil 1L, Premium White Rice 5kg)

### Where Each Type is Managed

| SKU Type             | Managed From         | Page             |
| -------------------- | -------------------- | ---------------- |
| Raw Material         | Supplier detail page | `/suppliers/:id` |
| Packaging Material   | Supplier detail page | `/suppliers/:id` |
| Finished Good        | Product page         | `/products`      |
| All (read-only view) | SKU overview page    | `/skus`          |

## Main Features

- **Receiving Transactions**: Record goods received from suppliers into the warehouse
- **Shipments**: Record goods shipped out to customers
- **WIP Completions**: Record work-in-progress completions from production
- **WIP Issues**: Record materials issued to work-in-progress production
- **RMA Receipts**: Record returned merchandise authorizations from customers
- **Return to Supplier**: Record goods returned back to suppliers
- **Subinventory Transfer**: Transfer goods between storage locations within the warehouse
- **Loss Transactions**: Record lost or damaged inventory
- **Found Transactions**: Record inventory found during cycle counts
- **Disposals**: Record disposed/scrapped inventory

## Supporting Modules

- **SKU Overview** (`/skus`): Read-only view of all SKUs across 3 tabs — Raw Material, Packaging Material, Finished Goods
- **Supplier Management** (`/suppliers`): Manage supplier info and their supplied materials (raw + packaging SKUs)
- **Product Management** (`/products`): Manage finished goods SKUs
- **Warehouse Management** (`/warehouse`): Manage warehouse facilities and storage locations
- **User Management** (`/users`): Manage system users (admin only)
- **Access Control** (`/access-control`): Manage roles and permissions (admin only)
- **Stock Movement** (`/stock-movement`): View stock movement history
- **Activity Log** (`/activity-logs`): View audit trail of system actions

## Document Lifecycle

Most transaction documents follow this approval workflow:

1. **DRAFT** — Initial state, document is being created and can be edited
2. **PROPOSED** — Document has been submitted for approval
3. **APPROVED** — Document has been approved and inventory has been updated
4. **REJECTED** — Document has been rejected and needs revision

## AI Assistant

The system includes an AI chat assistant for warehouse operations guidance.

- **Provider**: Upstage (https://upstage.ai)
- **Chat Model**: Solar Pro 4 (`solar-pro`) — a high-performance LLM optimized for enterprise tasks
- **Embedding Model**: Solar Embedding 1 Large (`solar-embedding-2-query`) — used for semantic search and RAG over the knowledge base
- **API Endpoint**: `https://api.upstage.ai/v1` (OpenAI-compatible)
- **Knowledge Base**: The AI ingests from markdown documentation files covering all warehouse modules, forms, permissions, and workflows. Embeddings are stored in pgvector (1536 dimensions) for fast similarity search.
