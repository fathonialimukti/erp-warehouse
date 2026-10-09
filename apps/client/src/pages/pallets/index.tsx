import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Card, Chip, SearchField, Tabs } from "@heroui/react";
import { type ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { trpcClient } from "../../lib/trpc";
import { EntityPhoto } from "../../components/EntityPhoto";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { useListPage } from "../../lib/useListPage";

type PalletRow = {
  id: string;
  palletNumber?: string | null;
  status: "AVAILABLE" | "NOT_AVAILABLE";
  sku?: {
    id: string;
    name: string;
    code?: string | null;
    photo?: string | null;
  } | null;
  storageLocation?: {
    id: string;
    warehouse?: { id: string; name: string } | null;
  } | null;
  sourceType?: string | null;
  createdAt: string;
};

function PalletIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "AVAILABLE" | "NOT_AVAILABLE"
  >("ALL");

  const columns = useMemo<ColumnDef<PalletRow>[]>(
    () => [
      {
        accessorKey: "palletNumber",
        header: intl.formatMessage({
          id: "pallet.index.header_number",
          defaultMessage: "Pallet No.",
        }),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {row.original.palletNumber ?? row.original.id}
          </span>
        ),
      },
      {
        id: "sku",
        header: intl.formatMessage({
          id: "pallet.index.header_sku",
          defaultMessage: "SKU",
        }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto
              src={row.original.sku?.photo}
              alt={row.original.sku?.name ?? ""}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {row.original.sku?.name ?? "-"}
              </p>
              {row.original.sku?.code && (
                <p className="text-xs text-muted">{row.original.sku.code}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: intl.formatMessage({
          id: "pallet.index.header_status",
          defaultMessage: "Status",
        }),
        cell: ({ row }) => (
          <Chip
            color={row.original.status === "AVAILABLE" ? "success" : "warning"}
            size="sm"
            variant="soft"
          >
            {row.original.status}
          </Chip>
        ),
      },
      {
        id: "location",
        header: intl.formatMessage({
          id: "pallet.index.header_location",
          defaultMessage: "Location",
        }),
        cell: ({ row }) => {
          const loc = row.original.storageLocation;
          return (
            <div>
              <p className="text-sm font-mono">{loc?.id ?? "-"}</p>
              {loc?.warehouse?.name && (
                <p className="text-xs text-muted">{loc.warehouse.name}</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: intl.formatMessage({
          id: "pallet.index.header_created",
          defaultMessage: "Created",
        }),
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString("id-ID"),
      },
    ],
    [intl],
  );

  const list = useListPage<PalletRow>({
    queryKey: ["palletList"],
    queryFn: (input) =>
      trpcClient.warehouse.pallet.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      }),
    columns,
    resetDeps: [statusFilter],
  });

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "pallet-index",
        statusFilter,
        page: list.currentPage,
        pageSize: list.table.getState().pagination.pageSize,
        searchQuery: list.search,
        totalItems: list.totalEntries,
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4">
            <div>
              <PageTitle
                title={intl.formatMessage({
                  id: "pallet.index.title",
                  defaultMessage: "Pallets",
                })}
              />
              <h1 className="text-2xl font-semibold text-foreground">
                {intl.formatMessage({
                  id: "pallet.index.title",
                  defaultMessage: "Pallets",
                })}
              </h1>
              <Card.Description>
                {intl.formatMessage({
                  id: "pallet.index.description",
                  defaultMessage:
                    "View all pallets across warehouses. Pallets are the atomic inventory unit created when inbound transactions are approved.",
                })}
              </Card.Description>
            </div>

            <Tabs
              selectedKey={statusFilter}
              onSelectionChange={(key) =>
                setStatusFilter(key as typeof statusFilter)
              }
            >
              <Tabs.List>
                <Tabs.Tab id="ALL">
                  {intl.formatMessage({
                    id: "pallet.index.tab_all",
                    defaultMessage: "All",
                  })}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="AVAILABLE">
                  {intl.formatMessage({
                    id: "pallet.index.tab_available",
                    defaultMessage: "Available",
                  })}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="NOT_AVAILABLE">
                  {intl.formatMessage({
                    id: "pallet.index.tab_not_available",
                    defaultMessage: "Not Available",
                  })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  value={list.searchInput}
                  onChange={list.setSearchInput}
                  aria-label={intl.formatMessage({
                    id: "pallet.index.search_placeholder",
                    defaultMessage: "Search pallet number",
                  })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                      placeholder={intl.formatMessage({
                        id: "pallet.index.search_placeholder",
                        defaultMessage: "Search pallet number",
                      })}
                    />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <DataTable<PalletRow>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            error={
              list.query.isError
                ? {
                    message: intl.formatMessage({
                      id: "pallet.index.error_load",
                      defaultMessage: "Failed to load pallets.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "palette",
              message: intl.formatMessage({
                id: "pallet.index.empty_state",
                defaultMessage: "No pallets found.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "pallet.index.loading",
              defaultMessage: "Loading pallets...",
            })}
            ariaLabel="Pallets table"
            rowHeaderId="id"
            onRowAction={(id) => navigate(`/pallets/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>
    </section>
  );
}

export { PalletIndexPage };
