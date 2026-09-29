import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getRawSettings } from "./app-settings.js";

const SETTING_KEYS = {
  baseUrl: "ai.baseUrl",
  apiKey: "ai.apiKey",
  model: "ai.model",
} as const;

/** DB setting first, then env fallback. Empty stored value means "not set". */
const resolveAiValue = async (
  key: string,
  envName: string,
): Promise<string | null> => {
  const raw = await getRawSettings();
  const value = raw[key]?.trim();
  if (value) return value;
  return process.env[envName]?.trim() || null;
};

/**
 * Resolve the chat model from DB settings with env fallback.
 * Call per request — settings are cached and hot-reload on update.
 */
export async function getChatModel() {
  const baseURL =
    (await resolveAiValue(SETTING_KEYS.baseUrl, "AI_BASE_URL")) ??
    "http://localhost:20128/v1";
  // No committed fallback key — AI features fail provider-side until a key is set here or via AI_API_KEY.
  const apiKey =
    (await resolveAiValue(SETTING_KEYS.apiKey, "AI_API_KEY")) ?? "";
  const modelId =
    (await resolveAiValue(SETTING_KEYS.model, "AI_MODEL")) ?? "chatbot";

  const provider = createOpenAICompatible({
    name: "9router",
    baseURL,
    apiKey,
    supportsStructuredOutputs: true,
  });
  return provider(modelId);
}
