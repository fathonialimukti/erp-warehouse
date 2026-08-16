import { useCallback, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAtomValue } from 'jotai';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { authUserAtom } from '../../lib/atoms';
import { requestTextReply } from '../../lib/aiOneShot';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface CachedDigest {
  text: string;
  savedAt: string; // ISO timestamp
}

const DIGEST_STORAGE_KEY = 'ai-digest-cache';

/** Read the cached digest for today (local date). Returns null if missing or expired. */
function readCachedDigest(userId: string | undefined): CachedDigest | null {
  try {
    const raw = localStorage.getItem(DIGEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CachedDigest>;
    const key = userId ?? 'anon';
    const entry = parsed[key];
    if (!entry?.text) return null;

    const saved = new Date(entry.savedAt);
    const now = new Date();
    const sameLocalDay =
      saved.getFullYear() === now.getFullYear() &&
      saved.getMonth() === now.getMonth() &&
      saved.getDate() === now.getDate();
    return sameLocalDay ? entry : null;
  } catch {
    return null;
  }
}

/** Persist the digest under the user's key, replacing any previous entry. */
function writeCachedDigest(userId: string | undefined, text: string) {
  try {
    const raw = localStorage.getItem(DIGEST_STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, CachedDigest>;
    parsed[userId ?? 'anon'] = { text, savedAt: new Date().toISOString() };
    localStorage.setItem(DIGEST_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Storage unavailable — digest still works for this session.
  }
}

const DIGEST_PROMPT =
  'Generate a short morning digest for a warehouse manager. ' +
  'Use get_approval_queue, get_anomalies, and get_warehouse_insights to cover: ' +
  'pending approvals, putaway/dispatch backlog, out-of-stock SKUs, dead stock value, and anything urgent. ' +
  'Answer in 5-7 short bullet lines in plain business language. ' +
  'Use Markdown formatting (bold, lists, headings) so the digest is scannable. ' +
  'If a tool fails or returns nothing, skip that item gracefully.';

// Compact markdown styling, mirroring the AI chat markdown components.
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-[15px] font-bold mt-2 mb-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[14px] font-bold mt-2 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[13px] font-semibold mt-1.5 mb-1">{children}</h3>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed text-foreground text-sm">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-sm text-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-sm text-foreground">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
      {children}
    </a>
  ),
  code: ({ className, children, ...rest }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-[12px]" {...rest}>
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
    <pre className="bg-black/10 dark:bg-white/10 rounded p-2 my-2 overflow-x-auto text-[12px] font-mono whitespace-pre">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-default-200" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[12px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/5 dark:bg-white/5">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-black/10 dark:border-white/10 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-black/10 dark:border-white/10 px-2 py-1">{children}</td>,
};

const sanitizeUrl = (url: string) => (/^(https?:|mailto:|#)/.test(url) ? url : '#');

function DigestMarkdown({ text }: { text: string }) {
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

export function AiDigestCard() {
  const intl = useIntl();
  const user = useAtomValue(authUserAtom);
  // Hydrate from localStorage on mount: if today's digest exists, show it
  // immediately without any AI call. Expires automatically at local midnight
  // (readCachedDigest compares the saved date to today).
  const [cached] = useState(() => readCachedDigest(user?.id));
  const [status, setStatus] = useState<Status>(cached ? 'success' : 'idle');
  const [digest, setDigest] = useState(cached?.text ?? '');
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const chatId = user?.id ? `ai-digest-${user.id}` : 'ai-digest-anon';

    setStatus('loading');
    setError(null);

    void requestTextReply({
      instruction: DIGEST_PROMPT,
      chatId,
    })
      .then((reply) => {
        if (requestIdRef.current !== requestId) return; // stale response
        setDigest(reply);
        setStatus(reply ? 'success' : 'error');
        if (reply) writeCachedDigest(user?.id, reply);
        if (!reply) setError('AI returned an empty digest');
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : 'AI Digest failed');
        setStatus('error');
      });
  }, [user?.id]);

  return (
    <Card>
      <Card.Header>
        <div className="flex w-full items-center justify-between">
          <div>
            <Card.Title>
              <span className="flex items-center gap-2">
                <Icon icon="solar:sun-2-linear" className="size-4 text-primary" />
                {intl.formatMessage({ id: 'aiDigest.title', defaultMessage: "Today's AI Digest" })}
              </span>
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'aiDigest.subtitle', defaultMessage: 'A proactive morning briefing from your AI assistant' })}
            </Card.Description>
          </div>
          {status !== 'idle' && (
            <Button size="sm" variant="ghost" onPress={load} isDisabled={status === 'loading'}>
              <Icon icon="solar:refresh-linear" className="size-4" />
              {intl.formatMessage({ id: 'aiDigest.regenerate', defaultMessage: 'Regenerate' })}
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Content>
        {status === 'idle' && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-muted">
              {intl.formatMessage({ id: 'aiDigest.idle', defaultMessage: 'Generate a fresh morning digest with the latest warehouse health, approvals, and stock status.' })}
            </p>
            <Button size="sm" variant="primary" onPress={load}>
              <Icon icon="solar:sparkles-linear" className="size-4" />
              {intl.formatMessage({ id: 'aiDigest.generate', defaultMessage: 'Generate digest' })}
            </Button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted">
            <Spinner size="sm" />
            {intl.formatMessage({ id: 'aiDigest.loading', defaultMessage: 'Preparing your digest...' })}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-danger">{error}</p>
            <Button size="sm" variant="ghost" onPress={load}>
              {intl.formatMessage({ id: 'aiDigest.regenerate', defaultMessage: 'Regenerate' })}
            </Button>
          </div>
        )}

        {status === 'success' && <DigestMarkdown text={digest} />}
      </Card.Content>
    </Card>
  );
}