import { tool } from 'ai';
import { z } from 'zod';

/**
 * Client-side tool (NO execute): the model defines a form; the client renders
 * it as an interactive card (components/AiChat/ChatFormCard) and replies with
 * the user's answers via addToolOutput. The chat then resumes automatically
 * through the client's sendAutomaticallyWhen predicate.
 */
export const requestFormInput = tool({
    description:
        'Render an interactive form inside the chat for the user to fill. Use this when you need ' +
        'structured input from the user (missing required values, a choice among options, or ' +
        'confirmation details) instead of asking questions in prose. ' +
        'The result arrives as { submitted: true, values: {...} } or { submitted: false } (cancelled).',
    inputSchema: z.object({
        formTitle: z.string().describe('Short title shown on the form card'),
        description: z.string().optional().describe('One-line explanation of why you need this'),
        fields: z
            .array(
                z.object({
                    name: z.string().describe('Field key returned in values'),
                    label: z.string(),
                    type: z.enum(['text', 'number', 'date', 'select', 'textarea', 'checkbox']),
                    required: z.boolean().default(true),
                    placeholder: z.string().optional(),
                    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
                    options: z
                        .array(z.object({ value: z.string(), label: z.string() }))
                        .optional()
                        .describe('Required when type=select'),
                }),
            )
            .min(1)
            .max(12),
    }),
    // NO execute — client-side tool.
});
