import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { wrapLanguageModel } from 'ai';

const localProvider = createOpenAICompatible({
    name: '9router',
    baseURL: process.env.AI_BASE_URL ?? 'http://localhost:20128/v1',
    // No committed fallback key — AI features are disabled unless AI_API_KEY is set.
    apiKey: process.env.AI_API_KEY ?? '',
    supportsStructuredOutputs: true,
});

export const chatModel = localProvider(process.env.AI_MODEL ?? 'chatbot');
