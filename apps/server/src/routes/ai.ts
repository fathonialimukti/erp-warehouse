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
`.trim();

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

    // Extract last user message text for RAG query
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = extractUserMessageText(lastUserMsg);

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
    const modelMessages = await convertToModelMessages(messages as any);

    const stream = createUIMessageStream({
        execute: ({ writer }) => {
            const result = streamText({
                model: chatModel,
                system: buildSystemPrompt(userName, roleName, permissions, relevantContext),
                messages: modelMessages,
                temperature: 0,
                tools: {
                    ...clientTools,
                },
                stopWhen: stepCountIs(5),
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
- The current user's permissions are listed above. Do not ask the user for their permissions; use what is provided here.
- If the user lacks a required permission, explain which permission is needed and tell them to contact their system administrator.
- Call getPageContext when the user asks what they are seeing, wants a summary of the current page, asks how many records are shown, asks about visible data or form state, or when you need page content to answer accurately.
- When summarizing a page after getPageContext, respond in readable Markdown for humans:
    1) **Current Page Snapshot** (route + page purpose),
    2) **What Is Visible Now** (key data points, counts, record/form state),
    3) **Recommended Next Actions** (up to 3 practical actions).
- Prefer the page heading/section context over generic browser title text when both are available.
- Do not dump raw JSON from tool output; translate it into concise business language.
- Use navigateTo to guide users to the correct page before explaining what to do there.
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
- After filling fields, explicitly tell the user the form is prefilled and they must review and click Save/Submit themselves.
- Do not write a lead-in sentence when a tool call can directly satisfy the user request.
- Permission format is always resource@action (e.g. receiving@approve, warehouse@create).${contextSection}`;
}
