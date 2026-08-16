import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useAiFill } from './useAiFill';

/**
 * AI Fill toggle button — designed to be rendered inside PageHeader's
 * `<ButtonGroup>` as a child. Toggles the collapsible `<AiFillPanel />`.
 */
export function AiFillButton() {
  const intl = useIntl();
  const { open, setOpen } = useAiFill();

  return (
    <Button
      variant="tertiary"
      onPress={() => setOpen(!open)}
      aria-expanded={open}
      aria-label={intl.formatMessage({ id: 'aiFill.fill', defaultMessage: 'AI Fill' })}
      className="text-accent"
    >
      <Icon icon="solar:pen-2-linear" width={16} />
      <span className="hidden md:block">
        {intl.formatMessage({ id: 'aiFill.fill', defaultMessage: 'AI Fill' })}
      </span>
    </Button>
  );
}
