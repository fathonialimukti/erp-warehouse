import { Icon } from '@iconify/react';
import { Button, Card, CardContent, CardFooter, CardHeader, Chip, ScrollShadow, Spinner, TextArea } from '@heroui/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useAtomValue, useSetAtom } from 'jotai';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { UIMessage } from 'ai';
import { useNavigate } from 'react-router';
import { aiFormFillAtom, authUserAtom } from '../../lib/atoms';

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
    if (!response.body) return response;

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

const renderInlineTextStyle = (text: string): ReactNode[] => {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  let key = 0;

  while (match) {
    const token = match[0];
    const start = match.index;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (token.startsWith('**')) {
      nodes.push(<strong key={`strong-${key++}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`em-${key++}`}>{token.slice(1, -1)}</em>);
    }

    lastIndex = start + token.length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const renderRegularChatText = (text: string): ReactNode => {
  const lines = text.split('\n');
  return lines.map((line, idx) => (
    <span key={`line-${idx}`}>
      {renderInlineTextStyle(line)}
      {idx < lines.length - 1 ? <br /> : null}
    </span>
  ));
};

// Metadata for rendering tool activity chips
const TOOL_META: Record<string, { icon: string; label: string }> = {
  navigateTo: { icon: 'solar:arrow-right-up-linear', label: 'Navigate' },
  fillFormFields: { icon: 'solar:pen-2-linear', label: 'Fill form' },
  getPageContext: { icon: 'solar:eye-linear', label: 'Read page' },
};

function ToolChip({ toolName, part }: { toolName: string; part: Record<string, unknown> }) {
  const meta = TOOL_META[toolName] ?? { icon: 'solar:bolt-circle-linear', label: toolName };
  const state = String(part.state ?? 'input-available');
  const input = part.input as Record<string, unknown> | undefined;

  let detail = '';
  if (toolName === 'navigateTo' && input?.path) {
    detail = ` → ${String(input.path)}`;
  } else if (toolName === 'fillFormFields' && input?.fields) {
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
const collectPageContext = (): string => {
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
      // For form sections, also snapshot non-hidden input values
      if (typeof parsed.section === 'string' && parsed.section.includes('form')) {
        const inputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          'input:not([type=hidden]), textarea, select'
        );
        const currentValues: Record<string, string> = {};
        inputs.forEach(input => {
          if (input.name && input.value) {
            currentValues[input.name] = input.value;
          }
        });
        if (Object.keys(currentValues).length > 0) {
          parsed.currentValues = currentValues;
        }
      }
      sections.push(parsed);
    } catch {
      // skip malformed attribute
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
  });
};

export const AiAssistant = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const setFormFill = useSetAtom(aiFormFillAtom);
  // Tracks toolCallIds already executed to prevent double-firing (Strict Mode / multiple effects)
  const handledToolCallsRef = useRef(new Set<string>());

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
      api: 'http://localhost:2022/api/ai/chat',
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
        api: `http://localhost:2022/api/ai/chat/${id}/stream`,
        credentials: 'include' as RequestCredentials,
      }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
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

  // runTool is defined as a stable function via useCallback-equivalent pattern.
  // It must not close over stale addToolOutput — since it's called from inside useEffect
  // which always has the latest closure, this is safe.
  const runTool = (toolName: string, toolCallId: string, toolInput: unknown) => {
    if (handledToolCallsRef.current.has(toolCallId)) {
      console.log('[AI] dedup skip', toolCallId);
      return;
    }
    handledToolCallsRef.current.add(toolCallId);
    console.log('[AI] runTool', toolName, toolCallId, toolInput);

    if (toolName === 'navigateTo') {
      if (!toolInput || typeof toolInput !== 'object') return;
      const { path } = toolInput as { path: string };
      if (!path) return;
      const resolved = normalizeRoutePath(String(path));
      console.log('[AI] navigate →', resolved);
      void navigate(resolved);
      // No await — docs warn this can cause deadlocks
      addToolOutput({ tool: 'navigateTo', toolCallId, output: `Navigated to ${resolved}` });
      return;
    }
    if (toolName === 'fillFormFields') {
      if (!toolInput || typeof toolInput !== 'object') return;
      const { fields } = toolInput as { fields: Record<string, unknown> };
      if (!fields || typeof fields !== 'object') return;
      setFormFill(fields);
      addToolOutput({ tool: 'fillFormFields', toolCallId, output: `Filled ${Object.keys(fields).length} field(s)` });
      return;
    }
    if (toolName === 'getPageContext') {
      const context = collectPageContext();
      addToolOutput({ tool: 'getPageContext', toolCallId, output: context });
      return;
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        <Card style={{ width: '360px', marginBottom: '12px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} variant="default">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon icon="solar:magic-stick-3-bold" width={18} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>ERP Assistant</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <Chip size="sm" color="success" variant="soft">Online</Chip>
                <Button isIconOnly size="sm" variant="ghost" onPress={clearChat} aria-label="Clear chat history">
                  <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                </Button>
                <Button isIconOnly size="sm" variant="ghost" onPress={() => setOpen(false)}>
                  <Icon icon="solar:close-circle-linear" width={16} />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className='p-0'>
            <ScrollShadow className="h-[60vh] px-4" size={80}>
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
                    {message.parts.map((part, partIdx) => {
                      // Text bubble
                      if (part.type === 'text') {
                        if (!part.text) return null;

                        const hasEarlierTextPart = message.parts
                          .slice(0, partIdx)
                          .some(prev => prev.type === 'text' && typeof prev.text === 'string' && prev.text.length > 0);
                        const textToRender = !isUser && !hasEarlierTextPart
                          ? part.text.replace(/^\n+/, '')
                          : part.text;
                        if (!textToRender) return null;

                        return (
                          <div
                            key={partIdx}
                            style={{
                              maxWidth: '85%',
                              padding: '8px 12px',
                              borderRadius: '12px',
                              fontSize: '13px',
                              lineHeight: '1.5',
                              background: isUser ? '#006FEE' : '#f4f4f5',
                              color: isUser ? '#fff' : '#11181c',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {isUser ? textToRender : renderRegularChatText(textToRender)}
                          </div>
                        );
                      }

                      // step-start parts are structural — no visible separator needed;
                      // the natural gap between parts keeps the flow readable.
                      if (part.type === 'step-start') return null;

                      // Tool parts — typed (tool-*) and dynamic
                      if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                        const p = part as Record<string, unknown>;
                        const toolCallId = String(p.toolCallId ?? '');
                        if (toolCallId) {
                          const currentPosition = `${messageIdx}:${partIdx}`;
                          const latestPosition = latestToolPartPositionByCallId.get(toolCallId);
                          if (latestPosition && latestPosition !== currentPosition) return null;
                        }
                        const toolName = part.type === 'dynamic-tool'
                          ? String(p.toolName)
                          : part.type.slice('tool-'.length);
                        return <ToolChip key={partIdx} toolName={toolName} part={p} />;
                      }

                      return null;
                    })}
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
            </ScrollShadow>
          </CardContent>

          <CardFooter>
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'flex-end' }}>
              <TextArea
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                style={{ flex: 1 }}
              />
              <Button isIconOnly variant="primary" size="sm" onPress={handleSend} isDisabled={isLoading || !input.trim()}>
                <Icon icon="solar:plain-bold" width={16} />
              </Button>
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
