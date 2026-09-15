/**
 * Shared AI Fill utilities.
 *
 * The AI Fill feature reuses the existing `POST /api/ai/chat` streaming endpoint
 * (the same `aiChatHandler` that powers the chat widget). The client sends a
 * one-shot user message that instructs the model to ONLY call `fillFormFields`,
 * then parses the UIMessage SSE stream and extracts the `fields` object from the
 * first `fillFormFields` tool call. All other tool calls and text parts are ignored.
 */

import { csrfHeaders } from '../../lib/csrf';

const parseToolInputJson = (value: unknown): unknown => {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Resolve a tool call's input from an SSE event, handling both a structured
 * `input` object and a JSON-encoded `input` / `inputText` string. Mirrors the
 * helper in `AiAssistant.tsx`.
 */
const resolveToolInput = (part: Record<string, unknown>): unknown => {
  const direct = part.input;
  if (direct && typeof direct === 'object') return direct;

  const parsedFromInput = parseToolInputJson(direct);
  if (parsedFromInput && typeof parsedFromInput === 'object') return parsedFromInput;

  const parsedFromInputText = parseToolInputJson(part.inputText);
  if (parsedFromInputText && typeof parsedFromInputText === 'object') return parsedFromInputText;

  return direct;
};

/** Extract the `fields` object from a resolved `fillFormFields` tool input. */
const extractFields = (input: unknown): Record<string, unknown> | null => {
  if (!input || typeof input !== 'object') return null;
  const fields = (input as Record<string, unknown>).fields;
  if (fields && typeof fields === 'object') return fields as Record<string, unknown>;
  return null;
};

/**
 * Read a UIMessage SSE stream and return the `fields` object from the FIRST
 * `fillFormFields` tool call.
 *
 * Collects `tool-input-start` / `tool-input-delta` / `tool-input-available`
 * events for tool name `fillFormFields`, buffering `inputText` per `toolCallId`
 * (same approach as `createPatchedFetch` in `AiAssistant.tsx`). Resolves the
 * tool input JSON (handling both `input` and `inputText` fields) and returns the
 * first `fields` object found. All other tool calls and text parts are ignored.
 *
 * Local OpenAI-compatible models may never emit `tool-input-available` (they emit
 * `finishReason: "other"`), so the buffered `inputText` is also resolved at
 * `finish-step` / `finish-message` and at stream end.
 *
 * @throws If the stream ends without a resolvable `fillFormFields` call.
 */
export async function extractFillFieldsFromStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // toolCallId -> accumulated inputText from tool-input-delta events
  const inputTextByCall = new Map<string, string>();

  const resolveFromBuffer = (): Record<string, unknown> | null => {
    for (const inputText of inputTextByCall.values()) {
      const fields = extractFields(parseToolInputJson(inputText));
      if (fields) return fields;
    }
    return null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;

      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (ev.type === 'tool-input-start') {
        if (String(ev.toolName) === 'fillFormFields') {
          inputTextByCall.set(String(ev.toolCallId), '');
        }
      } else if (ev.type === 'tool-input-delta') {
        const toolCallId = String(ev.toolCallId);
        if (inputTextByCall.has(toolCallId)) {
          inputTextByCall.set(
            toolCallId,
            (inputTextByCall.get(toolCallId) ?? '') + String(ev.inputTextDelta ?? ''),
          );
        }
      } else if (ev.type === 'tool-input-available') {
        if (String(ev.toolName) === 'fillFormFields') {
          const fields = extractFields(resolveToolInput(ev));
          if (fields) {
            await reader.cancel().catch(() => {});
            return fields;
          }
        }
      } else if (ev.type === 'finish-step' || ev.type === 'finish-message') {
        // Local models may never emit tool-input-available — resolve from buffered deltas.
        const fields = resolveFromBuffer();
        if (fields) {
          await reader.cancel().catch(() => {});
          return fields;
        }
      }
    }
  }

  // Stream ended without a resolvable tool call — try the buffer one last time.
  const fields = resolveFromBuffer();
  if (fields) return fields;

  throw new Error('AI did not return any form fields. Please rephrase your instruction.');
}

/**
 * Send a one-shot AI fill request to the existing `POST /api/ai/chat` endpoint
 * and return the `fields` object from the first `fillFormFields` tool call.
 *
 * The one-shot user message strongly instructs the model to ONLY call
 * `fillFormFields` (no navigateTo, no queryDatabase, no getPageContext) and
 * embeds the current page context JSON so the model knows the form's field names.
 *
 * @throws On non-OK HTTP status or when the stream contains no `fillFormFields` call.
 */
export async function requestAiFillFields(opts: {
  instruction: string;
  pageContext: string;
  chatId: string;
}): Promise<Record<string, unknown>> {
  const { instruction, pageContext, chatId } = opts;

  const content = [
    'You are an AI assistant embedded in a Warehouse ERP Management System.',
    'Your ONLY task right now is to fill the currently visible form using the fillFormFields tool.',
    '',
    'STRICT RULES:',
    '- Call ONLY the fillFormFields tool. Do NOT call navigateTo, queryDatabase, getPageContext, or any other tool.',
    '- Do NOT navigate anywhere — the user is already on the correct form page.',
    '- Provide realistic, complete values for as many fields as you can from the page context below.',
    '- Each key in the fields object MUST match a known field name from the page context.',
    '- Return all recommended fields in a SINGLE fillFormFields call.',
    '- Do not return a text message before or after the tool call.',
    '',
    'Current page context (JSON):',
    pageContext,
    '',
    `User instruction: ${instruction}`,
  ].join('\n');

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({
      id: chatId,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') detail = body.error;
    } catch {
      // non-JSON error body — fall through to the generic message
    }
    throw new Error(
      `AI fill request failed (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  if (!response.body) {
    throw new Error('AI fill request returned an empty response body.');
  }

  return extractFillFieldsFromStream(response.body);
}
