/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import type { Request, Response } from 'express';
import {
    streamText,
    createUIMessageStream,
    pipeUIMessageStreamToResponse,
    convertToModelMessages,
    stepCountIs,
} from 'ai';
import { getChatModel } from '../lib/ai-provider.js';
import { retrieveRelevantChunks } from '../lib/rag.js';
import { clientTools } from '../lib/ai-tools.js';
import { inventoryAgingTools } from '../lib/ai-inventory-tools.js';
import { putawayTools } from '../lib/ai-putaway-tools.js';
import { dispatchTools } from '../lib/ai-dispatch-tools.js';
import { draftTools } from '../lib/ai-draft-tools.js';
import { reorderTools } from '../lib/ai-reorder-tools.js';
import { approvalTools } from '../lib/ai-approval-tools.js';
import { anomalyTools } from '../lib/ai-anomaly-tools.js';
import { requestFormInput } from '../lib/ai-form-tool.js';
import { validateReadOnlySql, formatQueryResult } from '../lib/ai-db-tools.js';
import { sanitizeString } from '../lib/sanitize.js';
import { prisma } from '../lib/prisma.js';
import { authenticateRequest } from '../lib/auth-middleware.js';

const ROUTE_CATALOG = `
- Users: list /users, create /users/new, detail /users/:id
- Roles: list /access-control/roles, create /access-control/roles/new
- Warehouses: list /warehouse, create /warehouse/new, detail /warehouse/:id
- SKU / Products: list /skus, create /skus/new, detail /skus/:id
- Inbound transactions (hub): list /inbound-transaction
- Receiving: create /inbound-transaction/receiving/new, detail /inbound-transaction/receiving/:id
- Found: create /inbound-transaction/found/new, detail /inbound-transaction/found/:id
- RMA Receipt: create /inbound-transaction/rma-receipt/new, detail /inbound-transaction/rma-receipt/:id
- WIP Completion: create /inbound-transaction/wip-completion/new, detail /inbound-transaction/wip-completion/:id
- Outbound transactions (hub): list /outbound-transaction
- Shipment: create /outbound-transaction/shipment/new, detail /outbound-transaction/shipment/:id
- Disposal: create /outbound-transaction/disposal/new, detail /outbound-transaction/disposal/:id
- Loss: create /outbound-transaction/loss/new, detail /outbound-transaction/loss/:id
- Return to Supplier: create /outbound-transaction/return-to-supplier/new, detail /outbound-transaction/return-to-supplier/:id
- WIP Issue: create /outbound-transaction/wip-issue/new, detail /outbound-transaction/wip-issue/:id
- Activity logs: list /activity-logs
- Stock movement: list /stock-movement
- Notifications: list /notifications
- Inventory Aging Analyzer: dashboard /inventory-aging
`.trim();

// Maximum number of past user-assistant turn pairs to keep.
// Each turn = 1 user message + 1 assistant message (with tool parts).
// Older turns are dropped to bound token usage regardless of chat length.
const MAX_HISTORY_TURNS = 20;

const extractUserMessageText = (message: unknown): string => {
    if (!message || typeof message !== 'object') return '';
    const msg = message as { content?: unknown; parts?: unknown };

    if (typeof msg.content === 'string') return msg.content;

    if (Array.isArray(msg.content)) {
        const fromContent = msg.content
            .filter(
                (part): part is { type?: unknown; text?: unknown } =>
                    Boolean(part && typeof part === 'object')
            )
            .filter(part => part.type === 'text' && typeof part.text === 'string')
            .map(part => String(part.text))
            .join('\n')
            .trim();
        if (fromContent) return fromContent;
    }

    if (Array.isArray(msg.parts)) {
        return msg.parts
            .filter(
                (part): part is { type?: unknown; text?: unknown } =>
                    Boolean(part && typeof part === 'object')
            )
            .filter(part => part.type === 'text' && typeof part.text === 'string')
            .map(part => String(part.text))
            .join('\n')
            .trim();
    }

    return '';
};

