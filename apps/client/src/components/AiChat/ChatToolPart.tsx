import { Icon } from "@iconify/react";
import { useIntl } from "react-intl";
import { ChatFormCard, type ChatFormSpec } from "./ChatFormCard";
import { ApprovalCard } from "./ApprovalCard";
import { ToolResultTable } from "./ToolResultTable";

export type ChatToolMeta = Record<string, { icon: string; label: string }>;

type ChatToolPartProps = {
  part: Record<string, unknown> & { type: string };
  toolMeta?: ChatToolMeta;
  addToolOutput: (o: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => void;
  addToolApprovalResponse: (o: { id: string; approved: boolean }) => void;
};

/** Extract tabular rows from a tool output (JSON string or object). */
const extractRows = (output: unknown): Record<string, unknown>[] => {
  try {
    const parsed =
      typeof output === "string" ? (JSON.parse(output) as unknown) : output;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
      if (
        obj.submitted === true &&
        obj.values &&
        typeof obj.values === "object"
      ) {
        return [obj.values as Record<string, unknown>];
      }
    }
  } catch {
    /* not JSON — no table */
  }
  return [];
};

/** Renders ONE tool message part: form card, approval card, result table, or chip. */
export const ChatToolPart = ({
  part,
  toolMeta,
  addToolOutput,
  addToolApprovalResponse,
}: ChatToolPartProps) => {
  const intl = useIntl();
  const toolName =
    part.type === "dynamic-tool"
      ? String(part.toolName)
      : part.type.slice("tool-".length);
  const state = String(part.state ?? "");
  const meta = toolMeta?.[toolName] ?? {
    icon: "solar:bolt-circle-linear",
    label: toolName,
  };
  const toolCallId = String(part.toolCallId ?? "");

  const chip = (
    label: string,
    tone: "default" | "success" | "danger" | "warning",
  ) => (
    <div key={toolCallId} className="flex items-center gap-1.5">
      <Icon icon={meta.icon} width={12} />
      <span
        className={`text-xs font-medium ${
          tone === "success"
            ? "text-success"
            : tone === "danger"
              ? "text-danger"
              : tone === "warning"
                ? "text-warning"
                : "text-default-500"
        }`}
      >
        {label}
      </span>
    </div>
  );

  // ── Form-in-chat (client-side tool requestFormInput) ──
  if (toolName === "requestFormInput") {
    if (state === "input-streaming")
      return chip(
        `${intl.formatMessage({ id: "ai_chat.form.preparing", defaultMessage: "Preparing form" })}…`,
        "warning",
      );
    if (state === "input-available") {
      return (
        <ChatFormCard
          spec={part.input as ChatFormSpec}
          onSubmit={(values) =>
            addToolOutput({
              tool: "requestFormInput",
              toolCallId,
              output: { submitted: true, values },
            })
          }
          onCancel={() =>
            addToolOutput({
              tool: "requestFormInput",
              toolCallId,
              output: { submitted: false },
            })
          }
        />
      );
    }
    if (state === "output-available") {
      const out = part.output as
        { submitted?: boolean; values?: Record<string, unknown> } | undefined;
      const submitted = out?.submitted === true;
      return (
        <div key={toolCallId} className="space-y-1">
          {chip(
            submitted
              ? intl.formatMessage({
                  id: "ai_chat.form.answered",
                  defaultMessage: "✓ Form answered",
                })
              : intl.formatMessage({
                  id: "ai_chat.form.cancelled",
                  defaultMessage: "Form cancelled",
                }),
            submitted ? "success" : "default",
          )}
          {submitted && out?.values && <ToolResultTable rows={[out.values]} />}
        </div>
      );
    }
    return chip(meta.label, "default");
  }

  // ── Approval gate (AI SDK v6 needsApproval) ──
  // `approval` carries only `{ id }` in ai@6.0.x — requestReason/isAutomatic don't exist.
  if (state === "approval-requested") {
    const approval = part.approval as { id?: string } | undefined;
    if (!approval?.id) return chip(`${meta.label}…`, "warning");
    const reason =
      toolName === "executeSql"
        ? intl.formatMessage({
            id: "ai_chat.approval.reason_write_sql",
            defaultMessage:
              "Write query — review the exact SQL before approving",
          })
        : toolName.startsWith("draft_")
          ? intl.formatMessage({
              id: "ai_chat.approval.reason_draft",
              defaultMessage:
                "Creates a draft transaction — review the details before approving",
            })
          : intl.formatMessage({
              id: "ai_chat.approval.reason_generic",
              defaultMessage: "Review before approving",
            });
    const input = part.input as Record<string, unknown> | undefined;
    const preview =
      typeof input?.sql === "string"
        ? String(input.sql)
        : JSON.stringify(input ?? {}, null, 2);
    return (
      <ApprovalCard
        title={meta.label}
        reason={reason}
        inputPreview={preview}
        danger
        onApprove={() =>
          addToolApprovalResponse({ id: approval.id as string, approved: true })
        }
        onDeny={() =>
          addToolApprovalResponse({
            id: approval.id as string,
            approved: false,
          })
        }
      />
    );
  }
  if (state === "output-denied") {
    return chip(
      intl.formatMessage({
        id: "ai_chat.tool.denied",
        defaultMessage: "✗ Denied by user",
      }),
      "danger",
    );
  }

  // ── Outputs with tabular data ──
  if (state === "output-available") {
    const rows = extractRows(part.output);
    return (
      <div key={toolCallId} className="space-y-1">
        {chip(`✓ ${meta.label}`, "success")}
        {rows.length > 0 && <ToolResultTable rows={rows} />}
      </div>
    );
  }
  if (state === "output-error") return chip(`✗ ${meta.label}`, "danger");
  if (state === "input-streaming") return chip(`${meta.label}…`, "warning");
  return chip(meta.label, "default");
};
