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
};
