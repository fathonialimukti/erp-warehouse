import { useMemo, useState } from "react";
import { Avatar, Button, Chip, EmptyState, Modal } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useIntl } from "react-intl";

type ApprovalHistoryEntry = {
  message: string | null;
  process: string;
  userName: string;
  timeframe: string;
};

type TimelineTone = {
  chipColor: "default" | "accent" | "success" | "warning" | "danger";
  avatarColor: "default" | "accent" | "success" | "warning" | "danger";
  dotClass: string;
  label: string;
};

interface ApprovalHistoryButtonProps {
  approvalHistory?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseApprovalHistory = (value: unknown): ApprovalHistoryEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const process =
      typeof entry.process === "string" && entry.process.trim().length > 0
        ? entry.process.trim().toUpperCase()
        : "UNKNOWN";
    const userName =
      typeof entry.userName === "string" && entry.userName.trim().length > 0
        ? entry.userName.trim()
        : "Unknown user";
    const timeframe =
      typeof entry.timeframe === "string" && entry.timeframe.trim().length > 0
        ? entry.timeframe.trim()
        : "Unknown time";
    const message =
      typeof entry.message === "string" && entry.message.trim().length > 0
        ? entry.message.trim()
        : null;

    return [{ message, process, userName, timeframe }];
  });
};

