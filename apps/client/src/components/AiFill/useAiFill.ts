import { useAtomValue, useSetAtom } from 'jotai';
import { useState, useEffect } from 'react';
import { collectPageContext } from './pageContext';
import { aiFormFillAtom, authUserAtom } from '../../lib/atoms';
import { requestAiFillFields } from './aiStream';

export type AiFillStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAiFillResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  instruction: string;
  setInstruction: (instruction: string) => void;
  submit: () => void;
  status: AiFillStatus;
  error: string | null;
}

/**
 * State + submit logic for the AI Fill bar.
 *
 * On submit, sends a one-shot AI fill request via the existing chat endpoint
 * (`requestAiFillFields`), then writes the returned fields to `aiFormFillAtom`
 * so the page's `useAiFillForm` applies them. The chat widget is never opened.
 */
export const useAiFill = (): UseAiFillResult => {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<AiFillStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const user = useAtomValue(authUserAtom);
  const setFormFill = useSetAtom(aiFormFillAtom);

  const submit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || status === 'loading') return;

    setStatus('loading');
    setError(null);

    const chatId = user?.id ? `ai-fill-${user.id}` : 'ai-fill-anon';

    void requestAiFillFields({
      instruction: trimmed,
      pageContext: collectPageContext(),
      chatId,
    })
      .then((fields) => {
        setFormFill(fields);
        setStatus('success');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'AI Fill failed. Please try again.');
        setStatus('error');
      });
  };

  // Close modal 1.2s after success (user sees the green chip, then it auto-dismisses)
  useEffect(() => {
    if (status !== 'success') return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setStatus('idle');
      setInstruction('');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [status, setOpen]);

  return { open, setOpen, instruction, setInstruction, submit, status, error };
};
