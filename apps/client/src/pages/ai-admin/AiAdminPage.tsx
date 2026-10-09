import { AppIcon } from "../../components/AppIcon";
import type { IconName } from "../../components/AppIcon";
import {
  Button,
  Card,
  CardContent,
  ScrollShadow,
  Spinner,
  TextArea,
} from "@heroui/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIntl } from "react-intl";
import { authUserAtom, hasPermissionAtom } from "../../lib/atoms";
import {
  apiBaseUrl,
  csrfHeaders,
  ensureCsrfToken,
  getCsrfToken,
  isCsrfErrorBody,
  notifyCsrfFailure,
  notifyIfStillCsrf,
  refreshCsrfToken,
} from "../../lib/csrf";
import {
  ChatToolPart,
  type ChatToolMeta,
} from "../../components/AiChat/ChatToolPart";
import { chatContinuationWhen } from "../../components/AiChat/sendWhen";
import { PageTitle } from "../../components/PageTitle";

// ── Markdown Components (same as AiAssistant) ──────────────────────────────

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-[15px] font-bold mt-3 mb-1.5">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[14px] font-bold mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-semibold mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-black/10 rounded px-1 py-0.5 font-mono text-[12px]"
          {...rest}
        >
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
    <pre className="bg-black/10 rounded p-2 my-2 overflow-x-auto text-[12px] font-mono whitespace-pre">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-purple-500/30 pl-3 my-2 text-default-600">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-default-200" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[12px] border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/5">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-black/10 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-black/10 px-2 py-1">{children}</td>
  ),
};

