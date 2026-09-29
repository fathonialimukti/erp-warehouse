import { type ReactNode } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { Button, Card, Chip, EmptyState, Spinner, Table } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { trpcClient } from "../../lib/trpc";

type JsonRecord = Record<string, unknown>;

type ActivityLogDetail = {
  id: string;
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "APPROVE"
    | "REJECT"
    | "LOGIN"
    | "LOGOUT"
    | "EXPORT"
    | "IMPORT";
  resource: string;
  resourceId: string;
  message: string;
  detail: unknown;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    photo?: string | null;
  };
};

const ACTION_COLOR_MAP: Record<
  ActivityLogDetail["action"],
  "accent" | "default" | "warning" | "danger" | "success"
> = {
  CREATE: "success",
  UPDATE: "accent",
  DELETE: "danger",
  APPROVE: "success",
  REJECT: "danger",
  LOGIN: "default",
  LOGOUT: "warning",
  EXPORT: "accent",
  IMPORT: "default",
};

// Maps an activity-log resource name to its detail-route path prefix.
// Only resources that have a client detail page are listed; others render as plain text.
const RESOURCE_DETAIL_PREFIX: Record<string, string> = {
  user: "users",
  product: "products",
  sku: "skus",
  supplier: "suppliers",
  warehouse: "warehouse",
  pallet: "pallets",
  subinventory_transfer: "subinventory-transfer",
  receiving_transaction: "inbound-transaction/receiving",
  found_transaction: "inbound-transaction/found",
  rma_receipt: "inbound-transaction/rma-receipt",
  wip_completion: "inbound-transaction/wip-completion",
  disposal: "outbound-transaction/disposal",
  shipment: "outbound-transaction/shipment",
  return_to_supplier: "outbound-transaction/return-to-supplier",
  loss_transaction: "outbound-transaction/loss",
  wip_issue: "outbound-transaction/wip-issue",
};

function resourceDetailPath(resource: string, id: string): string | null {
  const prefix = RESOURCE_DETAIL_PREFIX[resource];
  if (!prefix || !id) return null;
  return `/${prefix}/${id}`;
}

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prettify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <div
        className={
          mono
            ? "break-all font-mono text-sm text-foreground"
            : "text-sm text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function PayloadPanel({
  title,
  description,
  content,
}: {
  title: string;
  description: string;
  content: ReactNode;
}) {
  return (
    <Card variant="secondary" className="h-full">
      <Card.Header>
        <Card.Title className="text-base">{title}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content>{content}</Card.Content>
    </Card>
  );
}

function renderValueList(values: unknown[] = []) {
  if (!values.length) {
    return <p className="text-sm text-muted">No values.</p>;
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
      {values.map((item, index) => (
        <li key={index}>{String(item)}</li>
      ))}
    </ul>
  );
}

function isAddRemovePayload(
  value: unknown,
): value is { add?: unknown[]; remove?: unknown[] } {
  return (
    isPlainObject(value) &&
    (Array.isArray((value as any).add) || Array.isArray((value as any).remove))
  );
}

