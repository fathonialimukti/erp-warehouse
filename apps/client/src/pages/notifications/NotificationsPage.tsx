import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Pagination,
  SearchField,
  Select,
  Spinner,
  Table,
  ListBox,
  toast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";
import { getPaginationItems } from "../../lib/pagination";
import { PageTitle } from "../../components/PageTitle";

type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  targetType: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: Date | string;
  user: { id: string; name: string | null; email: string };
  createdBy: { id: string; name: string | null; email: string } | null;
}

const TYPE_COLOR_MAP: Record<
  string,
  "accent" | "success" | "warning" | "danger" | "default"
> = {
  INFO: "accent",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "danger",
};

type ModalState =
  | { stage: "idle" }
  | { stage: "confirm-delete"; id: string }
  | { stage: "broadcast" }
  | { stage: "loading" };

function NotificationsPage() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canDelete = hasPermission("notification@delete");
  const canBroadcast = hasPermission("notification@broadcast");

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<NotificationType | "">("");
  const [filterIsRead, setFilterIsRead] = useState<"" | "true" | "false">("");
  const [modal, setModal] = useState<ModalState>({ stage: "idle" });

  // Broadcast form state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("");
  const [broadcastType, setBroadcastType] = useState<NotificationType>("INFO");
  const [broadcastSendToAll, setBroadcastSendToAll] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryKey = [
    "notifications.admin",
    pagination.pageIndex,
    pagination.pageSize,
    search,
    filterType,
    filterIsRead,
  ];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      trpcClient.notification.listAll.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        type: filterType || undefined,
        isRead: filterIsRead !== "" ? filterIsRead === "true" : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.notification.deleteById.mutate({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["notifications.admin"],
      });
      setModal({ stage: "idle" });
      toast.success(
        intl.formatMessage({
          id: "notification.admin.delete_success",
          defaultMessage: "Notification deleted.",
        }),
      );
    },
    onError: () => {
      setModal({ stage: "idle" });
      toast.danger(
        intl.formatMessage({
          id: "notification.admin.delete_error",
          defaultMessage: "Failed to delete notification.",
        }),
      );
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => trpcClient.notification.resend.mutate({ id }),
    onSuccess: () => {
      toast.success(
        intl.formatMessage({
          id: "notification.admin.resend_success",
          defaultMessage: "Push notification resent.",
        }),
      );
    },
    onError: () => {
      toast.danger(
        intl.formatMessage({
          id: "notification.admin.resend_error",
          defaultMessage: "Failed to resend notification.",
        }),
      );
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      trpcClient.notification.broadcast.mutate({
        sendToAll: broadcastSendToAll,
        userIds: [],
        title: broadcastTitle,
        message: broadcastMessage,
        link: broadcastLink || undefined,
        type: broadcastType,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["notifications.admin"],
      });
      setModal({ stage: "idle" });
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastLink("");
      toast.success(
        intl.formatMessage(
          {
            id: "notification.admin.broadcast_success",
            defaultMessage: "Sent to {count} user(s).",
          },
          { count: result.count },
        ),
      );
    },
    onError: () => {
      setModal({ stage: "idle" });
      toast.danger(
        intl.formatMessage({
          id: "notification.admin.broadcast_error",
          defaultMessage: "Broadcast failed.",
        }),
      );
    },
  });

  const columns = useMemo<ColumnDef<AdminNotification>[]>(
    () => [
      {
        accessorKey: "type",
        header: intl.formatMessage({
          id: "notification.admin.header_type",
          defaultMessage: "Type",
        }),
        cell: ({ getValue }) => (
          <Chip
            color={TYPE_COLOR_MAP[getValue<string>()] ?? "default"}
            size="sm"
            variant="soft"
          >
            {getValue<string>()}
          </Chip>
        ),
      },
      {
        accessorKey: "targetType",
        header: intl.formatMessage({
          id: "notification.admin.header_target",
          defaultMessage: "Target",
        }),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "title",
        header: intl.formatMessage({
          id: "notification.admin.header_title",
          defaultMessage: "Title",
        }),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {row.original.title}
            </span>
            <span className="line-clamp-1 text-xs text-muted">
              {row.original.message}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "user",
        header: intl.formatMessage({
          id: "notification.admin.header_recipient",
          defaultMessage: "Recipient",
        }),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">
              {row.original.user.name ?? "—"}
            </span>
            <span className="text-xs text-muted">
              {row.original.user.email}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "createdBy",
        header: intl.formatMessage({
          id: "notification.admin.header_causer",
          defaultMessage: "Sent by",
        }),
        cell: ({ row }) =>
          row.original.createdBy ? (
            <span className="text-sm text-foreground">
              {row.original.createdBy.name ?? row.original.createdBy.email}
            </span>
          ) : (
            <span className="text-xs text-muted">System</span>
          ),
      },
      {
        accessorKey: "isRead",
        header: intl.formatMessage({
          id: "notification.admin.header_read",
          defaultMessage: "Read",
        }),
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Chip color="success" size="sm" variant="soft">
              {intl.formatMessage({
                id: "notification.admin.read",
                defaultMessage: "Read",
              })}
            </Chip>
          ) : (
            <Chip color="default" size="sm" variant="soft">
              {intl.formatMessage({
                id: "notification.admin.unread",
                defaultMessage: "Unread",
              })}
            </Chip>
          ),
      },
      {
        accessorKey: "createdAt",
        header: intl.formatMessage({
          id: "notification.admin.header_date",
          defaultMessage: "Date",
        }),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted">
            {new Date(getValue<string>()).toLocaleString("id-ID")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={intl.formatMessage({
              id: "notification.admin.row_actions",
              defaultMessage: "Notification actions",
            })}
          >
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => resendMutation.mutate(row.original.id)}
              aria-label={intl.formatMessage({
                id: "notification.admin.action_resend",
                defaultMessage: "Resend push",
              })}
            >
              <Icon icon="solar:send-linear" className="size-4" />
            </Button>
            {canDelete && (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() =>
                  setModal({ stage: "confirm-delete", id: row.original.id })
                }
                aria-label={intl.formatMessage({
                  id: "notification.admin.action_delete",
                  defaultMessage: "Delete",
                })}
              >
                <Icon
                  icon="solar:trash-bin-trash-linear"
                  className="size-4 text-danger"
                />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [intl, canDelete, resendMutation],
  );

  const rows = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const totalEntries = data?.pagination?.total ?? 0;
  const currentPage = pagination.pageIndex + 1;
  const pageStart =
    totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + rows.length - 1;

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: { pagination },
    onPaginationChange: setPagination,
  });

  return (
    <div
      className="flex flex-col gap-6"
      data-ai-context={JSON.stringify({
        section: "notification-list",
        canBroadcast,
        canDelete,
        filters: {
          search: searchInput,
          type: filterType || "all",
          isRead:
            filterIsRead === ""
              ? "all"
              : filterIsRead === "true"
                ? "read"
                : "unread",
        },
        visibleColumns: [
          "type",
          "targetType",
          "title",
          "user",
          "createdBy",
          "isRead",
          "createdAt",
        ],
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <PageTitle
                title={intl.formatMessage({
                  id: "notification.admin.title",
                  defaultMessage: "Notifications",
                })}
              />
              <Card.Title>
                {intl.formatMessage({
                  id: "notification.admin.title",
                  defaultMessage: "Notifications",
                })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: "notification.admin.description",
                  defaultMessage: "View and manage all system notifications.",
                })}
              </Card.Description>
            </div>
            {canBroadcast && (
              <Button
                variant="primary"
                onPress={() => setModal({ stage: "broadcast" })}
              >
                <Icon icon="mdi:send" className="size-4" />
                {intl.formatMessage({
                  id: "notification.admin.broadcast_button",
                  defaultMessage: "Broadcast",
                })}
              </Button>
            )}
          </div>
        </Card.Header>
      </Card>

      <Card>
        <Card.Content>
          <div className="flex flex-wrap items-center gap-3 pb-4">
            <SearchField
              variant="secondary"
              fullWidth
              id="notification-search"
              value={searchInput}
              onChange={setSearchInput}
              aria-label={intl.formatMessage({
                id: "notification.admin.search_placeholder",
                defaultMessage: "Search title or message…",
              })}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={intl.formatMessage({
                    id: "notification.admin.search_placeholder",
                    defaultMessage: "Search title or message…",
                  })}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <Select
              value={filterType}
              onChange={(k) =>
                setFilterType(k as string as NotificationType | "")
              }
              aria-label={intl.formatMessage({
                id: "notification.admin.filter_type",
                defaultMessage: "Filter by type",
              })}
              placeholder={intl.formatMessage({
                id: "notification.admin.filter_type",
                defaultMessage: "All types",
              })}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="" textValue="All types">
                    <Label>All types</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {(["INFO", "SUCCESS", "WARNING", "ERROR"] as const).map(
                    (t) => (
                      <ListBox.Item key={t} id={t} textValue={t}>
                        <Label>{t}</Label>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ),
                  )}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              value={filterIsRead}
              onChange={(k) =>
                setFilterIsRead(k as string as "" | "true" | "false")
              }
              aria-label={intl.formatMessage({
                id: "notification.admin.filter_read",
                defaultMessage: "Filter by read status",
              })}
              placeholder={intl.formatMessage({
                id: "notification.admin.filter_read",
                defaultMessage: "All statuses",
              })}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="" textValue="All statuses">
                    <Label>All statuses</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="false" textValue="Unread">
                    <Label>Unread</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="true" textValue="Read">
                    <Label>Read</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
              <Icon
                icon="solar:bell-off-linear"
                className="size-8 text-muted"
              />
              <span className="text-sm text-muted">
                {intl.formatMessage({
                  id: "notification.admin.empty_state",
                  defaultMessage: "No notifications found",
                })}
              </span>
            </div>
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Notifications">
                  <Table.Header>
                    {table
                      .getHeaderGroups()
                      .map((hg) =>
                        hg.headers.map((h) => (
                          <Table.Column key={h.id}>
                            {h.isPlaceholder
                              ? null
                              : flexRender(
                                  h.column.columnDef.header,
                                  h.getContext(),
                                )}
                          </Table.Column>
                        )),
                      )}
                  </Table.Header>
                  <Table.Body>
                    {table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="w-full pt-4">
              <Pagination className="w-full">
                <Pagination.Summary>
                  {pageStart} to {pageEnd} of {totalEntries} results
                </Pagination.Summary>
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      isDisabled={pagination.pageIndex === 0}
                      onPress={() =>
                        setPagination((prev) => ({
                          ...prev,
                          pageIndex: prev.pageIndex - 1,
                        }))
                      }
                    >
                      <Pagination.PreviousIcon />
                    </Pagination.Previous>
                  </Pagination.Item>
                  {getPaginationItems(currentPage, totalPages).map(
                    (item, index) =>
                      item === "ellipsis" ? (
                        <Pagination.Item key={`ellipsis-${index}`}>
                          <Pagination.Ellipsis />
                        </Pagination.Item>
                      ) : (
                        <Pagination.Item key={item}>
                          <Pagination.Link
                            isActive={item === currentPage}
                            onPress={() =>
                              setPagination((prev) => ({
                                ...prev,
                                pageIndex: item - 1,
                              }))
                            }
                          >
                            {item}
                          </Pagination.Link>
                        </Pagination.Item>
                      ),
                  )}
                  <Pagination.Item>
                    <Pagination.Next
                      isDisabled={pagination.pageIndex + 1 >= totalPages}
                      onPress={() =>
                        setPagination((prev) => ({
                          ...prev,
                          pageIndex: prev.pageIndex + 1,
                        }))
                      }
                    >
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* ── Unified action modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={modal.stage !== "idle"}
        onOpenChange={() => setModal({ stage: "idle" })}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              {modal.stage === "loading" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>
                      {intl.formatMessage({
                        id: "common.modal.processing",
                        defaultMessage: "Processing…",
                      })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="flex justify-center py-6">
                      <Spinner />
                    </div>
                  </Modal.Body>
                </>
              )}

              {modal.stage === "confirm-delete" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>
                      {intl.formatMessage({
                        id: "notification.admin.delete_title",
                        defaultMessage: "Delete Notification",
                      })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">
                      {intl.formatMessage({
                        id: "notification.admin.delete_body",
                        defaultMessage:
                          "Are you sure you want to delete this notification? This action cannot be undone.",
                      })}
                    </p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="ghost"
                      onPress={() => setModal({ stage: "idle" })}
                    >
                      {intl.formatMessage({
                        id: "common.action.cancel",
                        defaultMessage: "Cancel",
                      })}
                    </Button>
                    <Button
                      variant="danger"
                      onPress={() => {
                        if (modal.stage !== "confirm-delete") return;
                        setModal({ stage: "loading" });
                        deleteMutation.mutate(modal.id);
                      }}
                    >
                      {intl.formatMessage({
                        id: "common.action.delete",
                        defaultMessage: "Delete",
                      })}
                    </Button>
                  </Modal.Footer>
                </>
              )}

              {modal.stage === "broadcast" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>
                      {intl.formatMessage({
                        id: "notification.admin.broadcast_title",
                        defaultMessage: "Broadcast Notification",
                      })}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="flex flex-col gap-4">
                      <Input
                        variant="secondary"
                        placeholder={intl.formatMessage({
                          id: "notification.admin.broadcast_field_title",
                          defaultMessage: "Title",
                        })}
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                      />
                      <Input
                        variant="secondary"
                        placeholder={intl.formatMessage({
                          id: "notification.admin.broadcast_field_message",
                          defaultMessage: "Message",
                        })}
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                      />
                      <Input
                        variant="secondary"
                        placeholder={intl.formatMessage({
                          id: "notification.admin.broadcast_field_link",
                          defaultMessage: "Link (optional)",
                        })}
                        value={broadcastLink}
                        onChange={(e) => setBroadcastLink(e.target.value)}
                      />
                      <Select
                        variant="secondary"
                        value={broadcastType}
                        onChange={(k) =>
                          setBroadcastType(k as NotificationType)
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {(
                              ["INFO", "SUCCESS", "WARNING", "ERROR"] as const
                            ).map((t) => (
                              <ListBox.Item key={t} id={t} textValue={t}>
                                <Label>{t}</Label>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sendToAll"
                          checked={broadcastSendToAll}
                          onChange={(e) =>
                            setBroadcastSendToAll(e.target.checked)
                          }
                        />
                        <label
                          htmlFor="sendToAll"
                          className="text-sm text-foreground"
                        >
                          {intl.formatMessage({
                            id: "notification.admin.broadcast_send_to_all",
                            defaultMessage: "Send to all users",
                          })}
                        </label>
                      </div>
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="ghost"
                      onPress={() => setModal({ stage: "idle" })}
                    >
                      {intl.formatMessage({
                        id: "common.action.cancel",
                        defaultMessage: "Cancel",
                      })}
                    </Button>
                    <Button
                      variant="primary"
                      isDisabled={
                        !broadcastTitle.trim() || !broadcastMessage.trim()
                      }
                      onPress={() => {
                        setModal({ stage: "loading" });
                        broadcastMutation.mutate();
                      }}
                    >
                      {intl.formatMessage({
                        id: "notification.admin.broadcast_send",
                        defaultMessage: "Send",
                      })}
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export { NotificationsPage };
