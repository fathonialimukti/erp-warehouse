/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma.js';

/**
 * SQL keywords that are FORBIDDEN for the admin AI.
 * DML writes (INSERT/UPDATE/DELETE) are allowed behind the approval gate;
 * DDL (table structure changes) is always blocked.
 */
const FORBIDDEN_DDL_KEYWORDS = [
    'DROP',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
    'EXECUTE',
    'CALL',
    'MERGE',
    'REPLACE',
];

/**
 * True when the statement mutates data (DML write). SELECT/WITH/EXPLAIN are reads.
 */
export function isWriteSql(sql: string): boolean {
    const upper = sql.trim().toUpperCase();
    return upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE');
}

/**
 * Ensure a write statement returns its affected rows so the UI can show what
 * changed. Appends `RETURNING *` when missing (validator already blocks
 * multi-statement input, so this is always a single statement).
 */
export function ensureReturning(sql: string): string {
    // Ignore string literals and quoted identifiers so a column/literal named
    // "returning" is not mistaken for the keyword. A bare `returning` followed
    // by a value token (a comparison operator, or a predicate keyword such as
    // `IS NULL` / `LIKE` / `BETWEEN`) is a column reference, not a clause.
    const withoutQuoted = sql
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"]|"")*"/g, '""');
    const returningClause = /\bRETURNING\b(?!\s*(?:[=<>!]|IS\b|LIKE\b|ILIKE\b|BETWEEN\b|IN\b|NOT\b|AND\b|OR\b))/i;
    if (returningClause.test(withoutQuoted)) return sql;
    return sql.replace(/;?\s*$/, '') + ' RETURNING *';
}

/**
 * Validates that a SQL string is safe to execute. Blocks DDL, comments, and
 * multi-statement queries. DML (INSERT, UPDATE, DELETE) is only accepted with
 * `{ allowDml: true }` — used by the approval-gated executeSql tool; the plain
 * HTTP query endpoint stays read-only.
 */
export function validateAdminSql(
    sql: string,
    options: { allowDml?: boolean } = {},
): { valid: boolean; reason?: string } {
    const { allowDml = false } = options;
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    const isDmlWrite = upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE');
    if (
        !upper.startsWith('SELECT') &&
        !upper.startsWith('WITH') &&
        !upper.startsWith('EXPLAIN') &&
        !(allowDml && isDmlWrite)
    ) {
        return { valid: false, reason: 'Only SELECT, WITH (CTE), and EXPLAIN queries are allowed for admin AI.' };
    }

    // Block comment-based injection
    if (trimmed.includes('--') || trimmed.includes('/*')) {
        return { valid: false, reason: 'Comments are not allowed in queries.' };
    }

    // Block multi-statement queries
    let inQuote = false;
    let semicolonCount = 0;
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === "'" && (i === 0 || trimmed[i - 1] !== '\\')) {
            inQuote = !inQuote;
        } else if (trimmed[i] === ';' && !inQuote) {
            semicolonCount++;
        }
    }
    if (semicolonCount > 1) {
        return { valid: false, reason: 'Multiple statements are not allowed.' };
    }

    // Check forbidden DDL keywords (outside of string literals)
    const withoutStrings = trimmed.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const upperNoStrings = withoutStrings.toUpperCase();

    for (const keyword of FORBIDDEN_DDL_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(upperNoStrings)) {
            return { valid: false, reason: `Query rejected: ${keyword} is not allowed. Only DML operations (SELECT, INSERT, UPDATE, DELETE) are permitted.` };
        }
    }

    return { valid: true };
}

/**
 * JSON replacer shared by read and write result formatting: handles Prisma
 * Decimal types, BigInt, and truncates very long strings to save tokens.
 */
const replacer = (_key: string, value: unknown): unknown => {
    // Handle Prisma Decimal type
    if (value && typeof value === 'object' && typeof (value as any).toNumber === 'function') {
        return (value as any).toNumber();
    }
    // Handle BigInt
    if (typeof value === 'bigint') return value.toString();
    // Truncate very long strings to save tokens
    if (typeof value === 'string' && value.length > 500) {
        return value.substring(0, 500) + '... [truncated]';
    }
    return value;
};

/**
 * Format a query result for the AI, handling Prisma Decimal types
 * and truncating long strings to keep token usage low.
 */
