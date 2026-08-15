import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAtomValue } from 'jotai';
import { authUserAtom } from '../../lib/atoms';
import { requestTextReply } from '../../lib/aiOneShot';

type Status = 'idle' | 'loading' | 'success' | 'error';

const DIGEST_PROMPT =
  'Generate a short morning digest for a warehouse manager. ' +
  'Use get_approval_queue, get_anomalies, and get_warehouse_insights to cover: ' +
  'pending approvals, putaway/dispatch backlog, out-of-stock SKUs, dead stock value, and anything urgent. ' +
  'Answer in 5-7 short bullet lines in plain business language. ' +
  'If a tool fails or returns nothing, skip that item gracefully.';

function DigestLines({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
          <Icon icon="solar:point-linear" className="mt-1 size-3 shrink-0 text-primary" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function AiDigestCard() {
  const intl = useIntl();
  const user = useAtomValue(authUserAtom);
  const [status, setStatus] = useState<Status>('idle');
  const [digest, setDigest] = useState('');
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
        if (!reply) setError('AI returned an empty digest');
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : 'AI Digest failed');
        setStatus('error');
      });
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

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
          <Button size="sm" variant="ghost" onPress={load} isDisabled={status === 'loading'}>
            <Icon icon="solar:refresh-linear" className="size-4" />
            {intl.formatMessage({ id: 'aiDigest.regenerate', defaultMessage: 'Regenerate' })}
          </Button>
        </div>
      </Card.Header>
      <Card.Content>
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

        {status === 'success' && <DigestLines text={digest} />}
      </Card.Content>
    </Card>
  );
}