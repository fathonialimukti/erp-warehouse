import { Icon } from "@iconify/react";
import { Button } from "@heroui/react";
import { useIntl } from "react-intl";

type ApprovalCardProps = {
  title: string;
  reason?: string;
  inputPreview: string;
  danger?: boolean;
  onApprove: () => void;
  onDeny: () => void;
};

/** Chat card shown when a tool pauses for user approval (AI SDK v6 `needsApproval`). */
export const ApprovalCard = ({
  title,
  reason,
  inputPreview,
  danger = false,
  onApprove,
  onDeny,
}: ApprovalCardProps) => {
  const intl = useIntl();
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 my-1 ${danger ? "border-warning/40 bg-warning-50" : "border-default-200 bg-default-100"}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          icon="solar:shield-warning-bold"
          width={14}
          className={danger ? "text-warning" : "text-primary"}
        />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      {reason && <p className="text-xs text-default-500 mt-1">{reason}</p>}
      <pre className="bg-black/10 rounded p-2 my-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
        {inputPreview}
      </pre>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" onPress={onDeny}>
          {intl.formatMessage({
            id: "ai_chat.approval.deny",
            defaultMessage: "Deny",
          })}
        </Button>
        <Button size="sm" variant="primary" onPress={onApprove}>
          {intl.formatMessage({
            id: "ai_chat.approval.approve",
            defaultMessage: "Approve",
          })}
        </Button>
      </div>
    </div>
  );
};
