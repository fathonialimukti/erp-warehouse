import { useMemo, useState } from 'react';
import { Button, EmptyState, Modal } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';

type ApprovalHistoryEntry = {
  message: string | null;
  process: string;
  userName: string;
  timeframe: string;
};

type TimelineTone = {
  badgeClass: string;
  dotClass: string;
};

interface ApprovalHistoryButtonProps {
  approvalHistory?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseApprovalHistory = (value: unknown): ApprovalHistoryEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const process = typeof entry.process === 'string' && entry.process.trim().length > 0
      ? entry.process.trim().toUpperCase()
      : 'UNKNOWN';
    const userName = typeof entry.userName === 'string' && entry.userName.trim().length > 0
      ? entry.userName.trim()
      : 'Unknown user';
    const timeframe = typeof entry.timeframe === 'string' ? entry.timeframe : '';
    const message = typeof entry.message === 'string' && entry.message.trim().length > 0
      ? entry.message.trim()
      : null;

    return [{ message, process, userName, timeframe }];
  });
};

const getTimelineTone = (process: string): TimelineTone => {
  switch (process) {
    case 'APPROVED':
      return { badgeClass: 'bg-success/15 text-success', dotClass: 'bg-success' };
    case 'REJECTED':
      return { badgeClass: 'bg-danger/15 text-danger', dotClass: 'bg-danger' };
    case 'PROPOSED':
      return { badgeClass: 'bg-warning/20 text-warning', dotClass: 'bg-warning' };
    default:
      return { badgeClass: 'bg-default-200 text-default-700', dotClass: 'bg-default-500' };
  }
};

export const ApprovalHistory = ({ approvalHistory }: ApprovalHistoryButtonProps) => {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const entries = useMemo(() => {
    const parsed = parseApprovalHistory(approvalHistory);

    return [...parsed].sort((a, b) => {
      const aTime = new Date(a.timeframe).getTime();
      const bTime = new Date(b.timeframe).getTime();

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return 0;
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
        return -1;
      }

      return aTime - bTime;
    });
  }, [approvalHistory]);

  const formatTimelineDate = (timeframe: string) => {
    if (!timeframe) {
      return intl.formatMessage({ id: 'inbound_transaction.history_time_unknown', defaultMessage: 'Unknown time' });
    }

    const parsedDate = new Date(timeframe);
    if (Number.isNaN(parsedDate.getTime())) {
      return intl.formatMessage({ id: 'inbound_transaction.history_time_unknown', defaultMessage: 'Unknown time' });
    }

    return intl.formatDate(parsedDate, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: false,
    });
  };

  return (
    <>
      <Button variant="ghost" onPress={() => setIsOpen(true)}>
        <Icon icon="solar:history-line-duotone" className="size-4" />
        {intl.formatMessage({ id: 'inbound_transaction.history_open', defaultMessage: 'approval history' })}
      </Button>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container size="lg" scroll="outside">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  {intl.formatMessage({ id: 'inbound_transaction.history_title', defaultMessage: 'Approval History' })}
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body>
                <p className="text-sm text-muted">
                  {intl.formatMessage({ id: 'inbound_transaction.history_description', defaultMessage: 'Timeline of approval actions for this transaction.' })}
                </p>

                {entries.length > 0 ? (
                  <ol className="mt-6 space-y-6 border-l-2 border-slate-200/70 pl-6">
                    {entries.map((entry, index) => {
                      const tone = getTimelineTone(entry.process);

                      return (
                        <li key={`${entry.timeframe}-${entry.process}-${String(index)}`}>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badgeClass}`}>
                                {entry.process}
                              </span>
                              <span className="text-xs text-muted">{formatTimelineDate(entry.timeframe)}</span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{entry.userName}</p>
                            <p className="text-sm text-muted">
                              {entry.message ?? intl.formatMessage({ id: 'inbound_transaction.history_message_empty', defaultMessage: '-' })}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <EmptyState>
                    {intl.formatMessage({ id: 'inbound_transaction.history_empty', defaultMessage: 'No approval history yet.' })}
                  </EmptyState>
                )}
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" onPress={() => setIsOpen(false)}>
                  {intl.formatMessage({ id: 'inbound_transaction.action_close', defaultMessage: 'Close' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
};