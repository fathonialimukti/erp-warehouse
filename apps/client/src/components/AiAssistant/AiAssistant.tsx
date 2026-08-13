import { Icon } from '@iconify/react';
import { Button, Card, CardContent, CardFooter, CardHeader, Chip, Input, ScrollShadow, Spinner, TextArea } from '@heroui/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useAtomValue, useSetAtom } from 'jotai';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { UIMessage } from 'ai';
import { useNavigate } from 'react-router';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiFormFillAtom, aiChatOpenAtom, aiChatPresetMessageAtom, authUserAtom, aiPutawaySelectionAtom, aiPutawayHighlightAtom, aiPutawayStageAtom, aiPutawayUnstageAtom, aiPutawaySaveAtom, aiPutawaySelectTransactionAtom, aiDispatchSelectionAtom, aiDispatchHighlightAtom, aiDispatchStageAtom, aiDispatchUnstageAtom, aiDispatchSaveAtom, aiDispatchSelectTransactionAtom, aiApproveAtom, aiRejectAtom } from '../../lib/atoms';

const ROUTE_ALIASES: Record<string, string> = {
  '/': '/dashboard',
  '/sku': '/skus',
  '/sku/new': '/skus/new',
  '/sku/create': '/skus/new',
  '/warehouses': '/warehouse',
  '/warehouses/new': '/warehouse/new',
  '/users/create': '/users/new',
  '/roles': '/access-control/roles',
  '/roles/new': '/access-control/roles/new',
  '/access-control': '/access-control/roles',
  '/stock-movements': '/stock-movement',
  '/receiving-transactions': '/inbound-transaction',
  '/receiving-transactions/new': '/inbound-transaction/receiving/new',
  '/shipments': '/outbound-transaction',
  '/shipments/new': '/outbound-transaction/shipment/new',
  '/disposals': '/outbound-transaction',
  '/disposals/new': '/outbound-transaction/disposal/new',
  '/loss-transactions': '/outbound-transaction',
  '/loss-transactions/new': '/outbound-transaction/loss/new',
  '/found-transactions': '/inbound-transaction',
  '/found-transactions/new': '/inbound-transaction/found/new',
  '/rma-receipts': '/inbound-transaction',
  '/rma-receipts/new': '/inbound-transaction/rma-receipt/new',
  '/wip-completions': '/inbound-transaction',
  '/wip-completions/new': '/inbound-transaction/wip-completion/new',
  '/wip-issues': '/outbound-transaction',
  '/wip-issues/new': '/outbound-transaction/wip-issue/new',
  '/return-to-supplier': '/outbound-transaction',
  '/return-to-supplier/new': '/outbound-transaction/return-to-supplier/new',
};

const normalizeRoutePath = (path: string) => {
  const trimmedPath = path.trim();
  return ROUTE_ALIASES[trimmedPath] ?? trimmedPath;
};

/**
 * Custom fetch wrapper that fixes a compatibility issue with local OpenAI-compatible models:
 * these models call tools correctly but emit `finishReason: "other"` instead of "tool-calls",
 * so the AI SDK never emits `tool-input-available` — leaving tool parts stuck in `input-streaming`
 * and `onToolCall` never fires.
 *
 * This transform intercepts the SSE stream, buffers `tool-input-delta` text per toolCallId,
 * and injects a synthetic `tool-input-available` event before each `finish-step` so the SDK
 * transitions tool parts to `input-available` and fires `onToolCall` normally.
 */
const createPatchedFetch = (): typeof fetch => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await window.fetch(input, init);
    // Only patch POST streaming responses — pass GET/HEAD/204 through untouched.
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'POST' || !response.body || response.status === 204) return response;

    type ToolBuf = { toolName: string; inputText: string };
    const buffers = new Map<string, ToolBuf>();
    let partial = '';

    const patchedBody = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          partial += new TextDecoder().decode(chunk);
          const lines = partial.split('\n');
          partial = lines.pop() ?? '';

          const out: string[] = [];

          for (const line of lines) {
            // Check if this is a finish-step — inject tool-input-available BEFORE it
            const isFinishStep = line.startsWith('data: ') && (() => {
              try {
                const ev = JSON.parse(line.slice(6).trim()) as Record<string, unknown>;
                return ev.type === 'finish-step';
              } catch { return false; }
            })();

            if (isFinishStep && buffers.size > 0) {
              for (const [toolCallId, buf] of buffers) {
                try {
                  const toolInput = JSON.parse(buf.inputText) as unknown;
                  const injected = JSON.stringify({ type: 'tool-input-available', toolCallId, toolName: buf.toolName, input: toolInput });
                  out.push(`data: ${injected}`);
                  out.push('');
                  console.log('[AI] injected tool-input-available for', toolCallId, buf.toolName, toolInput);
                } catch {
                  // incomplete / invalid JSON — skip injection for this tool
                }
              }
              buffers.clear();
            }

            out.push(line);

            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            let ev: Record<string, unknown>;
            try { ev = JSON.parse(raw) as Record<string, unknown>; } catch { continue; }

            if (ev.type === 'tool-input-start') {
              buffers.set(String(ev.toolCallId), { toolName: String(ev.toolName ?? ''), inputText: '' });
            } else if (ev.type === 'tool-input-delta') {
              const b = buffers.get(String(ev.toolCallId));
              if (b) b.inputText += String(ev.inputTextDelta ?? '');
            }
          }

          if (out.length > 0) {
            ctrl.enqueue(new TextEncoder().encode(out.join('\n') + '\n'));
          }
        },
        flush(ctrl) {
          if (partial) ctrl.enqueue(new TextEncoder().encode(partial));
        },
      }),
    );

    return new Response(patchedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
};