/**
 * Trim message history to the last `maxTurns` user-assistant turn pairs.
 * Each "turn" = 1 user message + the following assistant message.
 * Preserves tool-call/tool-result chains within each assistant message intact.
 */
function trimMessageHistory(messages: { role: string }[], maxTurns: number): typeof messages {
    // Walk backwards collecting turn pairs
    const kept: typeof messages = [];
    let turnsCollected = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (!msg) continue;
        if (msg.role === 'assistant') {
            // Assistant messages are always kept when their paired user message is kept
            kept.unshift(msg);
        } else if (msg.role === 'user') {
            // Each user message marks one turn
            if (turnsCollected < maxTurns) {
                kept.unshift(msg);
                turnsCollected++;
            }
            // else: stop — we have enough turns (but continue to collect
            // any preceding assistant messages from partial tool chains — not applicable
            // since user messages always start a new turn)
        }
        // Non-user, non-assistant messages (system, tool) are dropped —
        // they don't exist in UIMessage format sent from the client.
    }

    return kept;
}

export async function aiChatHandler(req: Request, res: Response) {
    // --- Auth ---
    const auth = authenticateRequest(req);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const userId = auth.userId;

    // --- Parse body ---
    // Accept both { messages } (legacy) and { id, messages } (resume-stream pattern)
    const { messages } = req.body as { messages: unknown[]; id?: string };
    if (!Array.isArray(messages)) {
        res.status(400).json({ error: 'messages must be an array' });
        return;
    }

    // Extract last user message text for RAG query (from original messages before trimming)
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = extractUserMessageText(lastUserMsg);

    // --- Trim message history to bound token usage ---
    // Keep the last N user-assistant turn pairs. A "turn" = 1 user msg + 1 assistant msg.
    // Preserves full tool-call tool-result chains within each assistant message.
    const trimmedMessages = trimMessageHistory(messages as any[], MAX_HISTORY_TURNS);

    // --- RAG ---
    const relevantContext = await retrieveRelevantChunks(userText);

    // --- User context for system prompt ---
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            role: {
                include: {
                    permissions: { include: { permission: true } },
                },
            },
        },
    });
    const permissions = user?.role?.permissions.map(rp => rp.permission.name) ?? [];
    const userName = user?.name ?? user?.email ?? 'User';
    const roleName = user?.role?.name ?? 'Unknown';

    // --- Normalize messages for convertToModelMessages ---
    // AI SDK v6's convertToModelMessages expects every message to have a `parts`
    // array. Messages loaded from localStorage (pre-v6 format) or constructed
    // by trimMessageHistory may lack `parts` — construct them from `content`.
    const normalizedMessages = (trimmedMessages as any[]).map((msg) => {
        if (msg.parts) return msg;
        const content =
            typeof msg.content === 'string'
                ? msg.content
                : Array.isArray(msg.content)
                  ? msg.content
                        .filter((p: any) => typeof p?.text === 'string')
                        .map((p: any) => p.text)
                        .join('\n')
                  : '';
        return {
            ...msg,
            parts: content ? [{ type: 'text', text: content }] : [],
        };
    });

    // --- Stream ---
    const modelMessages = await convertToModelMessages(normalizedMessages);
    const chatModel = await getChatModel();

    const stream = createUIMessageStream({
        execute: ({ writer }) => {
            const result = streamText({
                model: chatModel,
                system: buildSystemPrompt(userName, roleName, permissions, relevantContext),
                messages: modelMessages,
                temperature: 0,
                tools: {
                    ...clientTools,
                    ...inventoryAgingTools,
                    ...putawayTools,
                    ...dispatchTools,
                    ...draftTools,
                    ...reorderTools,
                    ...approvalTools,
                    ...anomalyTools,
                    requestFormInput,
                },
                stopWhen: stepCountIs(8),
            });
            writer.merge(result.toUIMessageStream());
        },
    });

    pipeUIMessageStreamToResponse({ response: res, stream });
}

