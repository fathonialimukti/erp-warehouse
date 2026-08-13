import { Button, Chip, Spinner, TextArea } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useAiFill } from './useAiFill';

/**
 * AI Fill bar — a row of two buttons rendered BELOW the page header.
 *
 * - `[AI Assistant]` is a decorative gimmick: it never opens the chat widget
 *   and does nothing on press.
 * - `[AI Fill]` toggles a collapsible panel with a textarea + submit. On
 *   submit, the form is prefilled via `aiFormFillAtom` (the chat widget stays
 *   closed).
 */
export function AiFillBar() {
  const intl = useIntl();
  const { open, setOpen, instruction, setInstruction, submit, status, error } = useAiFill();

  const isLoading = status === 'loading';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          isDisabled
          aria-label={intl.formatMessage({ id: 'aiFill.assistant', defaultMessage: 'AI Assistant' })}
        >
          <Icon icon="solar:magic-stick-3-bold" width={16} />
          {intl.formatMessage({ id: 'aiFill.assistant', defaultMessage: 'AI Assistant' })}
        </Button>
        <Button
          variant="secondary"
          onPress={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={intl.formatMessage({ id: 'aiFill.fill', defaultMessage: 'AI Fill' })}
        >
          <Icon icon="solar:pen-2-linear" width={16} />
          {intl.formatMessage({ id: 'aiFill.fill', defaultMessage: 'AI Fill' })}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-4">
          <TextArea
            aria-label={intl.formatMessage({ id: 'aiFill.placeholder', defaultMessage: 'please help me fill this form with ...' })}
            placeholder={intl.formatMessage({ id: 'aiFill.placeholder', defaultMessage: 'please help me fill this form with ...' })}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            disabled={isLoading}
            rows={3}
            fullWidth
          />

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onPress={submit}
              isDisabled={isLoading || !instruction.trim()}
            >
              {intl.formatMessage({ id: 'aiFill.submit', defaultMessage: 'Submit' })}
            </Button>

            {isLoading && (
              <span className="flex items-center gap-2 text-sm text-muted">
                <Spinner size="sm" color="accent" />
                {intl.formatMessage({ id: 'aiFill.loading', defaultMessage: 'Filling form...' })}
              </span>
            )}

            {status === 'success' && (
              <Chip size="sm" variant="soft" color="success">
                <Icon icon="solar:check-circle-bold" width={14} />
                {intl.formatMessage({ id: 'aiFill.success', defaultMessage: 'Form prefilled — please review before saving.' })}
              </Chip>
            )}

            {status === 'error' && (
              <Chip size="sm" variant="soft" color="danger">
                <Icon icon="solar:close-circle-bold" width={14} />
                {error ?? intl.formatMessage({ id: 'aiFill.error', defaultMessage: 'AI Fill failed. Please try again.' })}
              </Chip>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