const parseToolInputJson = (value: unknown): unknown => {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const resolveToolInput = (part: Record<string, unknown>): unknown => {
  const direct = part.input;
  if (direct && typeof direct === 'object') return direct;

  const parsedFromInput = parseToolInputJson(direct);
  if (parsedFromInput && typeof parsedFromInput === 'object') return parsedFromInput;

  const parsedFromInputText = parseToolInputJson(part.inputText);
  if (parsedFromInputText && typeof parsedFromInputText === 'object') return parsedFromInputText;

  return direct;
};

// Hand-rolled markdown component map. Keeps the chat bubble compact (13px) and
// avoids the @tailwindcss/typography prose plugin, which is designed for
// long-form articles and fights HeroUI's design system at small sizes.
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-[15px] font-bold mt-3 mb-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[14px] font-bold mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[13px] font-semibold mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
      {children}
    </a>
  ),
  // Inline code: no className. Block code: has language-xxx from GFM and renders inside <pre>.
  code: ({ className, children, ...rest }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-black/10 rounded px-1 py-0.5 font-mono text-[12px]" {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      aria-label="Code block"
      className="bg-black/10 rounded p-2 my-2 overflow-x-auto text-[12px] font-mono whitespace-pre"
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-black/20 pl-3 my-2 text-default-600">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-default-200" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[12px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/5">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-black/10 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-black/10 px-2 py-1">{children}</td>,
};

// Whitelist safe URL protocols. Blocks javascript: / data: / vbscript: URIs.
const sanitizeUrl = (url: string) => (/^(https?:|mailto:|#)/.test(url) ? url : '#');

function MarkdownBubble({ text }: { text: string }) {
  // useMemo skips re-parsing the AST on parent re-renders that don't change the text
  // (e.g., status flips from 'streaming' to 'submitted' with the same buffer).
  const rendered = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
        urlTransform={sanitizeUrl}
      >
        {text}
      </ReactMarkdown>
    ),
    [text],
  );
  return <div className="ai-markdown">{rendered}</div>;
}

// Metadata for rendering tool activity chips
const TOOL_META: Record<string, { icon: string; label: string }> = {
  navigateTo: { icon: 'solar:arrow-right-up-linear', label: 'Navigate' },
  fillFormFields: { icon: 'solar:pen-2-linear', label: 'Fill form' },
  getPageContext: { icon: 'solar:eye-linear', label: 'Read page' },
  queryDatabase: { icon: 'solar:database-linear', label: 'Query DB' },
  selectPutawayTransaction: { icon: 'solar:document-add-linear', label: 'Select txn' },
  selectPutawayPallet: { icon: 'solar:hand-pointing-right-linear', label: 'Select pallet' },
  highlightPutawayLocation: { icon: 'solar:map-point-focus-linear', label: 'Highlight' },
  stagePutawayAssignment: { icon: 'solar:clipboard-check-linear', label: 'Stage' },
  unstagePutawayAssignment: { icon: 'solar:undo-left-round-linear', label: 'Unstage' },
  savePutawayAssignments: { icon: 'solar:diskette-linear', label: 'Save' },
  selectDispatchTransaction: { icon: 'solar:document-add-linear', label: 'Select txn' },
  selectDispatchItem: { icon: 'solar:hand-pointing-right-linear', label: 'Select item' },
  highlightPickPallet: { icon: 'solar:map-point-focus-linear', label: 'Highlight' },
  stagePickAssignment: { icon: 'solar:clipboard-check-linear', label: 'Stage' },
  unstagePickAssignment: { icon: 'solar:undo-left-round-linear', label: 'Unstage' },
  savePickAssignments: { icon: 'solar:diskette-linear', label: 'Save' },
  approveTransaction: { icon: 'solar:check-circle-linear', label: 'Approve' },
  rejectTransaction: { icon: 'solar:close-circle-linear', label: 'Reject' },
};

function ToolChip({ toolName, part }: { toolName: string; part: Record<string, unknown> }) {
  const meta = TOOL_META[toolName] ?? { icon: 'solar:bolt-circle-linear', label: toolName };
  const state = String(part.state ?? 'input-available');
  const input = part.input as Record<string, unknown> | undefined;

  let detail = '';
  if (toolName === 'fillFormFields' && input?.fields) {
    const count = Object.keys(input.fields as Record<string, unknown>).length;
    detail = ` (${count} field${count !== 1 ? 's' : ''})`;
  }

  const color =
    state === 'output-available' ? 'success' :
      state === 'output-error' ? 'danger' :
        state === 'input-streaming' ? 'warning' :
          ('default' as const);

  const prefix =
    state === 'output-available' ? '✓' :
      state === 'output-error' ? '✗' :
        state === 'input-streaming' ? '' : '…';

  const labelText = state === 'input-streaming'
    ? `${meta.label}…`
    : `${prefix} ${meta.label}${detail}`;

  return (
    <Chip size="sm" variant="soft" color={color}>
      <Icon icon={meta.icon} width={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
      {labelText}
    </Chip>
  );
}

/** Scrape all [data-ai-context] annotations from the current DOM into a JSON string. */
export const collectPageContext = (): string => {
  const route = window.location.pathname;
  const heading = document.querySelector('h1')?.textContent?.trim() ?? '';
  const browserTitle = document.title.replace(/\s*[|–-].*$/, '').trim();
  const title = heading || browserTitle;
  const visibleButtons = Array.from(document.querySelectorAll('button'))
    .map(btn => btn.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 8);
  const tableCount = document.querySelectorAll('table,[role="table"]').length;
  const inputCount = document.querySelectorAll('input:not([type=hidden]),textarea,select').length;
  const sections: unknown[] = [];

  document.querySelectorAll('[data-ai-context]').forEach(el => {
    const raw = el.getAttribute('data-ai-context');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      sections.push(parsed);
    } catch {
      // skip malformed attribute
    }
  });

  // Scrape SelectSearch dropdown options exposed via data-ai-select-options
  const selectOptions: Record<string, unknown[]> = {};
  document.querySelectorAll('[data-ai-select-options]').forEach(el => {
    const name = el.getAttribute('data-ai-select-options');
    const raw = el.textContent?.trim();
    if (name && raw) {
      try { selectOptions[name] = JSON.parse(raw) as unknown[]; } catch { /* skip */ }
    }
  });

  return JSON.stringify({
    route,
    title,
    heading: heading || null,
    browserTitle,
    quickStats: {
      tableCount,
      inputCount,
      visibleButtonCount: visibleButtons.length,
    },
    visibleButtons,
    sections,
    ...(Object.keys(selectOptions).length > 0 ? { selectOptions } : {}),
  });
};

export const AiAssistant = () => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const setFormFill = useSetAtom(aiFormFillAtom);
  const setPutawaySelection = useSetAtom(aiPutawaySelectionAtom);
  const setPutawayHighlight = useSetAtom(aiPutawayHighlightAtom);
  const setPutawayStage = useSetAtom(aiPutawayStageAtom);
  const setPutawayUnstage = useSetAtom(aiPutawayUnstageAtom);
  const setPutawaySave = useSetAtom(aiPutawaySaveAtom);
  const setPutawaySelectTransaction = useSetAtom(aiPutawaySelectTransactionAtom);
  const setDispatchSelection = useSetAtom(aiDispatchSelectionAtom);
  const setDispatchHighlight = useSetAtom(aiDispatchHighlightAtom);
  const setDispatchStage = useSetAtom(aiDispatchStageAtom);
  const setDispatchUnstage = useSetAtom(aiDispatchUnstageAtom);
  const setDispatchSave = useSetAtom(aiDispatchSaveAtom);
  const setDispatchSelectTransaction = useSetAtom(aiDispatchSelectTransactionAtom);
  const setApprove = useSetAtom(aiApproveAtom);
  const setReject = useSetAtom(aiRejectAtom);
  const aiChatOpen = useAtomValue(aiChatOpenAtom);
  const aiChatPresetMessage = useAtomValue(aiChatPresetMessageAtom);
  // Tracks toolCallIds already executed to prevent double-firing (Strict Mode / multiple effects)
  const handledToolCallsRef = useRef(new Set<string>());
  // Tracks pending async tool calls (like queryDatabase) to prevent premature auto-send
  const pendingToolCallsRef = useRef(new Set<string>());
  const [, setPendingToolCallsVersion] = useState(0);
  // Sentinel element at the bottom of the messages list for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Whether the user is currently scrolled to (near) the bottom of the chat.
  // When false, auto-scroll is suppressed so the user can read history without
  // being yanked back down on every streaming token / tool update.
  const isAtBottomRef = useRef(true);
  // rAF id for batching scroll calls across rapid message updates
  const rafRef = useRef<number | null>(null);

  const user = useAtomValue(authUserAtom);
  const chatId = user?.id ? `ai-chat-${user.id}` : 'ai-chat-anon';

  // Lazy-init: read once from localStorage so useChat gets stable initialMessages
  const [initialMessages] = useState<UIMessage[]>(() => {
    try {
      const stored = localStorage.getItem(chatId);
      return stored ? (JSON.parse(stored) as UIMessage[]) : [];
    } catch {
      return [];
    }
  });

  const { messages, sendMessage, setMessages, status, error, addToolOutput } = useChat({
    id: chatId,
    messages: initialMessages,
    // resume: automatically reconnects to any active server-side stream on mount.
    // The GET /api/ai/chat/:id/stream endpoint returns 204 when no stream is active,
    // which the SDK handles gracefully (falls back to localStorage messages).
    // To enable full persistence across server restarts, configure Redis + resumable-stream
    // on the server side and implement consumeSseStream in the POST handler.
    resume: true,
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      credentials: 'include',
      // Patches SSE stream to inject missing tool-input-available events from
      // local models that emit finishReason:"other" instead of "tool-calls".
      fetch: createPatchedFetch(),
      // Send chat id with every message so the server can track the active stream.
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { id, messages: msgs },
      }),
      // Point the resume GET request at our Express resume endpoint.
      prepareReconnectToStreamRequest: ({ id }) => ({
        api: `/api/ai/chat/${id}/stream`,
        credentials: 'include' as RequestCredentials,
      }),
    }),
    sendAutomaticallyWhen: (messages) => {
      // Block auto-send while any async tool call (like queryDatabase) is still pending
      if (pendingToolCallsRef.current.size > 0) return false;
      return lastAssistantMessageIsCompleteWithToolCalls(messages);
    },
    // Execute ALL tools (dynamic and typed) directly in onToolCall — NOT in useEffect.
    // sendAutomaticallyWhen is checked immediately after this callback resolves.
    // If we defer to useEffect, the predicate fires before the output is registered
    // and the next step never triggers, breaking multi-step chains (navigate → fill).
    onToolCall: ({ toolCall }) => {
      // String(toolCall.toolName) works for both dynamic (string) and typed (literal union) tools.
      const toolName = String(toolCall.toolName);
      console.log('[AI] onToolCall', toolName, toolCall.toolCallId, 'dynamic:', toolCall.dynamic);
      runTool(toolName, toolCall.toolCallId, toolCall.input as unknown);
    },
  });

  // Sync global aiChatOpen atom → local open state, and auto-send preset message
  useEffect(() => {
    if (aiChatOpen) {
      setOpen(true);
      if (aiChatPresetMessage) {
        sendMessage({ text: aiChatPresetMessage });
      }
    }
  }, [aiChatOpen, aiChatPresetMessage, sendMessage]);

  // runTool is defined as a stable function via useCallback-equivalent pattern.
  // It must not close over stale addToolOutput — since it's called from inside useEffect
  // which always has the latest closure, this is safe.
  const runTool = (toolName: string, toolCallId: string, toolInput: unknown) => {
    const alreadyHandled = handledToolCallsRef.current.has(toolCallId);
    if (alreadyHandled) {
      console.log('[AI] dedup skip side-effects for', toolCallId);
    } else {
      handledToolCallsRef.current.add(toolCallId);
      console.log('[AI] runTool', toolName, toolCallId, toolInput);
    }

    if (toolName === 'navigateTo') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'navigateTo', toolCallId, output: 'No input provided' });
        return;
      }
      const { path } = toolInput as { path: string };
      if (!path) {
        if (!alreadyHandled) addToolOutput({ tool: 'navigateTo', toolCallId, output: 'No path provided' });
        return;
      }
      const resolved = normalizeRoutePath(String(path));
      if (!alreadyHandled) {
        console.log('[AI] navigate →', resolved);
        void navigate(resolved);
      }
      addToolOutput({ tool: 'navigateTo', toolCallId, output: `Navigated to ${resolved}` });
      return;
    }
    if (toolName === 'fillFormFields') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'fillFormFields', toolCallId, output: 'No input provided' });
        return;
      }
      const { fields } = toolInput as { fields: Record<string, unknown> };
      if (!fields || typeof fields !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'fillFormFields', toolCallId, output: 'No fields provided' });
        return;
      }
      if (!alreadyHandled) setFormFill(fields);
      addToolOutput({ tool: 'fillFormFields', toolCallId, output: `Filled ${Object.keys(fields).length} field(s)` });
      return;
    }
    if (toolName === 'getPageContext') {
      if (!alreadyHandled) {
        const context = collectPageContext();
        addToolOutput({ tool: 'getPageContext', toolCallId, output: context });
      } else {
        // Even on dedup, deliver output so the server doesn't get MissingToolResultsError
        addToolOutput({ tool: 'getPageContext', toolCallId, output: collectPageContext() });
      }
      return;
    }
    if (toolName === 'queryDatabase') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'queryDatabase', toolCallId, output: JSON.stringify({ error: 'No input' }) });
        return;
      }
      const { sql, limit = 100 } = toolInput as { sql?: string; limit?: number };
      if (!sql) {
        if (!alreadyHandled) addToolOutput({ tool: 'queryDatabase', toolCallId, output: JSON.stringify({ error: 'No SQL provided' }) });
        return;
      }

      if (alreadyHandled) {
        // Already executing — still deliver output (async tools send output when done)
        return;
      }

      // Track this as a pending async call to block premature auto-send
      pendingToolCallsRef.current.add(toolCallId);
      setPendingToolCallsVersion(v => v + 1);

      // Call the server endpoint to execute the query
      fetch('/api/ai/query', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, limit }),
      })
        .then(res => res.json())
        .then(result => {
          pendingToolCallsRef.current.delete(toolCallId);
          const output = JSON.stringify(result);
          addToolOutput({ tool: 'queryDatabase', toolCallId, output });
          setPendingToolCallsVersion(v => v + 1);
        })
        .catch(err => {
          pendingToolCallsRef.current.delete(toolCallId);
          addToolOutput({
            tool: 'queryDatabase',
            toolCallId,
            output: JSON.stringify({
              error: 'Query failed',
              message: err instanceof Error ? err.message : 'Unknown error',
            }),
          });
          setPendingToolCallsVersion(v => v + 1);
         });
      return;
    }

    // ── Putaway control tools ────────────────────────────────────────────
    // These tools drive the PutawayPanel + 3D view via jotai atoms. The
    // WarehouseLayoutPage reads these atoms and applies the effects.
    if (toolName === 'selectPutawayTransaction') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'selectPutawayTransaction', toolCallId, output: 'No input provided' });
        return;
      }
      const { inboundTransactionId } = toolInput as { inboundTransactionId?: string };
      if (!inboundTransactionId) {
        if (!alreadyHandled) addToolOutput({ tool: 'selectPutawayTransaction', toolCallId, output: 'inboundTransactionId is required' });
        return;
      }
      if (!alreadyHandled) {
        setPutawaySelectTransaction({ inboundTransactionId });
      }
      addToolOutput({ tool: 'selectPutawayTransaction', toolCallId, output: `Selected inbound transaction ${inboundTransactionId} for putaway` });
      return;
    }
    if (toolName === 'selectPutawayPallet') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'selectPutawayPallet', toolCallId, output: 'No input provided' });
        return;
      }
      const { inboundTransactionId, palletId } = toolInput as { inboundTransactionId?: string; palletId?: string };
      if (!inboundTransactionId || !palletId) {
        if (!alreadyHandled) addToolOutput({ tool: 'selectPutawayPallet', toolCallId, output: 'inboundTransactionId and palletId are required' });
        return;
      }
      if (!alreadyHandled) {
        setPutawaySelection({ inboundTransactionId, palletId });
      }
      addToolOutput({ tool: 'selectPutawayPallet', toolCallId, output: `Selected pallet ${palletId} for putaway` });
      return;
    }
    if (toolName === 'highlightPutawayLocation') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'highlightPutawayLocation', toolCallId, output: 'No input provided' });
        return;
      }
      const { storageLocationId, reason } = toolInput as { storageLocationId?: string; reason?: string };
      if (!storageLocationId) {
        if (!alreadyHandled) addToolOutput({ tool: 'highlightPutawayLocation', toolCallId, output: 'storageLocationId is required' });
        return;
      }
      if (!alreadyHandled) {
        setPutawayHighlight({ storageLocationId, reason: reason ?? '' });
      }
      addToolOutput({ tool: 'highlightPutawayLocation', toolCallId, output: `Highlighted location ${storageLocationId}: ${reason ?? ''}` });
      return;
    }
    if (toolName === 'stagePutawayAssignment') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'stagePutawayAssignment', toolCallId, output: 'No input provided' });
        return;
      }
      const { assignments } = toolInput as { assignments?: Array<{ palletId: string; storageLocationId: string }> };
      if (!Array.isArray(assignments) || assignments.length === 0) {
        if (!alreadyHandled) addToolOutput({ tool: 'stagePutawayAssignment', toolCallId, output: 'assignments must be a non-empty array' });
        return;
      }
      if (!alreadyHandled) {
        setPutawayStage({ assignments });
      }
      addToolOutput({ tool: 'stagePutawayAssignment', toolCallId, output: `Staged ${assignments.length} assignment(s) locally — not yet saved` });
      return;
    }
    if (toolName === 'unstagePutawayAssignment') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'unstagePutawayAssignment', toolCallId, output: 'No input provided' });
        return;
      }
      const { palletId } = toolInput as { palletId?: string };
      if (!palletId) {
        if (!alreadyHandled) addToolOutput({ tool: 'unstagePutawayAssignment', toolCallId, output: 'palletId is required' });
        return;
      }
      if (!alreadyHandled) {
        setPutawayUnstage({ palletId });
      }
      addToolOutput({ tool: 'unstagePutawayAssignment', toolCallId, output: `Unstaged pallet ${palletId}` });
      return;
    }
    if (toolName === 'savePutawayAssignments') {
      if (!alreadyHandled) {
        // Use Date.now() as a monotonically increasing trigger value so the
        // effect re-fires even if save was called before.
        setPutawaySave(Date.now());
      }
      addToolOutput({ tool: 'savePutawayAssignments', toolCallId, output: 'Save triggered — committing staged assignments to the server' });
      return;
    }

    // ── Dispatch control tools ───────────────────────────────────────────
    // ponytail: handler duplication across 16 handlers (8 putaway + 8 dispatch). Extract makeToolHandler factory only when third tool family emerges.
    // These tools drive the DispatchPanel + 3D view via jotai atoms. The
    // WarehouseLayoutPage reads these atoms and applies the effects.
    if (toolName === 'selectDispatchTransaction') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'selectDispatchTransaction', toolCallId, output: 'No input provided' });
        return;
      }
      const { transactionId } = toolInput as { transactionId?: string };
      if (!transactionId) {
        if (!alreadyHandled) addToolOutput({ tool: 'selectDispatchTransaction', toolCallId, output: 'transactionId is required' });
        return;
      }
      if (!alreadyHandled) {
        setDispatchSelectTransaction({ transactionId });
      }
      addToolOutput({ tool: 'selectDispatchTransaction', toolCallId, output: `Selected outbound transaction ${transactionId} for dispatch` });
      return;
    }
    if (toolName === 'selectDispatchItem') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'selectDispatchItem', toolCallId, output: 'No input provided' });
        return;
      }
      const { transactionId, itemId } = toolInput as { transactionId?: string; itemId?: string };
      if (!transactionId || !itemId) {
        if (!alreadyHandled) addToolOutput({ tool: 'selectDispatchItem', toolCallId, output: 'transactionId and itemId are required' });
        return;
      }
      if (!alreadyHandled) {
        setDispatchSelection({ transactionId, itemId });
      }
      addToolOutput({ tool: 'selectDispatchItem', toolCallId, output: `Selected item ${itemId} for dispatch` });
      return;
    }
    if (toolName === 'highlightPickPallet') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'highlightPickPallet', toolCallId, output: 'No input provided' });
        return;
      }
      const { palletId, reason } = toolInput as { palletId?: string; reason?: string };
      if (!palletId) {
        if (!alreadyHandled) addToolOutput({ tool: 'highlightPickPallet', toolCallId, output: 'palletId is required' });
        return;
      }
      if (!alreadyHandled) {
        setDispatchHighlight({ palletId, reason: reason ?? '' });
      }
      addToolOutput({ tool: 'highlightPickPallet', toolCallId, output: `Highlighted pallet ${palletId}: ${reason ?? ''}` });
      return;
    }
    if (toolName === 'stagePickAssignment') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'stagePickAssignment', toolCallId, output: 'No input provided' });
        return;
      }
      const { assignments } = toolInput as { assignments?: Array<{ outboundTransactionItemId: string; palletId: string }> };
      if (!Array.isArray(assignments) || assignments.length === 0) {
        if (!alreadyHandled) addToolOutput({ tool: 'stagePickAssignment', toolCallId, output: 'assignments must be a non-empty array' });
        return;
      }
      if (!alreadyHandled) {
        setDispatchStage({ assignments });
      }
      addToolOutput({ tool: 'stagePickAssignment', toolCallId, output: `Staged ${assignments.length} pick(s) locally — not yet saved` });
      return;
    }
    if (toolName === 'unstagePickAssignment') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'unstagePickAssignment', toolCallId, output: 'No input provided' });
        return;
      }
      const { palletId } = toolInput as { palletId?: string };
      if (!palletId) {
        if (!alreadyHandled) addToolOutput({ tool: 'unstagePickAssignment', toolCallId, output: 'palletId is required' });
        return;
      }
      if (!alreadyHandled) {
        setDispatchUnstage({ palletId });
      }
      addToolOutput({ tool: 'unstagePickAssignment', toolCallId, output: `Unstaged pallet ${palletId}` });
      return;
    }
    if (toolName === 'savePickAssignments') {
      if (!alreadyHandled) {
        setDispatchSave(Date.now());
      }
      addToolOutput({ tool: 'savePickAssignments', toolCallId, output: 'Save triggered — committing staged picks to the server' });
      return;
    }

    // ── Approval control tools ────────────────────────────────────────────
    // These tools open approval/rejection modals on transaction detail pages.
    if (toolName === 'approveTransaction') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'approveTransaction', toolCallId, output: 'No input provided' });
        return;
      }
      const { transactionType, transactionId, rationale } = toolInput as { transactionType?: string; transactionId?: string; rationale?: string };
      if (!transactionType || !transactionId) {
        if (!alreadyHandled) addToolOutput({ tool: 'approveTransaction', toolCallId, output: 'transactionType and transactionId are required' });
        return;
      }
      if (!alreadyHandled) {
        setApprove({ transactionType, transactionId, rationale });
      }
      addToolOutput({ tool: 'approveTransaction', toolCallId, output: `Opened approve modal for ${transactionType} ${transactionId} — user must confirm` });
      return;
    }
    if (toolName === 'rejectTransaction') {
      if (!toolInput || typeof toolInput !== 'object') {
        if (!alreadyHandled) addToolOutput({ tool: 'rejectTransaction', toolCallId, output: 'No input provided' });
        return;
      }
      const { transactionType, transactionId, rationale } = toolInput as { transactionType?: string; transactionId?: string; rationale?: string };
      if (!transactionType || !transactionId) {
        if (!alreadyHandled) addToolOutput({ tool: 'rejectTransaction', toolCallId, output: 'transactionType and transactionId are required' });
        return;
      }
      if (!alreadyHandled) {
        setReject({ transactionType, transactionId, rationale });
      }
      addToolOutput({ tool: 'rejectTransaction', toolCallId, output: `Opened reject modal for ${transactionType} ${transactionId} — user must confirm` });
      return;
    }

    // Unknown tool — always deliver output so the server step can continue
    addToolOutput({ tool: toolName as any, toolCallId, output: `Unknown tool: ${toolName}` });
  };

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(chatId, JSON.stringify(messages));
    }
  }, [messages, chatId]);

  const clearChat = () => {
    localStorage.removeItem(chatId);
    setMessages([]);
    handledToolCallsRef.current.clear();
  };

  // Track scroll position so we only auto-scroll when the user is already at
  // the bottom. This lets users scroll up to read history during streaming
  // without being pulled back down on every token / tool-state update.
  useEffect(() => {
    if (!open) return;
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 80;
      isAtBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [open]);

  // Smart auto-scroll: only when near the bottom, batched via rAF, instant
  // (no smooth animation) to avoid the janky flicker that `scrollIntoView({
  // behavior: 'smooth' })` causes when every token queues a new animation.
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const container = messagesEndRef.current?.parentElement;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [messages]);

  // Primary tool execution path: watch messages for tool parts in input-available state.
  // This reliably catches tools whether onToolCall fired or not (e.g. when stream finishes
  // before onToolCall has a chance to run, or when the local model skips the callback).
  useEffect(() => {
    const lastMsg = messages.at(-1);
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    for (const part of lastMsg.parts) {
      if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') continue;
      const p = part as Record<string, unknown>;
      const toolName = part.type === 'dynamic-tool'
        ? String(p.toolName)
        : part.type.slice('tool-'.length);
      const resolvedInput = resolveToolInput(p);

      const state = String(p.state ?? '');
      // Only execute when input is fully available — never on input-streaming,
      // since we now inject tool-input-available via createPatchedFetch and
      // executing on partial deltas would use wrong/incomplete input values.
      if (state !== 'input-available') continue;

      console.log('[AI] useEffect tool part', toolName, p.state);
      runTool(toolName, String(p.toolCallId), resolvedInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Keep the latest position of each toolCallId so duplicate tool parts
  // (from step merges/replays) are shown only once in the UI.
  const latestToolPartPositionByCallId = new Map<string, string>();
  messages.forEach((message, messageIdx) => {
    message.parts.forEach((part, partIdx) => {
      if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') return;
      const toolCallId = String((part as Record<string, unknown>).toolCallId ?? '');
      if (!toolCallId) return;
      latestToolPartPositionByCallId.set(toolCallId, `${messageIdx}:${partIdx}`);
    });
  });

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      {open && (
        <Card style={{ width: isExpanded ? '680px' : '360px', marginBottom: '12px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease' }} variant="default">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon icon="solar:magic-stick-3-bold" width={18} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>ERP Assistant</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <Button isIconOnly size="sm" variant="ghost" onPress={clearChat} aria-label="Clear chat history">
                  <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                </Button>
                <Button isIconOnly size="sm" variant="ghost" onPress={() => setIsExpanded((v) => !v)} aria-label="Expand chat">
                  <Icon icon={isExpanded ? 'solar:minimize-square-linear' : 'solar:maximize-square-linear'} width={16} />
                </Button>
                <Button isIconOnly size="sm" variant="ghost" onPress={() => { setOpen(false); setIsExpanded(false); }}>
                  <Icon icon="solar:close-circle-linear" width={16} />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className='p-0'>
            <ScrollShadow className={isExpanded ? 'h-[75vh] px-4' : 'h-[60vh] px-4'} size={80}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '13px' }}>
                  <Icon icon="solar:chat-round-dots-linear" width={32} style={{ display: 'block', margin: '0 auto 8px' }} />
                  Ask me anything about this ERP system or ask me to navigate somewhere.
                </div>
              )}
              {messages.map((message, messageIdx) => {
                if (message.role !== 'user' && message.role !== 'assistant') return null;
                const isUser = message.role === 'user';

                // Check if there's anything visible to render
                const hasVisible = message.parts.some(
                  p => p.type === 'text' || p.type.startsWith('tool-') || p.type === 'dynamic-tool',
                );
                if (!hasVisible) return null;

                return (
                  <div
                    key={message.id}
                    style={{
                      marginBottom: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: '4px',
                    }}
                  >
                    {(() => {
                      // Single-pass render: walk parts in original order, accumulating
                      // consecutive text parts into a buffer that gets flushed as a
                      // markdown bubble only when a non-text part is encountered. This
                      // preserves step-by-step interleaving (text → tool → text renders
                      // as [text bubble] [tool chip] [text bubble]) while still merging
                      // back-to-back text parts that have no tool between them.
                      const bubbleStyle: React.CSSProperties = {
                        maxWidth: '85%',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        background: isUser ? '#006FEE' : '#f4f4f5',
                        color: isUser ? '#fff' : '#11181c',
                        whiteSpace: isUser ? 'pre-wrap' : 'normal',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        minWidth: 0,
                      };

                      const elements: ReactNode[] = [];
                      let textBuffer: string[] = [];
                      let isFirstTextSegment = true;
                      let segKey = 0;

                      const flushText = (): void => {
                        if (textBuffer.length === 0) return;
                        const merged = textBuffer.join('\n\n');
                        // Trim leading newlines only on the FIRST text segment of an
                        // assistant message, matching the original per-part behavior.
                        const textToRender = isUser || !isFirstTextSegment
                          ? merged
                          : merged.replace(/^\n+/, '');
                        textBuffer = [];
                        isFirstTextSegment = false;
                        if (!textToRender.trim()) return;
                        elements.push(
                          <div key={`text-${segKey++}`} style={bubbleStyle}>
                            {isUser ? textToRender : <MarkdownBubble text={textToRender} />}
                          </div>,
                        );
                      };

                      message.parts.forEach((part, partIdx) => {
                        if (part.type === 'text') {
                          if (typeof part.text === 'string' && part.text.length > 0) {
                            textBuffer.push(part.text);
                          }
                          return;
                        }
                        // step-start is structural — flush text but render nothing.
                        if (part.type === 'step-start') {
                          flushText();
                          return;
                        }
                        if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') return;

                        // Flush any pending text BEFORE the chip so order is preserved.
                        flushText();

                        const p = part as Record<string, unknown>;
                        const toolCallId = String(p.toolCallId ?? '');
                        if (toolCallId) {
                          const currentPosition = `${messageIdx}:${partIdx}`;
                          const latestPosition = latestToolPartPositionByCallId.get(toolCallId);
                          if (latestPosition && latestPosition !== currentPosition) return;
                        }
                        const toolName = part.type === 'dynamic-tool'
                          ? String(p.toolName)
                          : part.type.slice('tool-'.length);
                        elements.push(<ToolChip key={`tool-${partIdx}`} toolName={toolName} part={p} />);
                      });

                      // Flush any trailing text after the last part.
                      flushText();

                      if (elements.length === 0) return null;
                      return <>{elements}</>;
                    })()}
                  </div>
                );
              })}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ padding: '8px 12px', borderRadius: '12px', background: '#f4f4f5' }}>
                    <Spinner size="sm" />
                  </div>
                </div>
              )}
              {error && (
                <div style={{ fontSize: '12px', color: '#f31260', padding: '8px', background: '#fee7ef', borderRadius: '8px' }}>
                  Something went wrong. Please try again.
                </div>
              )}
              {/* Sentinel for auto-scroll */}
              <div ref={messagesEndRef} />
            </ScrollShadow>
          </CardContent>
          <CardFooter>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <ScrollShadow orientation="horizontal" style={{ display: 'flex', gap: '8px', overflowX: 'auto', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
                <Button
                  variant="tertiary"
                  size="sm"
                  onPress={() => setInput(intl.formatMessage({ id: 'aiAssistant.chips.summaryPage.prompt', defaultMessage: 'Summarize the current page for me.' }))}
                >
                  {intl.formatMessage({ id: 'aiAssistant.chips.summaryPage', defaultMessage: 'Summary this page' })}
                </Button>
              </ScrollShadow>
              <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'flex-end' }}>
                <Input
                  variant="secondary"
                  placeholder="Ask a question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button isIconOnly variant="primary" size="sm" onPress={handleSend} isDisabled={isLoading || !input.trim()}>
                  <Icon icon="solar:plain-bold" width={16} />
                </Button>
              </div>
            </div>
          </CardFooter>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          isIconOnly
          variant="primary"
          size="lg"
          onPress={() => setOpen((v) => !v)}
          style={{ boxShadow: '0 4px 20px rgba(0,111,238,0.4)', borderRadius: '50%' }}
        >
          {open ? (
            <Icon icon="solar:close-circle-bold" width={22} />
          ) : (
            <Icon icon="solar:magic-stick-3-bold" width={22} />
          )}
        </Button>
      </div>
    </div>
  );
};