function SimpleObjectTable({ data }: { data: JsonRecord }) {
  const entries = Object.entries(data);

  if (!entries.length) {
    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-8 text-center">
        <Icon icon="solar:document-text-linear" className="size-6 text-muted" />
        <span className="text-sm text-muted">No data available.</span>
      </EmptyState>
    );
  }

  return (
    <Table variant="primary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Activity log detail object table"
          className="min-w-full"
        >
          <Table.Header>
            <Table.Column isRowHeader>Field</Table.Column>
            <Table.Column>Value</Table.Column>
          </Table.Header>
          <Table.Body>
            {entries.map(([key, value]) => (
              <Table.Row key={key} id={key}>
                <Table.Cell className="align-top font-medium text-foreground/80">
                  {formatLabel(key)}
                </Table.Cell>
                <Table.Cell>
                  {isPlainObject(value) || Array.isArray(value) ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
                      {prettify(value)}
                    </pre>
                  ) : (
                    <span className="text-sm text-foreground">
                      {String(value ?? "-")}
                    </span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function DetailPayload({
  action,
  detail,
  intl,
}: {
  action: string;
  detail: unknown;
  intl: IntlShape;
}) {
  if (detail == null) {
    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
        <Icon icon="solar:shield-check-linear" className="size-6 text-muted" />
        <span className="text-sm text-muted">
          {intl.formatMessage({
            id: "activitylog_detail_nodetails",
            defaultMessage: "No details available.",
          })}
        </span>
      </EmptyState>
    );
  }

  if (isAddRemovePayload(detail)) {
    const addValues = detail.add ?? [];
    const removeValues = detail.remove ?? [];

    if (action === "UPDATE") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <PayloadPanel
            title={intl.formatMessage({
              id: "activitylog_addtitle",
              defaultMessage: "Added",
            })}
            description={intl.formatMessage({
              id: "activitylog_adddescription",
              defaultMessage: "Items added during this operation.",
            })}
            content={renderValueList(addValues)}
          />
          <PayloadPanel
            title={intl.formatMessage({
              id: "activitylog_removetitle",
              defaultMessage: "Removed",
            })}
            description={intl.formatMessage({
              id: "activitylog_removedescription",
              defaultMessage: "Items removed during this operation.",
            })}
            content={renderValueList(removeValues)}
          />
        </div>
      );
    }

    if (addValues.length > 0) {
      return (
        <PayloadPanel
          title={intl.formatMessage({
            id: "activitylog_addtitle",
            defaultMessage: "Added",
          })}
          description={intl.formatMessage({
            id: "activitylog_adddescription",
            defaultMessage: "Items added during this operation.",
          })}
          content={renderValueList(addValues)}
        />
      );
    }

    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
        <Icon icon="solar:document-text-linear" className="size-6 text-muted" />
        <span className="text-sm text-muted">
          {intl.formatMessage({
            id: "activitylog_detail_nodetails",
            defaultMessage: "No details available.",
          })}
        </span>
      </EmptyState>
    );
  }

  if (action === "UPDATE" && isPlainObject(detail)) {
    const oldData = detail.before;
    const newData = detail.after;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <PayloadPanel
          title={intl.formatMessage({
            id: "activitylog_beforetitle",
            defaultMessage: "Before (old)",
          })}
          description={intl.formatMessage({
            id: "activitylog_beforedescription",
            defaultMessage: "Snapshot data before the change was applied.",
          })}
          content={
            isPlainObject(oldData) ? (
              <SimpleObjectTable data={oldData} />
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
                {prettify(oldData)}
              </pre>
            )
          }
        />

        <PayloadPanel
          title={intl.formatMessage({
            id: "activitylog_aftertitle",
            defaultMessage: "After (new)",
          })}
          description={intl.formatMessage({
            id: "activitylog_afterdescription",
            defaultMessage:
              "Snapshot data after the change was successfully saved.",
          })}
          content={
            isPlainObject(newData) ? (
              <SimpleObjectTable data={newData} />
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
                {prettify(newData)}
              </pre>
            )
          }
        />
      </div>
    );
  }

  if ((action === "CREATE" || action === "DELETE") && isPlainObject(detail)) {
    const createData = detail.data;
    const deleteLatest = detail.latest;

    if (isPlainObject(createData)) {
      return <SimpleObjectTable data={createData} />;
    }

    if (isPlainObject(deleteLatest)) {
      return <SimpleObjectTable data={deleteLatest} />;
    }

    return <SimpleObjectTable data={detail} />;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
      {prettify(detail)}
    </pre>
  );
}

function LinkedId({
  id,
  path,
  icon,
}: {
  id: string;
  path: string;
  icon: string;
}) {
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-auto justify-start gap-1 px-0 font-mono text-sm normal-case text-primary"
      onPress={() => navigate(path)}
    >
      <Icon icon={icon} className="size-4 shrink-0" />
      <span className="break-all">{id}</span>
    </Button>
  );
}

function ActivityLogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: queryData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["activityLogDetail", id],
    queryFn: () => trpcClient.activityLog.detail.query({ id: id ?? "" }),
    enabled: Boolean(id),
  });
  const data = queryData as ActivityLogDetail | undefined;

  const createdAtValue = data?.createdAt ? new Date(data.createdAt) : null;
  const createdAt = createdAtValue ? createdAtValue.toLocaleString() : "-";
  const createdAtDate = createdAtValue
    ? createdAtValue.toLocaleDateString()
    : "-";
  const createdAtTime = createdAtValue
    ? createdAtValue.toLocaleTimeString()
    : "-";

  const detailPayload: unknown = data?.detail as unknown;

  const intl = useIntl();

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "activity-log-detail",
        id: data?.id,
        action: data?.action,
        resource: data?.resource,
        resourceId: data?.resourceId,
        user: data
          ? { id: data.user.id, name: data.user.name, email: data.user.email }
          : undefined,
        message: data?.message,
      })}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-default-200 bg-default-50 px-4 py-6 text-sm text-muted">
          <Spinner size="sm" />
          {intl.formatMessage({
            id: "activitylog_loading",
            defaultMessage: "Loading activity log details...",
          })}
        </div>
      ) : null}

      {isError ? (
        <Card
          variant="transparent"
          className="border border-danger-soft-hover bg-danger/5"
        >
          <Card.Content className="flex items-center gap-3 py-5 text-danger-600">
            <Icon icon="solar:danger-triangle-linear" className="size-5" />
            <p className="text-sm">
              {error?.message ??
                intl.formatMessage({
                  id: "activitylog_errorload",
                  defaultMessage: "Failed to load activity log details.",
                })}
            </p>
          </Card.Content>
        </Card>
      ) : null}

      {!isLoading && !isError && !data ? (
        <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center">
          <Icon icon="solar:file-search-linear" className="size-8 text-muted" />
          <span className="text-sm text-muted">
            {intl.formatMessage({
              id: "activitylog_notfound",
              defaultMessage: "Activity log record not found.",
            })}
          </span>
        </EmptyState>
      ) : null}

      {!isLoading && !isError && data ? (
        <>
          <PageHeader
            title={intl.formatMessage({
              id: "activitylog_detail_page_title",
              defaultMessage: "Activity Log Detail",
            })}
            onBack={() => navigate("/activity-logs")}
          />

          <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.09)_0%,rgba(14,116,144,0.04)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.2)_0%,rgba(14,116,144,0.08)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7">
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              {data.user.photo ? (
                <img
                  src={data.user.photo}
                  alt={
                    data.user.name ??
                    intl.formatMessage({
                      id: "activitylog_unknownactor",
                      defaultMessage: "Unknown actor",
                    })
                  }
                  className="h-72 w-full rounded-[1.25rem] border border-border/50 object-cover"
                />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-[1.25rem] border border-border/50 bg-surface/70">
                  <Icon
                    icon="mdi:account"
                    className="size-18 text-foreground/80"
                  />
                </div>
              )}

              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    {intl.formatMessage({
                      id: "activitylog_audittraildetail",
                      defaultMessage: "Audit Trail Detail",
                    })}
                  </p>
                  <p className="font-mono text-sm text-foreground">{data.id}</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    {data.user.name ??
                      intl.formatMessage({
                        id: "activitylog_unknownactor",
                        defaultMessage: "Unknown actor",
                      })}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted">
                    {data.message}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      color={ACTION_COLOR_MAP[data.action]}
                      size="sm"
                      variant="soft"
                    >
                      {data.action}
                    </Chip>
                    <Chip color="default" size="sm" variant="soft">
                      {data.resource}
                    </Chip>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DetailField
                    label={intl.formatMessage({
                      id: "activitylog_fielddate",
                      defaultMessage: "Date",
                    })}
                    value={createdAtDate}
                  />
                  <DetailField
                    label={intl.formatMessage({
                      id: "activitylog_fieldtime",
                      defaultMessage: "Time",
                    })}
                    value={createdAtTime}
                  />
                  <DetailField
                    label={intl.formatMessage({
                      id: "activitylog_fieldactor",
                      defaultMessage: "Actor",
                    })}
                    value={
                      data.user.name ??
                      intl.formatMessage({
                        id: "activitylog_unknownactorshort",
                        defaultMessage: "Unknown",
                      })
                    }
                  />
                  <DetailField
                    label={intl.formatMessage({
                      id: "activitylog_fieldtargetresource",
                      defaultMessage: "Target Resource",
                    })}
                    value={data.resourceId}
                    mono
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-8">
            <Card>
              <Card.Header>
                <Card.Title className="text-base">
                  {intl.formatMessage({
                    id: "activitylog_snapshottitle",
                    defaultMessage: "Operational Snapshot",
                  })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({
                    id: "activitylog_snapshotdescription",
                    defaultMessage:
                      "Core summary for reading log context before entering the JSON payload.",
                  })}
                </Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label={intl.formatMessage({
                    id: "activitylog_fieldusername",
                    defaultMessage: "User Name",
                  })}
                  value={
                    data.user.name ??
                    intl.formatMessage({
                      id: "activitylog_unknownactorshort",
                      defaultMessage: "Unknown",
                    })
                  }
                />
                <DetailField
                  label="User ID"
                  value={
                    <LinkedId
                      id={data.user.id}
                      path={`/users/${data.user.id}`}
                      icon="solar:user-linear"
                    />
                  }
                />
                <DetailField
                  label={intl.formatMessage({
                    id: "activitylog_fieldresourcename",
                    defaultMessage: "Resource Name",
                  })}
                  value={data.resource}
                />
                <DetailField
                  label="Resource ID"
                  value={
                    resourceDetailPath(data.resource, data.resourceId) ? (
                      <LinkedId
                        id={data.resourceId}
                        path={resourceDetailPath(
                          data.resource,
                          data.resourceId,
                        )!}
                        icon="solar:link-linear"
                      />
                    ) : (
                      data.resourceId
                    )
                  }
                />
                <DetailField
                  label={intl.formatMessage({
                    id: "activitylog_fieldtimestamp",
                    defaultMessage: "Timestamp",
                  })}
                  value={createdAt}
                  mono
                />
                <DetailField
                  label={intl.formatMessage({
                    id: "activitylog_fieldmessage",
                    defaultMessage: "Message",
                  })}
                  value={data.message}
                />
              </Card.Content>
            </Card>
          </div>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">
                {intl.formatMessage({
                  id: "activitylog_detailtitle",
                  defaultMessage: "Detail",
                })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: "activitylog_detaildescription",
                  defaultMessage:
                    "Raw payload or the recorded change results for this activity.",
                })}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <DetailPayload
                action={data.action}
                detail={detailPayload}
                intl={intl}
              />
            </Card.Content>
          </Card>
        </>
      ) : null}
    </section>
  );
}

export { ActivityLogDetailPage };
