/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import type { Request, Response } from "express";
import {
  streamText,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { getChatModel } from "../lib/ai-provider.js";
import { adminTools, validateAdminSql } from "../lib/ai-admin-tools.js";
import { coerceQueryLimit } from "../lib/ai-db-tools.js";
import { sanitizeString } from "../lib/sanitize.js";
import { requestFormInput } from "../lib/ai-form-tool.js";
import { prisma } from "../lib/prisma.js";
import { authenticateRequest } from "../lib/auth-middleware.js";

const MAX_HISTORY_TURNS = 20;

function trimMessageHistory(
  messages: { role: string }[],
  maxTurns: number,
): typeof messages {
  const kept: typeof messages = [];
  let turnsCollected = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    if (msg.role === "assistant") {
      kept.unshift(msg);
    } else if (msg.role === "user") {
      if (turnsCollected < maxTurns) {
        kept.unshift(msg);
        turnsCollected++;
      }
    }
  }

  return kept;
}

async function checkAdminPermission(userId: string): Promise<boolean> {
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

  if (!user?.role) return false;

  const permissions = user.role.permissions.map((rp) => rp.permission.name);

  // Check for exact match or wildcard
  return permissions.some((p) => p === "ai_admin@access" || p === "*");
}

export async function aiAdminChatHandler(req: Request, res: Response) {
  // --- Auth ---
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = auth.userId;

  // --- Permission check ---
  const hasPermission = await checkAdminPermission(userId);
  if (!hasPermission) {
    res
      .status(403)
      .json({ error: "Forbidden: ai_admin@access permission required" });
    return;
  }

  // --- Parse body ---
  const { messages } = req.body as { messages: unknown[]; id?: string };
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages must be an array" });
    return;
  }

  // --- Trim message history ---
  const trimmedMessages = trimMessageHistory(
    messages as any[],
    MAX_HISTORY_TURNS,
  );

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
  const permissions =
    user?.role?.permissions.map((rp) => rp.permission.name) ?? [];
  const userName = user?.name ?? user?.email ?? "User";
  const roleName = user?.role?.name ?? "Unknown";

  // --- Stream ---
  const modelMessages = await convertToModelMessages(trimmedMessages as any);
  const chatModel = await getChatModel();

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: chatModel,
        system: buildAdminSystemPrompt(userName, roleName, permissions),
        messages: modelMessages,
        temperature: 0,
        tools: { ...adminTools, requestFormInput },
        stopWhen: stepCountIs(10),
      });
      writer.merge(result.toUIMessageStream());
    },
  });

  pipeUIMessageStreamToResponse({ response: res, stream });
}

export async function aiAdminChatResumeHandler(_req: Request, res: Response) {
  // RESUME NOT IMPLEMENTED: No resumable stream storage is configured.
  // The client useChat hook will fall back to its local message cache.
  // Future: implement stream persistence with Redis or database storage.
  res.status(204).end();
}

export async function aiAdminQueryHandler(req: Request, res: Response) {
  // --- Auth ---
  const auth = authenticateRequest(req);
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = auth.userId;

  // --- Permission check ---
  const hasPermission = await checkAdminPermission(userId);
  if (!hasPermission) {
    res
      .status(403)
      .json({ error: "Forbidden: ai_admin@access permission required" });
    return;
  }

  // --- Parse body ---
  const { sql, limit: rawLimit } = req.body as {
    sql?: string;
    limit?: unknown;
  };
  if (!sql || typeof sql !== "string") {
    res.status(400).json({ error: "sql is required and must be a string" });
    return;
  }
  // ponytail: coerce — a string limit like '1; DELETE FROM users' must never reach SQL raw.
  const limit = coerceQueryLimit(rawLimit);

  // --- Sanitize & validate SQL (endpoint stays read-only: no allowDml) ---
  const sanitizedSql = sanitizeString(sql);
  const validation = validateAdminSql(sanitizedSql);
  if (!validation.valid) {
    res.json({
      error: "Query rejected",
      message: validation.reason,
    });
    return;
  }

  // --- Execute query ---
  // ponytail: sanitized string only, inside a read-only transaction for defense in depth.
  const hasLimit = /\bLIMIT\b/i.test(sanitizedSql);
  const finalSql = hasLimit
    ? sanitizedSql
    : sanitizedSql.replace(/;?\s*$/, "") + ` LIMIT ${limit}`;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return tx.$queryRawUnsafe(finalSql);
      },
      { timeout: 30_000 },
    );
    const rows = Array.isArray(result) ? result : [];
    res.json({
      success: true,
      rowCount: rows.length,
      data: rows,
    });
  } catch (error) {
    res.json({
      error: "Query failed",
      message: error instanceof Error ? error.message : "Unknown error",
      hint: "Check SQL syntax. Ensure table and column names match the database schema.",
    });
  }
}

