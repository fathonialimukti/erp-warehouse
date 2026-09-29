import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  Button,
  Card,
  Dropdown,
  Modal,
  SearchField,
  Separator,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { type ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { EntityPhoto } from "../../components/EntityPhoto";
import { hasPermissionAtom } from "../../lib/atoms";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { useListPage } from "../../lib/useListPage";
import { trpcClient } from "../../lib/trpc";
type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  address: string;
  photo: string | null;
  totalCapacity: number | null;
  createdAt: string;
  updatedAt: string;
  objectId: string | null;
};

function WarehouseIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission("warehouse@create");
  const canUpdate = hasPermission("warehouse@update");
  const canDelete = hasPermission("warehouse@delete");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      {
        accessorKey: "code",
        header: intl.formatMessage({
          id: "warehouse.index.header_warehouse_code",
          defaultMessage: "Warehouse Code",
        }),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-primary">
            {row.original.code ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: intl.formatMessage({
          id: "warehouse.index.header_warehouse_name",
          defaultMessage: "Warehouse Name",
        }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.photo} alt={row.original.name} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {row.original.name}
              </p>
              <p className="text-xs text-muted">{row.original.address}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "address",
        header: intl.formatMessage({
          id: "warehouse.index.header_address",
          defaultMessage: "Address",
        }),
      },
      {
        accessorKey: "totalCapacity",
        header: intl.formatMessage({
          id: "warehouse.index.header_capacity",
          defaultMessage: "Total Capacity",
        }),
        cell: ({ row }) =>
          row.original.totalCapacity?.toLocaleString("id-ID") ?? "-",
      },
      {
        accessorKey: "createdAt",
        header: "Dibuat",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString("id-ID"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Dropdown>
            <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
              <Icon icon="solar:menu-dots-bold" className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Warehouse actions">
                <Dropdown.Item
                  key="view"
                  onPress={() => navigate(`/warehouse/${row.original.id}`)}
                >
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({
                    id: "warehouse.index.action_view",
                    defaultMessage: "View details",
                  })}
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item
                    key="edit"
                    className="text-warning"
                    onPress={() =>
                      navigate(`/warehouse/${row.original.id}/edit`)
                    }
                  >
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({
                      id: "warehouse.index.action_edit",
                      defaultMessage: "Edit warehouse",
                    })}
                  </Dropdown.Item>
                ) : null}
                {canDelete ? (
                  <>
                    <Separator />
                    <Dropdown.Item
                      key="delete"
                      variant="danger"
                      className="text-danger"
                      onPress={() => {
                        setWarehouseToDelete(row.original);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Icon
                        icon="solar:trash-bin-trash-linear"
                        className="size-4"
                      />
                      {intl.formatMessage({
                        id: "warehouse.index.action_delete",
                        defaultMessage: "Delete warehouse",
                      })}
                    </Dropdown.Item>
                  </>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [intl, navigate],
  );

  const list = useListPage<Warehouse>({
    queryKey: ["warehouseList"],
    queryFn: (input) =>
      trpcClient.warehouse.warehouse.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
      }),
    columns,
  });

  const handleDelete = async () => {
    if (!warehouseToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await trpcClient.warehouse.warehouse.delete.mutate({
        id: warehouseToDelete.id,
      });
      await queryClient.invalidateQueries({ queryKey: ["warehouseList"] });
      queryClient.removeQueries({
        queryKey: ["warehouseDetail", warehouseToDelete.id],
      });
      queryClient.removeQueries({
        queryKey: ["warehouseLokasi", warehouseToDelete.id],
      });
      setDeleteModalOpen(false);
      setWarehouseToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "warehouse-list",
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows:
          list.query.data?.data.map((w) => ({
            id: w.id,
            name: w.name,
            address: w.address,
          })) ?? [],
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <PageTitle
                title={intl.formatMessage({
                  id: "warehouse.index.title",
                  defaultMessage: "Warehouses",
                })}
              />
              <h1 className="text-2xl font-semibold text-foreground">
                {intl.formatMessage({
                  id: "warehouse.index.title",
                  defaultMessage: "Warehouses",
                })}
              </h1>
              <Card.Description>
                {intl.formatMessage({
                  id: "warehouse.index.description",
                  defaultMessage:
                    "Manage warehouses and view storage location tables on the detail page.",
                })}
              </Card.Description>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="warehouse-search"
                  value={list.searchInput}
                  onChange={list.setSearchInput}
                  aria-label={intl.formatMessage({
                    id: "warehouse.index.search_placeholder",
                    defaultMessage: "Search warehouse name or address",
                  })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                      placeholder={intl.formatMessage({
                        id: "warehouse.index.search_placeholder",
                        defaultMessage: "Search warehouse name or address",
                      })}
                    />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              {canCreate ? (
                <Button
                  variant="primary"
                  onPress={() => navigate("/warehouse/new")}
                >
                  <Icon
                    icon="material-symbols:add-2-rounded"
                    className="size-4"
                  />
                  {intl.formatMessage({
                    id: "warehouse.index.create_button",
                    defaultMessage: "Create Warehouse",
                  })}
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <DataTable<Warehouse>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            error={
              list.query.isError
                ? {
                    message: intl.formatMessage({
                      id: "warehouse.index.error_load",
                      defaultMessage: "Failed to load warehouse data.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "solar:buildings-2-linear",
              message: intl.formatMessage({
                id: "warehouse.index.empty_state",
                defaultMessage: "No warehouses available.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "warehouse.index.loading",
              defaultMessage: "Loading warehouse data...",
            })}
            ariaLabel="Warehouse table"
            rowHeaderId="name"
            onRowAction={(id) => navigate(`/warehouse/${id}`)}
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
                    id: "warehouse.index.delete_modal_title",
                    defaultMessage: "Delete Warehouse",
                  })}
                </Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage(
                    {
                      id: "warehouse.index.delete_modal_body",
                      defaultMessage:
                        'Are you sure you want to delete warehouse "{warehouseName}"? This action cannot be undone.',
                    },
                    { warehouseName: warehouseToDelete?.name },
                  )}
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {intl.formatMessage({
                    id: "warehouse.index.cancel",
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
                        id: "warehouse.index.deleting",
                        defaultMessage: "Deleting...",
                      })
                    : intl.formatMessage({
                        id: "warehouse.index.delete",
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

export { WarehouseIndexPage };
