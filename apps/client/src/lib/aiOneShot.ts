/**
 * One-shot AI tool-call helper for dashboard cards.
 *
 * Sends a single user message to the existing `POST /api/ai/chat` streaming
 * endpoint, then parses the UIMessage SSE stream for a specific server tool's
 * OUTPUT (tool-output-available events) or the assistant's TEXT reply
 * (text-delta events). The chat widget is never opened.
 *
 * Local OpenAI-compatible models may never emit `tool-output-available`
 * cleanly, so the parser also resolves from `finish-step`/`finish-message`
 * buffered output and at stream end. Mirrors the parsing approach in
 * `apps/client/src/components/AiFill/aiStream.ts`.
 */
import {
  apiBaseUrl,
  csrfHeaders,
  ensureCsrfToken,
  isCsrfErrorBody,
  notifyCsrfFailure,
  notifyIfStillCsrf,
  refreshCsrfToken,
} from "./csrf.js";

const chatUrl = () => `${apiBaseUrl}/api/ai/chat`;

/**
 * POST to the AI chat endpoint with the CSRF double-submit header, retrying
 * once with a refreshed token when the server reports a CSRF 403 (token
 * missing at boot, or token/cookie rotated mid-session).
 */
const postChat = async (body: unknown): Promise<Response> => {
  try {
    await ensureCsrfToken();
  } catch {
    // Proceed without a token; the server decides (and we retry below on CSRF 403s).
  }
  const send = () =>
    fetch(chatUrl(), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(body),
    });

  let response = await send();
  if (response.status === 403) {
    let csrf = false;
    try {
      csrf = isCsrfErrorBody(await response.clone().json());
    } catch {
      // non-JSON body — not a CSRF rejection, fall through
    }
    if (csrf) {
      try {
        await refreshCsrfToken();
      } catch {
        notifyCsrfFailure();
        return response;
      }
      response = await send();
      await notifyIfStillCsrf(response);
    }
  }
  return response;
};

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const resolveOutput = (part: Record<string, unknown>): unknown => {
  const direct = part.output;
  if (direct && typeof direct === "object") return direct;

  const parsedFromOutput = parseJson(direct);
  if (parsedFromOutput && typeof parsedFromOutput === "object")
    return parsedFromOutput;

  const parsedFromText = parseJson(part.outputText);
  if (parsedFromText && typeof parsedFromText === "object")
    return parsedFromText;

  return direct;
};

/**
 * Send a one-shot chat message and await a named server tool's output.
 *
 * @param opts.toolName The server tool whose output to capture (e.g. 'get_anomalies').
 * @param opts.instruction The user message instructing the model which tool to call.
 * @param opts.chatId Stable chat id for the stream (e.g. `ai-insights-${userId}`).
 * @returns The resolved tool output object, or null if the tool never fired.
 * @throws On non-OK HTTP status.
 */
export async function requestToolOutput(opts: {
  toolName: string;
  instruction: string;
  chatId: string;
}): Promise<unknown | null> {
  const { toolName, instruction, chatId } = opts;

  const content = [
    "You are an AI assistant embedded in a Warehouse ERP Management System.",
    `Your ONLY task right now is to call the "${toolName}" tool and return its output.`,
    "",
    "STRICT RULES:",
    "- Call ONLY the " +
      toolName +
      " tool. Do NOT call navigateTo, queryDatabase, getPageContext, or any other tool.",
    "- Do NOT navigate anywhere.",
    "- Do not return a text message before or after the tool call.",
    "",
    `User instruction: ${instruction}`,
  ].join("\n");

  const response = await postChat({
    id: chatId,
    messages: [{ role: "user", content }],
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error("AI response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let toolOutput: unknown | null = null;
  let textReply = "";

  const tryResolve = (ev: Record<string, unknown>): boolean => {
    if (String(ev.toolName) === toolName) {
      const resolved = resolveOutput(ev);
      if (resolved && typeof resolved === "object") {
        toolOutput = resolved;
        return true;
      }
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (ev.type === "tool-output-available") {
        if (tryResolve(ev)) {
          await reader.cancel().catch(() => {});
          return toolOutput;
        }
      } else if (
        ev.type === "tool-output-delta" &&
        String(ev.toolName) === toolName
      ) {
        // Buffer textual output deltas as a fallback for local models.
        const delta = String(ev.outputTextDelta ?? "");
        const parsed = parseJson(delta);
        if (parsed && typeof parsed === "object") {
          toolOutput = parsed;
          await reader.cancel().catch(() => {});
          return toolOutput;
        }
        textReply += delta;
        void textReply;
      } else if (ev.type === "text-delta") {
        const delta = String(ev.delta ?? ev.textDelta ?? "");
        if (delta) textReply += delta;
        void textReply;
      } else if (ev.type === "finish-step" || ev.type === "finish-message") {
        if (toolOutput) {
          await reader.cancel().catch(() => {});
          return toolOutput;
        }
      }
    }
  }

  return toolOutput;
}

/**
 * Send a one-shot chat message and await the assistant's plain-text reply.
 *
 * @param opts.instruction The user message (e.g. a digest prompt).
 * @param opts.chatId Stable chat id for the stream.
 * @returns The accumulated text reply (may be empty on failure).
 * @throws On non-OK HTTP status.
 */
export async function requestTextReply(opts: {
  instruction: string;
  chatId: string;
}): Promise<string> {
  const { instruction, chatId } = opts;

  const response = await postChat({
    id: chatId,
    messages: [{ role: "user", content: instruction }],
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error("AI response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (ev.type === "text-delta") {
        text += String(ev.delta ?? "");
      }
    }
  }

  return text.trim();
}
