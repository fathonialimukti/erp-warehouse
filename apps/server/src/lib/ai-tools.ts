import { tool } from 'ai';
import { z } from 'zod';


/**
 * Client-side tools — NO `execute`. These are returned as tool calls in the stream
 * and handled by `onToolCall` in the frontend useChat hook.
 */
export const clientTools = {
    navigateTo: tool({
        description:
            'Navigate the user to a specific exact application route from the navigation docs. Use the precise list, create, detail, or edit route string and do not invent singular/plural variants.',
        inputSchema: z.object({
            path: z.string().describe('The app route path, e.g. /receiving-transactions'),
            reason: z.string().describe('Why navigating to this page'),
        }),
    }),
    fillFormFields: tool({
        description:
            'Fill one or more fields in the currently visible form with recommended values. ' +
            'Use this after navigating to a create/edit page. ' +
            'This ONLY pre-fills input values in the UI and does NOT click Save/Submit or persist data. ' +
            'Each key must match a known field name for the current form (see knowledge base for field names per route). ' +
            'Provide realistic, complete values based on the user\'s request.',
        inputSchema: z.object({
            fields: z
                .record(z.string(), z.unknown())
                .describe(
                    'Map of field names to values. E.g. { skuCode: "SKU-PB-001", skuName: "Plastic Bottle 500ml", baseUnit: "pcs", description: "Clear PET plastic bottle 500ml" }'
                ),
        }),
    }),
    getPageContext: tool({
        description:
            'Get structured context about what is currently shown on the user\'s screen. ' +
            'Call this when the user asks what they are seeing, wants a summary of the current page, ' +
            'asks questions about visible data (e.g. how many rows, which fields are filled, what record is open), ' +
            'or needs page content to answer a question. ' +
            'Returns the current route, page title, and annotated section data including record counts, visible rows, and form state.',
        inputSchema: z.object({
            reason: z.string().optional().describe('Why you need the page context'),
        }),
    }),
    queryDatabase: tool({
        description:
            'Execute a read-only SQL query against the warehouse ERP database. ' +
            'Use this when the user asks about inventory levels, transaction records, stock movements, ' +
            'pallet information, warehouse capacity, supplier data, user activity, or any warehouse data. ' +
            'Only SELECT statements are allowed (no INSERT/UPDATE/DELETE). ' +
            'Use PostgreSQL syntax with snake_case table and column names. ' +
            'Refer to the database schema documentation for table and column names. ' +
            'Always include a LIMIT clause for safety.',
        inputSchema: z.object({
            sql: z
                .string()
                .describe(
                    "SQL SELECT query using PostgreSQL syntax. Table and column names are snake_case. " +
                    "Example: SELECT s.code, s.name, COUNT(p.id) as pallet_count " +
                    "FROM skus s LEFT JOIN pallets p ON s.id = p.sku_id AND p.status = 'AVAILABLE' " +
                    "GROUP BY s.id, s.code, s.name LIMIT 10",
                ),
            limit: z
                .number()
                .int()
                .min(1)
                .max(500)
                .default(100)
                .optional()
                .describe(
                    'Maximum rows to return (1-500, default 100). Also add LIMIT to your SQL.',
                ),
        }),
    }),
    selectPutawayTransaction: tool({
        description:
            'Select an inbound (receiving) transaction in the 3D warehouse layout PutawayPanel. ' +
            'Use this FIRST when the user asks to putaway a specific transaction — it opens the putaway ' +
            'panel and loads the transaction\'s unassigned pallets. ' +
            'This only selects the transaction in the UI — it does NOT assign any pallets.',
        inputSchema: z.object({
            inboundTransactionId: z
                .string()
                .describe('The ULID of the inbound transaction to select for putaway.'),
        }),
    }),
    selectPutawayPallet: tool({
        description:
            'Select a specific unassigned pallet in the 3D warehouse layout PutawayPanel. ' +
            'Use this to mark which pallet is currently being placed (it highlights in the panel). ' +
            'The pallet must belong to the given inbound transaction and be currently unassigned. ' +
            'This only selects the pallet in the UI — it does NOT assign it to a location.',
        inputSchema: z.object({
            inboundTransactionId: z
                .string()
                .describe('The ULID of the inbound transaction the pallet belongs to.'),
            palletId: z
                .string()
                .describe('The ULID of the unassigned pallet to select.'),
        }),
    }),
    highlightPutawayLocation: tool({
        description:
            'Highlight a storage location in the 3D warehouse layout view. ' +
            'Use this to show the user which location you recommend for a pallet — ' +
            'the location marker turns green and pulses. Pass a human-readable reason ' +
            'so the user understands why this location was chosen.',
        inputSchema: z.object({
            storageLocationId: z
                .string()
                .describe('The storage location ID to highlight (e.g. WH01/FLOOR/0001).'),
            reason: z
                .string()
                .describe('Why this location was recommended (shown to the user as a hint).'),
        }),
    }),
    stagePutawayAssignment: tool({
        description:
            'Stage one or more pallet→storage-location assignments locally in the PutawayPanel. ' +
            'Staged assignments show as green cards in the panel and green markers in the 3D view, ' +
            'but are NOT yet persisted to the server. The user can review them and click Save ' +
            '(or you can call savePutawayAssignments). ' +
            'Use this after recommending locations to stage the proposed assignments.',
        inputSchema: z.object({
            assignments: z
                .array(z.object({
                    palletId: z.string().describe('The ULID of the pallet to assign.'),
                    storageLocationId: z.string().describe('The storage location ID to assign the pallet to.'),
                }))
                .min(1)
                .describe('One or more pallet→location pairs to stage.'),
        }),
    }),
    unstagePutawayAssignment: tool({
        description:
            'Remove a single pallet\'s staged assignment from the PutawayPanel (undo). ' +
            'Use this if the user rejects a proposed assignment or you want to revise it.',
        inputSchema: z.object({
            palletId: z
                .string()
                .describe('The ULID of the pallet whose staged assignment should be removed.'),
        }),
    }),
    savePutawayAssignments: tool({
        description:
            'Commit ALL staged putaway assignments to the server in one batch. ' +
            'Use this after staging assignments (via stagePutawayAssignment) and the user confirms. ' +
            'This persists the assignments: pallets are moved to their storage locations, ' +
            'putaway lines are marked COMPLETED, and stock movements are written. ' +
            'Only call this after the user has reviewed and approved the staged assignments.',
        inputSchema: z.object({
            reason: z
                .string()
                .optional()
                .describe('Why the assignments are being saved (for the user\'s confirmation).'),
        }),
    }),

    // ── Dispatch (outbound pick) control tools ──────────────────────────────
    // Mirror the putaway control tools, driving the DispatchPanel + 3D view.
    selectDispatchTransaction: tool({
        description:
            'Select an outbound (shipment/wip-issue/return-to-supplier/disposal) transaction in the 3D ' +
            'warehouse layout DispatchPanel. Use this FIRST when the user asks to pick a specific transaction — ' +
            'it opens the dispatch panel and loads the transaction\'s unpicked pallets. ' +
            'This only selects the transaction in the UI — it does NOT pick any pallets.',
        inputSchema: z.object({
            outboundTransactionId: z
                .string()
                .describe('The ULID of the outbound transaction to select for dispatch/picking.'),
        }),
    }),
    selectDispatchItem: tool({
        description:
            'Select a specific outbound item in the 3D warehouse layout DispatchPanel. ' +
            'Use this to mark which item is currently being picked (it activates the item and dims ' +
            'non-matching pallet groups in the 3D view). ' +
            'This only selects the item in the UI — it does NOT pick a pallet.',
        inputSchema: z.object({
            outboundTransactionId: z
                .string()
                .describe('The ULID of the outbound transaction the item belongs to.'),
            outboundTransactionItemId: z
                .string()
                .describe('The ULID of the outbound transaction item to activate.'),
        }),
    }),
    highlightPickPallet: tool({
        description:
            'Highlight a pallet in the 3D warehouse layout view as your pick recommendation. ' +
            'Use this to show the user which pallet you recommend picking — the pallet marker turns ' +
            'green and pulses. Pass a human-readable reason so the user understands why this pallet was chosen.',
        inputSchema: z.object({
            palletId: z
                .string()
                .describe('The ULID of the pallet to highlight as the recommended pick.'),
            reason: z
                .string()
                .describe('Why this pallet was recommended (shown to the user as a hint).'),
        }),
    }),
    stagePickAssignment: tool({
        description:
            'Stage one or more pallet picks locally in the DispatchPanel. ' +
            'Staged picks show as green cards in the panel and green markers in the 3D view, ' +
            'but are NOT yet persisted to the server. The user can review them and click Confirm ' +
            '(or you can call savePickAssignments). ' +
            'Use this after recommending pallets to stage the proposed picks.',
        inputSchema: z.object({
            assignments: z
                .array(z.object({
                    outboundTransactionItemId: z.string().describe('The ULID of the outbound item being picked.'),
                    palletId: z.string().describe('The ULID of the pallet to pick for that item.'),
                }))
                .min(1)
                .describe('One or more item→pallet pairs to stage.'),
        }),
    }),
    unstagePickAssignment: tool({
        description:
            'Remove a single pallet\'s staged pick from the DispatchPanel (undo). ' +
            'Use this if the user rejects a proposed pick or you want to revise it.',
        inputSchema: z.object({
            palletId: z
                .string()
                .describe('The ULID of the pallet whose staged pick should be removed.'),
        }),
    }),
    savePickAssignments: tool({
        description:
            'Commit ALL staged picks to the server in one batch via dispatch.submitAssignment. ' +
            'Use this after staging picks (via stagePickAssignment) and the user confirms. ' +
            'This persists the picks: pallets leave their storage locations, pick lines are marked ' +
            'COMPLETED, and stock movements are written when the document is fully picked. ' +
            'Only call this after the user has reviewed and approved the staged picks.',
        inputSchema: z.object({
            reason: z
                .string()
                .optional()
                .describe('Why the picks are being saved (for the user\'s confirmation).'),
        }),
    }),

    // ── Approval / rejection control tools ──────────────────────────────────
    approveTransaction: tool({
        description:
            'Open the approve confirmation for a transaction detail page and prefill the rationale. ' +
            'Use this when the user asks to approve a specific transaction by id or reference. ' +
            'This ONLY opens the approve modal with a suggested rationale — it does NOT click confirm. ' +
            'The user must review and click Approve themselves.',
        inputSchema: z.object({
            transactionType: z
                .string()
                .describe('The transaction type, e.g. RECEIVING, SHIPMENT, WIP_ISSUE.'),
            transactionId: z
                .string()
                .describe('The ULID of the transaction to approve.'),
            rationale: z
                .string()
                .optional()
                .describe('Optional AI-generated reason for approval, shown to the user in the modal.'),
        }),
    }),
    rejectTransaction: tool({
        description:
            'Open the reject confirmation for a transaction detail page and prefill the rationale. ' +
            'Use this when the user asks to reject a specific transaction by id or reference. ' +
            'This ONLY opens the reject modal with a suggested rationale — it does NOT click confirm. ' +
            'The user must review and click Reject themselves.',
        inputSchema: z.object({
            transactionType: z
                .string()
                .describe('The transaction type, e.g. RECEIVING, SHIPMENT, WIP_ISSUE.'),
            transactionId: z
                .string()
                .describe('The ULID of the transaction to reject.'),
            rationale: z
                .string()
                .optional()
                .describe('Optional AI-generated reason for rejection, shown to the user in the modal.'),
        }),
    }),
};