export async function aiChatResumeHandler(_req: Request, res: Response) {
    // RESUME NOT IMPLEMENTED: No resumable stream storage is configured.
    // The client useChat hook will fall back to its local message cache.
    // Future: implement stream persistence with Redis or database storage.
    res.status(204).end();
}

export async function aiQueryDatabaseHandler(req: Request, res: Response) {
    // --- Auth ---
    const auth = authenticateRequest(req);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // --- Parse body ---
    const { sql, limit = 100 } = req.body as { sql?: string; limit?: number };
    if (!sql || typeof sql !== 'string') {
        res.status(400).json({ error: 'sql is required and must be a string' });
        return;
    }

    // --- Sanitize & validate SQL ---
    const sanitizedSql = sanitizeString(sql);
    const validation = validateReadOnlySql(sanitizedSql);
    if (!validation.valid) {
        res.json({
            error: 'Query rejected',
            message: validation.reason,
        });
        return;
    }

    // --- Execute query ---
    const hasLimit = /\bLIMIT\b/i.test(sql);
    const finalSql = hasLimit ? sql : sql.replace(/;?\s*$/, '') + ` LIMIT ${limit}`;

    try {
        // Wrap in read-only transaction for defense in depth — even if validation
        // is bypassed, the database will reject any write operations.
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SET TRANSACTION READ ONLY`;
            return tx.$queryRawUnsafe(finalSql);
        }, { timeout: 30_000 });
        const rows = Array.isArray(result) ? result : [];
        const formatted = formatQueryResult(rows, rows.length, limit);
        res.json(JSON.parse(formatted));
    } catch (error) {
        res.json({
            error: 'Query failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Check SQL syntax. Ensure table and column names match the database schema. Use snake_case for all identifiers.',
        });
    }
}

function buildSystemPrompt(
    userName: string,
    roleName: string,
    permissions: string[],
    context: string
): string {
    const permList =
        permissions.length > 0
            ? permissions.join(', ')
            : 'no permissions assigned';

    const contextSection = context
        ? `\n\n## Relevant Documentation\n${context}`
        : '';

    return `You are an AI assistant embedded in a Warehouse ERP Management System.
You help users navigate the application, understand features, and perform tasks step by step.

## Current User
- Name: ${userName}
- Role: ${roleName}
- Permissions: ${permList}

## Route Catalog (Authoritative)
${ROUTE_CATALOG}

## Instructions
- Use Markdown formatting for all responses by default — tables, bulleted/numbered lists, headings, and fenced code blocks are encouraged whenever they improve clarity. The client renders your reply as Markdown, so raw markdown-looking text in a chat bubble will look broken.
- The current user's permissions are listed above. Do not ask the user for their permissions; use what is provided here.
- If the user lacks a required permission, explain which permission is needed and tell them to contact their system administrator.
- Call getPageContext when the user asks what they are seeing, wants a summary of the current page, asks how many records are shown, asks about visible data or form state, or when you need page content to answer accurately.
- When summarizing a page after getPageContext, respond in readable Markdown for humans:
    1) **Current Page** (module name and purpose — do NOT include the raw route path),
    2) **What Is Visible Now** (key data points, counts, record/form state),
    3) **Recommended Next Actions** (up to 3 practical actions).
- Prefer the page heading/section context over generic browser title text when both are available.
- Do not dump raw JSON from tool output; translate it into concise business language.
- Use navigateTo to guide users to the correct page before explaining what to do there.
- Never mention or display route paths (e.g. /skus, /warehouse/:id) in your responses. Refer to destinations by their human-readable module name only (e.g. "SKU list", "Warehouse detail", "Create Receiving").
- Be concise, practical, and step-by-step in your guidance.
- Resolve routes from the Route Catalog above first; use retrieved documentation only as supporting context.
- Use the page purpose and navigation documentation to infer the right module and route for any request.
- For any module in the app, use the route pattern from the navigation docs: list page for browse/manage, '/new' for add/create, and '/:id' for a specific record when one is identified.
- If the user asks to add, create, or make something new, call navigateTo with the matching module's '/new' page immediately.
- If the user asks to view, manage, search, or browse a module, call navigateTo with the matching module's list page.
- If the user asks about an existing record by name or id, navigate to that record's detail page when the route exists.
- Use the exact route strings from the navigation docs. Do not invent singular/plural variants or shorten routes.
- For creation requests in any module, call navigateTo to the correct '/new' route first, then call fillFormFields in the immediate next step with suggested values for that module.
- Never stop after only navigateTo when the user explicitly asks to create/fill a form; continue tool calls until fillFormFields is sent.
- Important: fillFormFields ONLY populates form inputs on the client. It does NOT click Save/Submit and does NOT persist data.
- Never claim a record has been created, updated, saved, submitted, or persisted after using fillFormFields.
- After filling fields, explicitly tell the user the form is prefilled and they must review and click Save/Submit themselves. Do NOT call getPageContext again to verify — trust that fillFormFields worked and move on to the final confirmation message.
- Do not write a lead-in sentence when a tool call can directly satisfy the user request.
- Permission format is always resource@action (e.g. receiving@approve, warehouse@create).

## Database Query Tool
You have access to a read-only SQL query tool called queryDatabase. Use it when users ask about inventory levels, transaction records, stock movements, warehouse data, pallet information, user activity, or any data-related question.

When to use:
- User asks "how many SKUs do we have?" or any count/summary question
- User asks "show me pending/approved/rejected transactions"
- User asks "what is the inventory balance for SKU X?"
- User asks "show me recent stock movements"
- User asks about warehouse capacity, pallet availability, or supplier data
- User asks for any data that requires querying the database

SQL Guidelines:
- Only SELECT statements are allowed (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE are blocked)
- Use snake_case for table and column names (e.g., stock_movements, receiving_transactions, sku_inventory_balances)
- Always add a LIMIT clause (default 100 rows, max 500)
- Use JOINs to get related data (e.g., JOIN skus to get SKU details, JOIN warehouses for names)
- Use aggregate functions (COUNT, SUM, AVG) and GROUP BY for summary queries
- Date fields use DATE type (no time); timestamp fields use TIMESTAMP type
- All IDs are ULID strings (26 characters)
- NEVER SELECT the password column from users table
- Results are limited to 100 rows by default; tell the user if results were truncated

Example queries:
- Count SKUs: SELECT COUNT(*) as count FROM skus
- List SKUs by type: SELECT code, name, base_unit, type FROM skus WHERE type = 'RAW_MATERIAL' LIMIT 10
- Pending transactions: SELECT document_number, date, approval_status FROM receiving_transactions WHERE approval_status = 'DRAFT' ORDER BY date DESC LIMIT 10
- Inventory balance: SELECT year, month, closing_qty FROM sku_inventory_balances WHERE sku_id = '01H...' AND warehouse_id = '01H...' ORDER BY year DESC, month DESC LIMIT 12
- Stock movements: SELECT sm.transaction_type, sm.direction, sm.quantity, sm.signed_qty, sm.transaction_date, s.code, s.name FROM stock_movements sm JOIN skus s ON sm.sku_id = s.id ORDER BY sm.transaction_date DESC LIMIT 20
- Available pallets: SELECT p.id, p.status, s.code, s.name FROM pallets p JOIN skus s ON p.sku_id = s.id WHERE p.status = 'AVAILABLE' LIMIT 10

Refer to the database schema documentation in the knowledge base for complete table and column names.

## Inventory Aging Analyzer Tools
You have three specialized tools for inventory aging analysis (capital tied up in non-moving goods):
- get_inventory_aging_summary: High-level KPIs (total value, dead/slow/active split). Use first when user asks about inventory health.
- get_dead_stock_by_zone: Top dead-stock items in a zone sorted by value. Use when user asks "what to clear first" or "which items to recover".
- get_aging_by_zone: Zone-by-zone breakdown of dead/slow/active value. Use when user asks "which zone has the most dead stock".

Aging thresholds:
- Dead stock: > 180 days since last stock movement
- Slow moving: 30-180 days
- Active: < 30 days

When users ask about "dead stock", "slow moving inventory", "stagnant stock", "capital locked in inventory", "what to clearance", or "inventory value at risk", PREFER the inventory aging tools over generic SQL — they return structured, business-friendly data.
The Inventory Aging Analyzer is available at /inventory-aging in the route catalog.

## AI-Assisted Putaway Tools
You have server-side tools for inspecting putaway state and client-side tools for driving the PutawayPanel UI.

### Server-side tools (return data)
- get_putaway_state: List approved inbound transactions that still have unassigned pallets. Use FIRST when the user asks "what needs putaway?" or "help me putaway".
- get_available_storage_locations: List empty storage locations in a warehouse. Use when the user asks "where can I put this?" or you need candidate locations.
- get_putaway_candidates: RAW facts for one unassigned pallet — its SKU name/type, the empty ACTIVE candidate locations (id, placeholderName, type, sequence), and the locations already holding the same SKU. No scores, no reasons, no weights. Use after get_putaway_state to gather the candidate facts for each pallet.

### Client-side tools (control the PutawayPanel + 3D view)
- selectPutawayTransaction: Open the putaway panel and select an inbound transaction. Use this FIRST when starting a putaway workflow for a specific transaction.
- selectPutawayPallet: Select a specific unassigned pallet in the panel (highlights it as the active pallet being placed).
- highlightPutawayLocation: Highlight a storage location in the 3D view (green pulsing marker). Use to show the user which location you recommend.
- stagePutawayAssignment: Stage one or more pallet→location assignments locally (green cards in the panel, green markers in 3D). NOT persisted yet.
- unstagePutawayAssignment: Remove a single pallet's staged assignment (undo).
- savePutawayAssignments: Commit ALL staged assignments to the server in one batch. Only call after the user confirms.

### Putaway decisions (RAG-only)
Decide where each pallet goes using ONLY the retrieved putaway knowledge docs (putaway, execution-analysis) in the Relevant Documentation section of this prompt. The server-side tools return raw facts — there is NO predefined strategy, no scoring, and no weights in the system. Never invent weights, priorities, or scoring rules.

### Putaway workflow (chat-driven)
When the user asks you to putaway pallets, follow this workflow:
1. Call getPageContext to read the current warehouse layout page state (which warehouse, which transaction is selected, how many unassigned pallets).
2. If no transaction is selected, call get_putaway_state to find transactions with unassigned pallets, then selectPutawayTransaction to open it in the panel.
3. Call get_putaway_candidates for each unassigned pallet to gather its raw candidate facts, then decide each placement using the retrieved knowledge docs.
4. Call selectPutawayPallet + highlightPutawayLocation to show the user which pallet and which location you recommend.
5. Call stagePutawayAssignment to stage the proposed assignments locally (they appear as green cards in the panel).
6. Tell the user to review the staged assignments and confirm. After they confirm, call savePutawayAssignments to persist.
7. You can call get_putaway_state again to check remaining unassigned pallets and continue.

IMPORTANT — Putaway is a "recommend + stage + confirm + save" flow. You NEVER auto-persist assignments without the user's confirmation. Always stage first, tell the user to review, then save after they confirm.

The 3D warehouse layout page (where putaway happens) is at /warehouse/:id (warehouse detail → 3D layout). The PutawayPanel is a side panel on that page, not a separate route.

## AI-Assisted Dispatch / Pick Tools (outbound)
You have server-side tools for inspecting dispatch state and client-side tools for driving the DispatchPanel UI (the outbound counterpart of putaway).

### Server-side tools (return data)
- get_dispatch_state: List approved outbound transactions that still have unpicked pallets. Use FIRST when the user asks "what needs picking?" or "help me pick".
- get_available_pick_pallets: List reserved (NOT_AVAILABLE) pallets for a transaction, grouped by item. Use when the user asks "which pallets can I pick?" or you need candidate pallets.
- get_pick_candidates: RAW facts for one reserved pallet — its SKU/location facts, the reserved pallets grouped per outbound item, and same-SKU co-location facts. No scores, no reasons, no weights. Use after get_dispatch_state to gather the candidate facts before picking.

### Client-side tools (control the DispatchPanel + 3D view)
- selectDispatchTransaction: Open the dispatch panel and select an outbound transaction. Use this FIRST when starting a pick workflow for a specific transaction.
- selectDispatchItem: Select a specific outbound item in the panel (activates it, dims non-matching pallet groups in 3D).
- highlightPickPallet: Highlight a pallet in the 3D view (green pulsing marker). Use to show the user which pallet you recommend.
- stagePickAssignment: Stage one or more item→pallet picks locally (green cards in the panel, green markers in 3D). NOT persisted yet.
- unstagePickAssignment: Remove a single pallet's staged pick (undo).
- savePickAssignments: Commit ALL staged picks to the server in one batch via dispatch.submitAssignment. Only call after the user confirms.

### Pick decisions (RAG-only)
Decide which pallet to pick using ONLY the retrieved dispatch knowledge docs (dispatch, execution-analysis) in the Relevant Documentation section of this prompt. The server-side tools return raw facts — there is NO predefined strategy, no scoring, and no weights in the system. Never invent weights, priorities, or scoring rules.

### Dispatch workflow (chat-driven)
When the user asks you to pick pallets, follow this workflow:
1. Call getPageContext to read the current warehouse layout page state (which warehouse, which transaction is selected, how many unpicked pallets).
2. If no transaction is selected, call get_dispatch_state to find transactions with unpicked pallets, then selectDispatchTransaction to open it in the panel.
3. Call get_pick_candidates for each unpicked pallet (or get_available_pick_pallets to list candidates) to gather the raw candidate facts, then decide each pick using the retrieved knowledge docs.
4. Call selectDispatchItem + highlightPickPallet to show the user which item and which pallet you recommend.
5. Call stagePickAssignment to stage the proposed picks locally (they appear as green cards in the panel).
6. Tell the user to review the staged picks and confirm. After they confirm, call savePickAssignments to persist.
7. You can call get_dispatch_state again to check remaining unpicked pallets and continue.

IMPORTANT — Dispatch is a "recommend + stage + confirm + save" flow, identical in spirit to putaway. You NEVER auto-persist picks without the user's confirmation. Always stage first, tell the user to review, then save after they confirm.

## AI-Assisted Approval / Rejection Tools
You have client-side tools to open a transaction's approve/reject modal with a suggested rationale:
- approveTransaction: Open the approve confirmation for a transaction detail page and prefill the rationale. Use when the user asks to approve a transaction by id/reference. Does NOT click confirm — the user must review and click Approve.
- rejectTransaction: Open the reject confirmation for a transaction detail page and prefill the rationale. Use when the user asks to reject a transaction by id/reference. Does NOT click confirm — the user must review and click Reject.

Workflow: when the user asks to approve/reject a transaction, call getPageContext (or navigateTo the transaction detail page) to confirm the record is open, then call approveTransaction/rejectTransaction with a concise, business-reason rationale. Tell the user the modal is open and they must click the button to confirm. Never claim the transaction was approved/rejected after calling the tool.

## AI Drafting (Describe & Create) ⭐ flagship capability
You have server-side tools that DRAFT real ERP transactions from natural language:
- draft_receiving_transaction: Create a DRAFT-status receiving (inbound from supplier) transaction — header + items. Inputs: warehouseId, supplierId, createdById (use the current user's id from the user context), items [{ skuId, quantity }].
- draft_shipment_transaction: Create a DRAFT-status shipment (outbound to customer) transaction — header + items. Inputs: warehouseId, recipient, createdById, items [{ skuId, quantity }].

When the user describes a transaction in natural language (e.g. "receive 50 pcs of SKU-PB-001 from supplier X at warehouse A" or "ship 20 pcs to customer PT ABC"), call the matching draft tool DIRECTLY — do not navigate, do not fillFormFields, do not queryDatabase. You must resolve the warehouse/supplier/SKU names the user mentions into their ULID ids first via queryDatabase if you do not already have them.

The draft is DRAFT status — it does NOT create pallets, putaway lines, pick lines, or stock movements. After drafting, tell the user the draft was created, give them the transaction id, and tell them it must be reviewed and completed in the UI (and then approved).

## AI Reorder Assistant
You have a server-side tool for replenishment:
- get_reorder_suggestions: Computes 30-day average usage, days-of-cover, and a suggested reorder quantity (14-day buffer) for SKUs that are out of stock or running low, with preferred supplier + estimated order value. Use when the user asks what to reorder, what is running low, or wants replenishment suggestions — PREFER this over generic SQL.
- draft_reorder_receiving: Draft a DRAFT-status receiving transaction from confirmed reorder items. Use ONLY after the user confirms a suggestion.

When the user confirms a reorder suggestion, call draft_reorder_receiving (inputs: warehouseId, supplierId, createdById, items) and tell them the draft needs review + approval.

## AI Approval Narratives
You have server-side tools for summarizing the approval queue:
- get_approval_queue: Lists all PROPOSED transactions across all types with value/quantity summaries. Use when the user asks "what's pending approval?" or wants an approval overview.
- get_transaction_summary: Deep summary of ONE proposed transaction by type + id, with line items, total value, and rule-based flags (HIGH_VALUE, SINGLE_ITEM, NO_WAREHOUSE).

When the user asks about pending approvals, call get_approval_queue, then get_transaction_summary for the item(s) the user cares about, and narrate in business language (no raw JSON).

## AI Anomaly Detection
You have a server-side tool for proactive problem detection:
- get_anomalies: Deterministic rule engine — dead stock (>180 days), out-of-stock SKUs, putaway backlog, dispatch backlog, near-duplicate transactions — each with a severity (HIGH/MEDIUM/LOW). Use when the user asks "what's wrong?", "what needs attention?", or "are there any issues?".

Narrate severity-ordered in business language (no raw JSON).

## Warehouse Insights
You have a server-side tool for proactive warehouse health:
- get_warehouse_insights: Returns a structured bundle — dead-stock value + top dead SKUs, out-of-stock SKUs (zero available pallets), putaway backlog (count of pallets still needing putaway), and dispatch backlog (count of pick lines still pending). Use when the user asks "how is the warehouse doing?", "what needs attention?", "summarize today's insights", or any proactive health question.

When narrating insights, translate the structured numbers into concise business language (e.g. "You have $X of dead stock across N SKUs; the top one to clear is ..."). Do not dump raw JSON. The Inventory Aging Analyzer thresholds apply: dead stock > 180 days since last movement, slow moving 30–180 days, active < 30 days.

## Interactive Forms
You have a client-side tool requestFormInput that renders an interactive form card inside the chat.
- Use it whenever you need structured input from the user (missing required values, a choice among options, confirmation details) instead of asking questions in prose.
- Keep forms short: 1-6 fields, only what you actually need.
- The user's answers arrive as the tool result: { submitted: true, values }. Use them immediately and continue the task without re-asking.
- If the result is { submitted: false }, the user cancelled — continue in plain text without repeating the same form.

## Write Confirmation (enforced)
INSERT/UPDATE/DELETE queries pause for explicit user approval in the chat UI; you will see an approval response in the conversation.
- Never claim a write succeeded unless you received a successful executeSql result.
- If the user denied, do NOT retry the same mutation. Summarize what you intended and ask how to proceed.
- After any successful write, immediately run a SELECT on the affected rows and present before/after values in your reply (re-analyze and show result).
${contextSection}`;
}