const getTimelineTone = (process: string): TimelineTone => {
  switch (process) {
    case "APPROVED":
      return {
        chipColor: "success",
        avatarColor: "success",
        dotClass: "bg-success",
        label: "Approved",
      };
    case "REJECTED":
      return {
        chipColor: "danger",
        avatarColor: "danger",
        dotClass: "bg-danger",
        label: "Rejected",
      };
    case "PROPOSED":
      return {
        chipColor: "warning",
        avatarColor: "warning",
        dotClass: "bg-warning",
        label: "Proposed",
      };
    case "DRAFT":
      return {
        chipColor: "default",
        avatarColor: "default",
        dotClass: "bg-default-400",
        label: "Draft",
      };
    default:
      return {
        chipColor: "accent",
        avatarColor: "accent",
        dotClass: "bg-accent",
        label: process,
      };
  }
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * ApprovalHistory
 *
 * A self-contained trigger button + modal that renders the timeline of approval
 * actions for a transaction. The trigger shows the latest action's tone and the
 * total entry count; the modal renders a rich vertical timeline with avatar
 * markers, status chips, timestamps, and optional messages.
 *
 * Props are intentionally loose (`approvalHistory?: unknown`) so any transaction
 * detail page can drop it in without shape coupling.
 */
export const ApprovalHistory = ({
  approvalHistory,
}: ApprovalHistoryButtonProps) => {
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

      // Most recent first
      return bTime - aTime;
    });
  }, [approvalHistory]);

  const latestEntry = entries[0];
  const latestTone = latestEntry ? getTimelineTone(latestEntry.process) : null;
  const hasEntries = entries.length > 0;

  const formatTimelineDate = (timeframe: string) => {
    if (!timeframe) {
      return intl.formatMessage({
        id: "inbound_transaction.history_time_unknown",
        defaultMessage: "Unknown time",
      });
    }

    const parsedDate = new Date(timeframe);
    if (Number.isNaN(parsedDate.getTime())) {
      return intl.formatMessage({
        id: "inbound_transaction.history_time_unknown",
        defaultMessage: "Unknown time",
      });
    }

    return intl.formatDate(parsedDate, {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    });
  };

  const openLabel = intl.formatMessage({
    id: "inbound_transaction.history_open",
    defaultMessage: "Approval History",
  });

  const countLabel = intl.formatMessage(
    {
      id: "inbound_transaction.history_count",
      defaultMessage:
        "{count, plural, =0 {No entries} one {# entry} other {# entries}}",
    },
    { count: entries.length },
  );

  return (
    <>
      <Button variant="ghost" onPress={() => setIsOpen(true)}>
        <Icon icon="solar:history-line-duotone" className="size-4" />
        <span>{openLabel}</span>
        {hasEntries && latestTone ? (
          <span
            className={`inline-flex h-2 w-2 rounded-full ${latestTone.dotClass}`}
            aria-hidden="true"
          />
        ) : null}
        <Chip
          size="sm"
          variant="soft"
          color={hasEntries ? (latestTone?.chipColor ?? "default") : "default"}
        >
          {entries.length}
        </Chip>
      </Button>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container size="md" scroll="outside">
            <Modal.Dialog>
              <Modal.CloseTrigger />

              <Modal.Header>
                <Modal.Icon>
                  <Icon
                    icon="solar:clipboard-check-line-duotone"
                    className="size-5"
                  />
                </Modal.Icon>
                <Modal.Heading>
                  {intl.formatMessage({
                    id: "inbound_transaction.history_title",
                    defaultMessage: "Approval History",
                  })}
                </Modal.Heading>
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    hasEntries
                      ? (latestTone?.chipColor ?? "default")
                      : "default"
                  }
                >
                  {countLabel}
                </Chip>
              </Modal.Header>

              <Modal.Body>
                <p className="text-sm text-muted">
                  {intl.formatMessage({
                    id: "inbound_transaction.history_description",
                    defaultMessage:
                      "Timeline of approval actions for this transaction.",
                  })}
                </p>

                {hasEntries ? (
                  <ol className="relative mt-4 space-y-5 border-l border-default-200 pl-6">
                    {entries.map((entry, index) => {
                      const tone = getTimelineTone(entry.process);
                      const isLatest = index === 0;

                      return (
                        <li
                          key={`${entry.timeframe}-${entry.process}-${String(index)}`}
                          className="relative"
                        >
                          {/* Marker */}
                          <span
                            className={`absolute -left-7.75 top-1 flex size-5 items-center justify-center rounded-full ring-4 ring-background ${tone.dotClass}`}
                            aria-hidden="true"
                          >
                            <span className="size-1.5 rounded-full bg-background" />
                          </span>

                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip
                                size="sm"
                                variant="soft"
                                color={tone.chipColor}
                              >
                                {tone.label}
                              </Chip>
                              {isLatest ? (
                                <Chip
                                  size="sm"
                                  variant="tertiary"
                                  color="accent"
                                >
                                  {intl.formatMessage({
                                    id: "inbound_transaction.history_latest",
                                    defaultMessage: "Latest",
                                  })}
                                </Chip>
                              ) : null}
                              <span className="text-xs text-muted">
                                {formatTimelineDate(entry.timeframe)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <Avatar
                                size="sm"
                                variant="soft"
                                color={tone.avatarColor}
                              >
                                <Avatar.Fallback>
                                  {getInitials(entry.userName)}
                                </Avatar.Fallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">
                                  {entry.userName}
                                </span>
                                <span className="text-xs text-muted">
                                  {entry.message ??
                                    intl.formatMessage({
                                      id: "inbound_transaction.history_message_empty",
                                      defaultMessage: "No message provided.",
                                    })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-12 text-center">
                    <Icon
                      icon="solar:clipboard-linear"
                      className="size-8 text-muted"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        {intl.formatMessage({
                          id: "inbound_transaction.history_empty_title",
                          defaultMessage: "No approval history yet",
                        })}
                      </span>
                      <span className="text-sm text-muted">
                        {intl.formatMessage({
                          id: "inbound_transaction.history_empty",
                          defaultMessage:
                            "Approval actions will appear here once the transaction is submitted or reviewed.",
                        })}
                      </span>
                    </div>
                  </EmptyState>
                )}
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" onPress={() => setIsOpen(false)}>
                  {intl.formatMessage({
                    id: "inbound_transaction.action_close",
                    defaultMessage: "Close",
                  })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
};
