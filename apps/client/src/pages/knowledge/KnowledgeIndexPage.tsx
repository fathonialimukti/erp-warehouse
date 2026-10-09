import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { useIntl } from "react-intl";
import {
  Button,
  Card,
  Chip,
  Dropdown,
  Modal,
  SearchField,
} from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { type ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermissionAtom } from "../../lib/atoms";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { useListPage } from "../../lib/useListPage";
import { trpcClient } from "../../lib/trpc";

type KnowledgeDocument = {
  id: string;
  slug: string;
  title: string;
  isActive: boolean;
  chunkCount: number;
  updatedAt: string;
};

function KnowledgeIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission("knowledge@create");
  const canUpdate = hasPermission("knowledge@update");
  const canDelete = hasPermission("knowledge@delete");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<KnowledgeDocument | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<ColumnDef<KnowledgeDocument>[]>(
    () => [
      {
        accessorKey: "title",
        header: intl.formatMessage({
          id: "knowledge.index.header_title",
          defaultMessage: "Title",
        }),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.original.title}
            </p>
            <p className="font-mono text-xs text-muted">{row.original.slug}</p>
          </div>
        ),
      },
      {
        accessorKey: "slug",
        header: intl.formatMessage({
          id: "knowledge.index.header_slug",
          defaultMessage: "Slug",
        }),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-primary">
            {row.original.slug}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: intl.formatMessage({
          id: "knowledge.index.header_active",
          defaultMessage: "Active",
        }),
        cell: ({ row }) => (
          <Chip
            size="sm"
            variant="soft"
            color={row.original.isActive ? "success" : "default"}
          >
            {row.original.isActive
              ? intl.formatMessage({
                  id: "knowledge.index.active_yes",
                  defaultMessage: "Active",
                })
              : intl.formatMessage({
                  id: "knowledge.index.active_no",
                  defaultMessage: "Inactive",
                })}
          </Chip>
        ),
      },
      {
        accessorKey: "chunkCount",
        header: intl.formatMessage({
          id: "knowledge.index.header_chunk_count",
          defaultMessage: "Chunks",
        }),
        cell: ({ row }) => row.original.chunkCount,
      },
      {
        accessorKey: "updatedAt",
        header: intl.formatMessage({
          id: "knowledge.index.header_updated",
          defaultMessage: "Updated",
        }),
        cell: ({ row }) =>
          new Date(row.original.updatedAt).toLocaleDateString("id-ID"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Dropdown>
            <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
              <AppIcon name="menu-dots" className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Knowledge actions">
                <Dropdown.Item
                  key="view"
                  onPress={() => navigate(`/knowledge/${row.original.id}`)}
                >
                  <AppIcon name="eye" className="size-4" />
                  {intl.formatMessage({
                    id: "knowledge.index.action_view",
                    defaultMessage: "View details",
                  })}
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item
                    key="edit"
                    onPress={() =>
                      navigate(`/knowledge/${row.original.id}/edit`)
                    }
                  >
                    <AppIcon name="pen" className="size-4" />
                    {intl.formatMessage({
                      id: "knowledge.index.action_edit",
                      defaultMessage: "Edit document",
                    })}
                  </Dropdown.Item>
                ) : null}
                {canDelete ? (
                  <Dropdown.Item
                    key="delete"
                    variant="danger"
                    onPress={() => {
                      setDocToDelete(row.original);
                      setDeleteModalOpen(true);
                    }}
                  >
                    <AppIcon name="trash" className="size-4" />
                    {intl.formatMessage({
                      id: "knowledge.index.action_delete",
                      defaultMessage: "Delete document",
                    })}
                  </Dropdown.Item>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [intl, navigate, canUpdate, canDelete],
  );

  const list = useListPage<KnowledgeDocument>({
    queryKey: ["knowledgeList"],
    queryFn: (input) =>
      trpcClient.knowledge.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
      }),
    columns,
  });

  const handleDelete = async () => {
    if (!docToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      await trpcClient.knowledge.delete.mutate({ id: docToDelete.id });
      await queryClient.invalidateQueries({ queryKey: ["knowledgeList"] });
      queryClient.removeQueries({
        queryKey: ["knowledgeDetail", docToDelete.id],
      });
      setDeleteModalOpen(false);
      setDocToDelete(null);
    } catch (error) {
      console.error(error);
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "knowledge-list",
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows:
          list.query.data?.data.map((d) => ({
            id: d.id,
            title: d.title,
            slug: d.slug,
          })) ?? [],
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <PageTitle
                title={intl.formatMessage({
                  id: "knowledge.index.title",
                  defaultMessage: "Knowledge Base",
                })}
              />
              <h1 className="text-2xl font-semibold text-foreground">
                {intl.formatMessage({
                  id: "knowledge.index.title",
                  defaultMessage: "Knowledge Base",
                })}
              </h1>
              <Card.Description>
                {intl.formatMessage({
                  id: "knowledge.index.description",
                  defaultMessage:
                    "Manage RAG knowledge documents used by the AI assistant.",
                })}
              </Card.Description>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="knowledge-search"
                  value={list.searchInput}
                  onChange={list.setSearchInput}
                  aria-label={intl.formatMessage({
                    id: "knowledge.index.search_placeholder",
                    defaultMessage: "Search title or slug",
                  })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                      placeholder={intl.formatMessage({
                        id: "knowledge.index.search_placeholder",
                        defaultMessage: "Search title or slug",
                      })}
                    />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              {canCreate ? (
                <Button
                  variant="primary"
                  onPress={() => navigate("/knowledge/new")}
                >
                  <AppIcon name="plus" className="size-4" />
                  {intl.formatMessage({
                    id: "knowledge.index.create_button",
                    defaultMessage: "Add Document",
                  })}
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <DataTable<KnowledgeDocument>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            error={
              list.query.isError
                ? {
                    message: intl.formatMessage({
                      id: "knowledge.index.error_load",
                      defaultMessage: "Failed to load knowledge documents.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "book-bookmark",
              message: intl.formatMessage({
                id: "knowledge.index.empty_state",
                defaultMessage: "No knowledge documents available.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "knowledge.index.loading",
              defaultMessage: "Loading knowledge documents...",
            })}
            ariaLabel="Knowledge table"
            rowHeaderId="title"
            onRowAction={(id) => navigate(`/knowledge/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {intl.formatMessage({
                    id: "knowledge.index.delete_modal_title",
                    defaultMessage: "Delete Document",
                  })}
                </Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage(
                    {
                      id: "knowledge.index.delete_confirm_body",
                      defaultMessage:
                        'Are you sure you want to delete "{title}"? Indexed chunks will also be removed.',
                    },
                    { title: docToDelete?.title },
                  )}
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {intl.formatMessage({
                    id: "common.action.cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => void handleDelete()}
                  isDisabled={isDeleting}
                >
                  {isDeleting
                    ? intl.formatMessage({
                        id: "knowledge.index.deleting",
                        defaultMessage: "Deleting...",
                      })
                    : intl.formatMessage({
                        id: "common.action.delete",
                        defaultMessage: "Delete",
                      })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { KnowledgeIndexPage };
