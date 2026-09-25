/* eslint-disable @typescript-eslint/no-explicit-any -- intentional at AI/serialization boundaries */
import { } from 'ai';
import { } from 'zod';
import { } from './prisma.js';

/**
 * Read-only SQL keywords allowed for AI database queries.
 * Any SQL containing forbidden write keywords is rejected before execution.
 */
const FORBIDDEN_KEYWORDS = [
    'INSERT',
    'UPDATE',
    'DELETE',
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
 * Validates that a SQL string contains only read-only operations.
 * Checks for forbidden keywords, comment-based injection, and
 * semicolon-separated multi-statements.
 */
export function validateReadOnlySql(sql: string): { valid: boolean; reason?: string } {
    const trimmed = sql.trim();

    // Must start with SELECT or WITH (for CTEs)
    const upper = trimmed.toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH') && !upper.startsWith('EXPLAIN')) {
        return { valid: false, reason: 'Only SELECT, WITH (CTE), and EXPLAIN queries are allowed.' };
    }

    // Block comment-based injection
    if (trimmed.includes('--') || trimmed.includes('/*')) {
        return { valid: false, reason: 'Comments are not allowed in queries.' };
    }

    // Block multi-statement queries (semicolons not inside string literals)
    // Simple check: count semicolons outside of single quotes.
    // ANY semicolon is rejected — a single `;` already terminates a statement,
    // so `SELECT 1; SELECT 2` (one semicolon) must be blocked too.
    let inQuote = false;
    let semicolonCount = 0;
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === "'" && (i === 0 || trimmed[i - 1] !== '\\')) {
            inQuote = !inQuote;
        } else if (trimmed[i] === ';' && !inQuote) {
            semicolonCount++;
        }
    }
    if (semicolonCount > 0) {
        return { valid: false, reason: 'Multiple statements are not allowed.' };
    }

    // Check forbidden keywords (outside of string literals)
    // Remove string literals first, then check
    const withoutStrings = trimmed.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const upperNoStrings = withoutStrings.toUpperCase();

    for (const keyword of FORBIDDEN_KEYWORDS) {
        // Use word boundary check to avoid false positives (e.g., "description" contains "delete")
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(upperNoStrings)) {
            return { valid: false, reason: `Query rejected: ${keyword} is not allowed. Only read-only queries are permitted.` };
        }
    }

    return { valid: true };
}

/**
 * Coerce an untrusted `limit` (HTTP body, tool arg) to a safe integer for
 * SQL interpolation. A string like '1; DELETE FROM users' parses to 1 —
 * never interpolated raw — and out-of-range values clamp to 1..500.
 */
export function coerceQueryLimit(value: unknown): number {
    const parsed = typeof value === 'number' ? Math.trunc(value) : parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return 100;
    return Math.min(500, Math.max(1, parsed));
}

/**
 * Format a query result for the AI, handling Prisma Decimal types
 * and truncating long strings to keep token usage low.
 */
export function formatQueryResult(data: unknown, rowCount: number, limit: number): string {
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
        (_key, value) => {
            // Handle Prisma Decimal type (has toNumber method)
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
        },
    );
}