function buildAdminSystemPrompt(
  userName: string,
  roleName: string,
  _permissions: string[],
): string {
  void _permissions;
  return `You are an AI System Administrator for a Warehouse ERP Management System.
You have FULL database access (read and write rows) and are trusted to manage the system at the database level.

## Your Identity
- You are the SYSTEM ADMINISTRATOR AI — a dangerous, powerful tool that can read and modify any row in the database.
- You are NOT the regular AI assistant. You are a separate, privileged AI with elevated access.
- The user speaking to you is: ${userName} (Role: ${roleName})

## Your Capabilities
- **executeSql**: Execute any SQL statement (SELECT, INSERT, UPDATE, DELETE). You can read and modify rows in any table. DDL operations (DROP, TRUNCATE, ALTER, CREATE) are blocked — you cannot change table structure.
- **runSystemDiagnostic**: Run a comprehensive system health check — user counts, transaction summaries, pallet inventory, storage utilization, recent activity, and error logs.
- **listTables**: List all database tables with their row counts.

## Critical Rules
1. **Warn before write operations**: Before executing any INSERT, UPDATE, or DELETE, clearly explain what you are about to do — which table, which rows, what the change is — and ask for confirmation. Never execute a write operation silently.
2. **Always use RETURNING**: For INSERT, UPDATE, and DELETE, always include a RETURNING clause to show the affected rows.
3. **Always use WHERE**: Never execute UPDATE or DELETE without a WHERE clause. If the user requests a full-table update, warn them explicitly.
4. **Use LIMIT for SELECT**: Always include a LIMIT clause on SELECT queries.
5. **Use snake_case**: All table and column names are in snake_case (e.g., receiving_transactions, approval_status, created_at).
6. **IDs are ULID strings**: All primary keys are 26-character ULID strings.
7. **Never SELECT password**: Never include the password column from the users table in any query.
8. **Be precise**: When users ask questions, prefer querying the database directly rather than guessing. Use listTables to understand the schema before writing queries.
9. **Markdown formatting**: Use Markdown for all responses — tables, lists, headings, and code blocks are encouraged for clarity.
10. **Audit trail**: Remind the user that all changes are logged in the activity_logs table and can be audited.

## Example Workflows
- User asks "how many SKUs do we have?" → executeSql: SELECT COUNT(*) as count FROM skus;
- User asks "show me pending transactions" → executeSql: query each transaction table for DRAFT/PROPOSED status
- User asks "update the description of SKU X" → warn the user, then UPDATE skus SET description = '...' WHERE id = '...' RETURNING *;
- User asks "delete all DRAFT receiving transactions" → warn the user this is destructive, ask for confirmation, then DELETE only after confirmation
- User asks "how is the system doing?" → runSystemDiagnostic

## Database Schema Reference
The database uses PostgreSQL. Key tables include:
- users, roles, permissions, role_has_permissions — access control
- warehouses, storage_locations — warehouse structure
- skus, pallet_types, suppliers — product catalog
- pallets, stock_movements, sku_inventory_balances — inventory
- receiving_transactions, shipment_transactions, disposal_transactions, etc. — transactions
- activity_logs — audit trail
- notifications — notification system

Use listTables to get the full schema when needed.

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
`;
}