function formatQueryResult(data: unknown, rowCount: number, limit: number): string {
    return JSON.stringify(
        {
            success: true,
            rowCount,
            data,
            truncated: rowCount >= limit,
            hint: rowCount >= limit
                ? 'Results truncated. Add a more specific WHERE clause or reduce the LIMIT to get targeted data.'
                : null,
        },
        replacer,
    );
}

/**
 * Server-side admin tools for the AI System Admin.
 * These tools have full DML access (SELECT, INSERT, UPDATE, DELETE)
 * but are blocked from DDL (table structure changes).
 */
export const adminTools = {
    executeSql: tool({
        description:
            'Execute a SQL query with full DML access (SELECT, INSERT, UPDATE, DELETE). ' +
            'Use this to query data, insert new rows, update existing records, or delete rows. ' +
            'DDL operations (DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE) are blocked. ' +
            'INSERT/UPDATE/DELETE queries require explicit user approval in the chat UI before execution. ' +
            'Use PostgreSQL syntax with snake_case table and column names. ' +
            'Always include a LIMIT clause for SELECT queries. ' +
            'For INSERT/UPDATE/DELETE, always include a RETURNING clause to show affected rows.',
        inputSchema: z.object({
            sql: z
                .string()
                .describe(
                    'SQL query using PostgreSQL syntax. Can be SELECT, INSERT, UPDATE, or DELETE. ' +
                    'Table and column names are snake_case. ' +
                    'Example: SELECT id, code, name FROM skus WHERE type = \'RAW_MATERIAL\' LIMIT 10; ' +
                    'Example: UPDATE skus SET description = \'Updated\' WHERE id = \'01H...\' RETURNING id, code, description;'
                ),
            limit: z.number().optional().default(100).describe('Max rows to return (for SELECT queries). Default 100.'),
        }),
        // Human-in-the-loop gate: reads run immediately, writes pause until the
        // user approves the exact SQL in the chat (AI SDK v6 native approvals).
        needsApproval: async ({ sql }) => isWriteSql(sql),
        execute: async ({ sql, limit = 100 }) => {
            // allowDml: writes are gated by needsApproval above, not blocked here.
            // DDL keywords, comments, and multi-statements are still rejected.
            const validation = validateAdminSql(sql, { allowDml: true });
            if (!validation.valid) {
                return JSON.stringify({ error: 'Query rejected', message: validation.reason });
            }

            const isWrite = isWriteSql(sql);
            const hasLimit = /\bLIMIT\b/i.test(sql);
            const baseSql = hasLimit ? sql : sql.replace(/;?\s*$/, '') + ` LIMIT ${limit}`;
            const finalSql = isWrite ? ensureReturning(sql) : baseSql;

            try {
                if (isWrite) {
                    const rows = await prisma.$transaction(
                        async (tx) => tx.$queryRawUnsafe(finalSql),
                        { timeout: 30_000 },
                    );
                    const resultRows = Array.isArray(rows) ? rows : [];
                    return JSON.stringify({
                        success: true,
                        rowCount: resultRows.length,
                        data: resultRows,
                        committedInTransaction: true,
                        hint: 'Write committed inside a DB transaction. Rows returned via RETURNING. Immediately re-query the affected rows with a SELECT to verify and show the result to the user.',
                    }, replacer);
                }

                // Read path — read-only transaction for defense in depth.
                const result = await prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
                    return tx.$queryRawUnsafe(finalSql);
                }, { timeout: 30_000 });
                const rows = Array.isArray(result) ? result : [];
                return formatQueryResult(rows, rows.length, limit);
            } catch (error) {
                return JSON.stringify({
                    error: 'Query failed',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    hint: 'Check SQL syntax. Ensure table and column names match the database schema.',
                });
            }
        },
    }),

    runSystemDiagnostic: tool({
        description:
            'Run a system diagnostic gathering key health metrics: user count, transaction counts by type and status, ' +
            'pallet inventory overview, storage utilization, and recent activity log entries. ' +
            'Use this when the user asks "how is the system doing?", "system health check", or "give me a diagnostic overview".',
        inputSchema: z.object({
            reason: z.string().optional().describe('Why you are running the diagnostic'),
        }),
        execute: async () => {
            try {
                const [userCount, transactionCounts, palletOverview, storageUtil, recentActivity, recentErrors] = await Promise.all([
                    prisma.user.count(),

                    prisma.$queryRawUnsafe(`
                        SELECT 'receiving' as type, approval_status, COUNT(*)::int as count FROM receiving_transactions GROUP BY approval_status
                        UNION ALL SELECT 'shipment' as type, approval_status, COUNT(*)::int FROM shipment_transactions GROUP BY approval_status
                        UNION ALL SELECT 'disposal' as type, approval_status, COUNT(*)::int FROM disposal_transactions GROUP BY approval_status
                        UNION ALL SELECT 'wip_issue' as type, approval_status, COUNT(*)::int FROM wip_issue_transactions GROUP BY approval_status
                        UNION ALL SELECT 'wip_completion' as type, approval_status, COUNT(*)::int FROM wip_completion_transactions GROUP BY approval_status
                        UNION ALL SELECT 'rma_receipt' as type, approval_status, COUNT(*)::int FROM rma_receipt_transactions GROUP BY approval_status
                        UNION ALL SELECT 'found' as type, approval_status, COUNT(*)::int FROM found_transactions GROUP BY approval_status
                        UNION ALL SELECT 'loss' as type, approval_status, COUNT(*)::int FROM loss_transactions GROUP BY approval_status
                        UNION ALL SELECT 'return_to_supplier' as type, approval_status, COUNT(*)::int FROM return_to_supplier_transactions GROUP BY approval_status
                        UNION ALL SELECT 'subinventory_transfer' as type, approval_status, COUNT(*)::int FROM subinventory_transfer_transactions GROUP BY approval_status
                        ORDER BY type, approval_status
                    `),

                    prisma.$queryRawUnsafe(`
                        SELECT status, COUNT(*)::int as count FROM pallets GROUP BY status ORDER BY status
                    `),

                    prisma.$queryRawUnsafe(`
                        SELECT sl.status, COUNT(*)::int as count FROM storage_locations sl GROUP BY sl.status ORDER BY sl.status
                    `),

                    prisma.$queryRawUnsafe(`
                        SELECT al.id, al.message, al.resource_name, al.created_at, u.name as actor_name
                        FROM activity_logs al
                        LEFT JOIN users u ON al.actor_id = u.id
                        ORDER BY al.created_at DESC
                        LIMIT 10
                    `),

                    prisma.$queryRawUnsafe(`
                        SELECT al.id, al.message, al.resource_name, al.created_at, u.name as actor_name
                        FROM activity_logs al
                        LEFT JOIN users u ON al.actor_id = u.id
                        WHERE al.message ILIKE '%error%' OR al.message ILIKE '%fail%'
                        ORDER BY al.created_at DESC
                        LIMIT 5
                    `),
                ]);

                return JSON.stringify({
                    success: true,
                    diagnostic: {
                        userCount,
                        transactionCounts,
                        palletOverview,
                        storageUtilization: storageUtil,
                        recentActivity: recentActivity,
                        recentErrors: recentErrors,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                return JSON.stringify({
                    error: 'Diagnostic failed',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        },
    }),

    listTables: tool({
        description:
            'List all database tables and their row counts. Use this to understand the database schema before writing queries.',
        inputSchema: z.object({
            reason: z.string().optional().describe('Why you need the table list'),
        }),
        execute: async () => {
            try {
                const tables = await prisma.$queryRawUnsafe(`
                    SELECT schemaname, tablename
                    FROM pg_catalog.pg_tables
                    WHERE schemaname NOT IN ('pg_catalog', 'information_schema', '_prisma_migrations')
                    ORDER BY schemaname, tablename
                `) as Array<{ schemaname: string; tablename: string }>;

                const result = [];
                for (const t of tables) {
                    try {
                        const countResult = await prisma.$queryRawUnsafe(
                            `SELECT COUNT(*)::int as count FROM "${t.schemaname}"."${t.tablename}"`
                        ) as Array<{ count: number }>;
                        result.push({ table: t.tablename, schema: t.schemaname, rowCount: countResult[0]?.count ?? 0 });
                    } catch {
                        result.push({ table: t.tablename, schema: t.schemaname, rowCount: 'N/A' });
                    }
                }

                return JSON.stringify({ success: true, tables: result });
            } catch (error) {
                return JSON.stringify({
                    error: 'Failed to list tables',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        },
    }),
};