const sanitizeUrl = (url: string) =>
  /^(https?:|mailto:|#)/.test(url) ? url : "#";

function MarkdownBubble({ text }: { text: string }) {
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

// ── Patched Fetch (same as AiAssistant) ────────────────────────────────────

const createPatchedFetch = (): typeof fetch => {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const method = (init?.method ?? "GET").toUpperCase();
    let currentInit = init;

    // CSRF double-submit header for POST sends. Awaited (not raced with app
    // boot) and injected here — rather than relying only on the transport's
    // sync `headers()` snapshot — so first-open sends always carry the token.
    if (method === "POST") {
      try {
        await ensureCsrfToken();
      } catch {
        // Proceed without a token; the 403 path below retries after a refresh.
      }
      const token = getCsrfToken();
      if (token) {
        const headers = new Headers(currentInit?.headers);
        if (!headers.has("x-csrf-token")) {
          headers.set("x-csrf-token", token);
          currentInit = { ...currentInit, headers };
        }
      }
    }

    let response = await window.fetch(input, currentInit);

    // Token/cookie rotated mid-session: refresh once and resend instead of
    // surfacing the server's `Invalid CSRF token` 403 in the chat.
    if (method === "POST" && response.status === 403) {
      let csrf = false;
      try {
        csrf = isCsrfErrorBody(await response.clone().json());
      } catch {
        // non-JSON body — not a CSRF rejection, fall through
      }
      if (csrf) {
        let refreshed = false;
        try {
          await refreshCsrfToken();
          refreshed = true;
        } catch {
          notifyCsrfFailure();
          // fall through with the original response
        }
        if (refreshed) {
          const token = getCsrfToken();
          const headers = new Headers(currentInit?.headers);
          if (token) headers.set("x-csrf-token", token);
          response = await window.fetch(input, { ...currentInit, headers });
          await notifyIfStillCsrf(response);
        }
      }
    }

    if (method !== "POST" || !response.body || response.status === 204)
      return response;

    type ToolBuf = { toolName: string; inputText: string };
    const buffers = new Map<string, ToolBuf>();
    let partial = "";

    const patchedBody = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          partial += new TextDecoder().decode(chunk);
          const lines = partial.split("\n");
          partial = lines.pop() ?? "";

          const out: string[] = [];

          for (const line of lines) {
            const isFinishStep =
              line.startsWith("data: ") &&
              (() => {
                try {
                  const ev = JSON.parse(line.slice(6).trim()) as Record<
                    string,
                    unknown
                  >;
                  return ev.type === "finish-step";
                } catch {
                  return false;
                }
              })();

            if (isFinishStep && buffers.size > 0) {
              for (const [toolCallId, buf] of buffers) {
                try {
                  const toolInput = JSON.parse(buf.inputText) as unknown;
                  const injected = JSON.stringify({
                    type: "tool-input-available",
                    toolCallId,
                    toolName: buf.toolName,
                    input: toolInput,
                  });
                  out.push(`data: ${injected}`);
                  out.push("");
                } catch {
                  /* skip */
                }
              }
              buffers.clear();
            }

            out.push(line);

            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (ev.type === "tool-input-start") {
              buffers.set(String(ev.toolCallId), {
                toolName: String(ev.toolName ?? ""),
                inputText: "",
              });
            } else if (ev.type === "tool-input-delta") {
              const b = buffers.get(String(ev.toolCallId));
              if (b) b.inputText += String(ev.inputTextDelta ?? "");
            }
          }

          if (out.length > 0) {
            ctrl.enqueue(new TextEncoder().encode(out.join("\n") + "\n"));
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

// ── Tool metadata for chips ────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: IconName; label: string }> = {
  executeSql: { icon: "database", label: "Execute SQL" },
  runSystemDiagnostic: {
    icon: "shield-check",
    label: "Diagnostic",
  },
  listTables: { icon: "list", label: "List tables" },
};

// ── Page Component ─────────────────────────────────────────────────────────

export default function AiAdminPage() {
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const user = useAtomValue(authUserAtom);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const rafRef = useRef<number | null>(null);

  const chatId = user?.id ? `ai-admin-chat-${user.id}` : "ai-admin-chat-anon";

  const [initialMessages] = useState<UIMessage[]>(() => {
    try {
      const stored = localStorage.getItem(chatId);
      return stored ? (JSON.parse(stored) as UIMessage[]) : [];
    } catch {
      return [];
    }
  });

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    addToolOutput,
    addToolApprovalResponse,
  } = useChat({
    id: chatId,
    messages: initialMessages,
    resume: true,
    transport: new DefaultChatTransport({
      api: `${apiBaseUrl}/api/ai/admin/chat`,
      credentials: "include",
      // CSRF double-submit header for POST sends (refreshed per request).
      headers: () => csrfHeaders(),
      fetch: createPatchedFetch(),
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { id, messages: msgs },
      }),
      prepareReconnectToStreamRequest: ({ id }) => ({
        api: `${apiBaseUrl}/api/ai/admin/chat/${id}/stream`,
        credentials: "include" as RequestCredentials,
      }),
    }),
    sendAutomaticallyWhen: chatContinuationWhen,
  });

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(chatId, JSON.stringify(messages));
    }
  }, [messages, chatId]);

  const clearChat = () => {
    localStorage.removeItem(chatId);
    setMessages([]);
  };

  // Track scroll position
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 80;
      isAtBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        threshold;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll
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

  const isLoading = status === "submitted" || status === "streaming";

  // A pending form answer (input-available) or approval (approval-requested) on the
  // last assistant message must be resolved first — sending text now would make the
  // server's convertToModelMessages throw MissingToolResultsError (500).
  const hasPendingInteraction = useMemo(() => {
    const lastMsg = messages.at(-1);
    if (!lastMsg || lastMsg.role !== "assistant") return false;
    return lastMsg.parts.some(
      (part) =>
        (part.type.startsWith("tool-") || part.type === "dynamic-tool") &&
        ((part as Record<string, unknown>).state === "input-available" ||
          (part as Record<string, unknown>).state === "approval-requested"),
    );
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading || hasPendingInteraction) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Permission denied guard
  if (!hasPermission("ai_admin@access")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AppIcon name="shield-alert" width={64} className="text-danger" />
        <h1 className="text-xl font-bold">
          {intl.formatMessage({
            id: "ai_admin.error_title",
            defaultMessage: "AI Error",
          })}
        </h1>
        <p className="text-default-500">
          {intl.formatMessage({
            id: "ai_admin.permission_denied",
            defaultMessage:
              "You do not have permission to access the AI System Admin.",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <PageTitle
            title={intl.formatMessage({
              id: "ai_admin.page_title",
              defaultMessage: "AI System Admin",
            })}
          />
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AppIcon name="magic-wand" width={22} className="text-purple-500" />
            {intl.formatMessage({
              id: "ai_admin.page_title",
              defaultMessage: "AI System Admin",
            })}
          </h1>
          <p className="text-sm text-default-500 mt-1">
            {intl.formatMessage({
              id: "ai_admin.page_subtitle",
              defaultMessage: "Full database access — use with caution",
            })}
          </p>
        </div>
        <Button size="sm" variant="danger" onPress={clearChat}>
          <AppIcon name="trash" width={16} />
          {intl.formatMessage({
            id: "ai_admin.clear_chat",
            defaultMessage: "Clear Chat",
          })}
        </Button>
      </div>

      {/* Messages Area */}
      <Card className="flex-1 min-h-0 mb-4">
        <CardContent className="p-0">
          <ScrollShadow className="h-full p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-8">
                <AppIcon
                  name="shield-alert"
                  width={48}
                  className="text-purple-400"
                />
                <p className="text-default-500 max-w-md">
                  {intl.formatMessage({
                    id: "ai_admin.empty_state",
                    defaultMessage:
                      "AI System Admin is ready. You have full database read/write access. Ask me to query, update, or manage your data.",
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-default-100"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.parts
                            .filter((p) => p.type === "text")
                            .map((p) => (p as { text: string }).text)
                            .join("\n")}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {/* Tool parts: form cards, approval cards, result tables, chips */}
                          {msg.parts
                            .filter(
                              (p) =>
                                p.type.startsWith("tool-") ||
                                p.type === "dynamic-tool",
                            )
                            .map((part) => (
                              <ChatToolPart
                                key={String(
                                  (part as Record<string, unknown>)
                                    .toolCallId ?? part.type,
                                )}
                                part={
                                  part as Record<string, unknown> & {
                                    type: string;
                                  }
                                }
                                toolMeta={TOOL_META as ChatToolMeta}
                                addToolOutput={addToolOutput}
                                addToolApprovalResponse={
                                  addToolApprovalResponse
                                }
                              />
                            ))}
                          {/* Text content */}
                          {(() => {
                            const text = msg.parts
                              .filter((p) => p.type === "text")
                              .map((p) => (p as { text: string }).text)
                              .join("\n")
                              .trim();
                            return text ? <MarkdownBubble text={text} /> : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-default-100 rounded-lg px-4 py-2.5">
                      <Spinner size="sm" />
                    </div>
                  </div>
                )}
                {error && (
                  <div className="flex justify-center">
                    <div className="bg-danger-50 rounded-lg px-4 py-2 text-sm text-danger">
                      {error.message}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollShadow>
        </CardContent>
      </Card>

      {/* Input Area */}
      <div className="shrink-0">
        {hasPendingInteraction && (
          <p className="text-xs text-warning flex items-center gap-1 mb-2">
            <AppIcon name="warning" width={12} />
            {intl.formatMessage({
              id: "ai_chat.pending_hint",
              defaultMessage:
                "Please answer the pending form or approval first",
            })}
          </p>
        )}
        <div className="flex gap-2">
          <TextArea
            variant="secondary"
            placeholder={intl.formatMessage({
              id: "ai_admin.input_placeholder",
              defaultMessage: "Ask the system admin AI...",
            })}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            style={{
              flex: 1,
              minWidth: 0,
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          />
          <Button
            variant="primary"
            isIconOnly
            onPress={handleSend}
            isDisabled={!input.trim() || isLoading || hasPendingInteraction}
            className="self-end"
          >
            <AppIcon name="arrow-up" width={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
