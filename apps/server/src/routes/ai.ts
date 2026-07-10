import type { Request, Response } from 'express';
import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import {
    streamText,
    createUIMessageStream,
    pipeUIMessageStreamToResponse,
    convertToModelMessages,
    stepCountIs,
} from 'ai';
import { chatModel } from '../lib/ai-provider.js';
import { retrieveRelevantChunks } from '../lib/rag.js';
import { clientTools } from '../lib/ai-tools.js';
import { inventoryAgingTools } from '../lib/ai-inventory-tools.js';
import { putawayTools } from '../lib/ai-putaway-tools.js';
import { validateReadOnlySql, formatQueryResult } from '../lib/ai-db-tools.js';
import { prisma } from '../lib/prisma.js';


const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key-change-this';

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
    let token: string | null = null;
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = parseCookie(cookieHeader);
        if (cookies.access_token) token = cookies.access_token;
    }
    if (!token) {
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
    }
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    let userId: string;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        if (!payload?.userId) throw new Error('Invalid token payload');
        userId = String(payload.userId);
    } catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    // --- Parse body ---
    // Accept both { messages } (legacy) and { id, messages } (resume-stream pattern)
    const { messages, id: chatId } = req.body as { messages: unknown[]; id?: string };
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

    // --- Stream ---
    const modelMessages = await convertToModelMessages(trimmedMessages as any);

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
                },
                stopWhen: stepCountIs(8),
            });
            writer.merge(result.toUIMessageStream());
        },
    });

    pipeUIMessageStreamToResponse({ response: res, stream });
}

export async function aiChatResumeHandler(_req: Request, res: Response) {
    // No resumable stream storage is configured yet; return 204 so useChat resume
    // can gracefully fall back to the local message cache on the client.
    res.status(204).end();
}

export async function aiQueryDatabaseHandler(req: Request, res: Response) {
    // --- Auth ---
    let token: string | null = null;
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = parseCookie(cookieHeader);
        if (cookies.access_token) token = cookies.access_token;
    }
    if (!token) {
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
    }
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        jwt.verify(token, JWT_SECRET);
    } catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    // --- Parse body ---
    const { sql, limit = 100 } = req.body as { sql?: string; limit?: number };
    if (!sql || typeof sql !== 'string') {
        res.status(400).json({ error: 'sql is required and must be a string' });
        return;
    }

    // --- Validate SQL ---
    const validation = validateReadOnlySql(sql);
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
        const result = await prisma.$queryRawUnsafe(finalSql);
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
- recommend_putaway_location: Score and rank empty locations for a specific pallet using the strategy rules. Returns a top recommendation + alternatives. Use after get_putaway_state to pick where each pallet goes.

### Client-side tools (control the PutawayPanel + 3D view)
- selectPutawayTransaction: Open the putaway panel and select an inbound transaction. Use this FIRST when starting a putaway workflow for a specific transaction.
- selectPutawayPallet: Select a specific unassigned pallet in the panel (highlights it as the active pallet being placed).
- highlightPutawayLocation: Highlight a storage location in the 3D view (green pulsing marker). Use to show the user which location you recommend.
- stagePutawayAssignment: Stage one or more pallet→location assignments locally (green cards in the panel, green markers in 3D). NOT persisted yet.
- unstagePutawayAssignment: Remove a single pallet's staged assignment (undo).
- savePutawayAssignments: Commit ALL staged assignments to the server in one batch. Only call after the user confirms.

### Putaway strategy rules (encoded in the recommendation scorer)
1. Same-SKU grouping (+100) — prefer locations already holding the same SKU to consolidate storage.
2. FIFO proximity (+0..30) — fill locations nearest to the receiving area first (lower sequence number).
3. Zone-based SKU type (+50) — raw/packaging materials → floor locations; finished goods → rack locations.
4. Lower-floor priority (+15) — floor locations preferred for heavy/bulk pallets.

### Putaway workflow (chat-driven)
When the user asks you to putaway pallets, follow this workflow:
1. Call getPageContext to read the current warehouse layout page state (which warehouse, which transaction is selected, how many unassigned pallets).
2. If no transaction is selected, call get_putaway_state to find transactions with unassigned pallets, then selectPutawayTransaction to open it in the panel.
3. Call recommend_putaway_location for each unassigned pallet to get the best location.
4. Call selectPutawayPallet + highlightPutawayLocation to show the user which pallet and which location you recommend.
5. Call stagePutawayAssignment to stage the proposed assignments locally (they appear as green cards in the panel).
6. Tell the user to review the staged assignments and confirm. After they confirm, call savePutawayAssignments to persist.
7. You can call get_putaway_state again to check remaining unassigned pallets and continue.

IMPORTANT — Putaway is a "recommend + stage + confirm + save" flow. You NEVER auto-persist assignments without the user's confirmation. Always stage first, tell the user to review, then save after they confirm.

The 3D warehouse layout page (where putaway happens) is at /warehouse/:id (warehouse detail → 3D layout). The PutawayPanel is a side panel on that page, not a separate route.${contextSection}`;
}
