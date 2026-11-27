import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";
import {
  Button,
  Card,
  EmptyState,
  Pagination,
  SearchField,
  Spinner,
  Table,
} from "@heroui/react";
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "../../components/AppIcon";
import { PageTitle } from "../../components/PageTitle";
import { hasPermissionAtom } from "../../lib/atoms";
import { getPaginationItems } from "../../lib/pagination";
import { trpcClient } from "../../lib/trpc";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  createdAt: string;
}

const MESSAGE_PREVIEW_LENGTH = 140;

/** Inline expander so long messages stay scannable without losing content. */
function MessageCell({ message }: { message: string }) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > MESSAGE_PREVIEW_LENGTH;
  const preview = expanded
    ? message
    : `${message.slice(0, MESSAGE_PREVIEW_LENGTH)}…`;

  return (
    <div className="flex max-w-md flex-col items-start gap-1">
      <span className="text-sm whitespace-pre-wrap text-foreground/80">
        {isLong ? preview : message}
      </span>
      {isLong && (
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? intl.formatMessage({
                id: "contact_submissions.show_less",
                defaultMessage: "Show less",
              })
            : intl.formatMessage({
                id: "contact_submissions.read_more",
                defaultMessage: "Read more",
              })}
        </button>
      )}
    </div>
  );
}

function ContactSubmissionsIndexPage() {
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission("landing@read");

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce search input before it reaches the query (matches activity logs).
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "contactSubmissions",
      pagination.pageIndex,
      pagination.pageSize,
      search,
    ],
    queryFn: () =>
      trpcClient.landing.listContactSubmissions.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
    enabled: canRead,
  });

  const submissions = (data?.data as ContactSubmission[] | undefined) ?? [];

  const columns = useMemo<ColumnDef<ContactSubmission>[]>(
    () => [
      {
        accessorKey: "name",
        header: intl.formatMessage({
          id: "contact_submissions.column_name",
          defaultMessage: "Name",
        }),
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-foreground">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: intl.formatMessage({
          id: "contact_submissions.column_email",
          defaultMessage: "Email",
        }),
        cell: ({ getValue }) => {
          const email = getValue<string>();
          return (
            <a
              href={`mailto:${email}`}
              className="text-sm text-accent hover:underline"
            >
              {email}
            </a>
          );
        },
      },
      {
        accessorKey: "company",
        header: intl.formatMessage({
          id: "contact_submissions.column_company",
          defaultMessage: "Company",
        }),
        cell: ({ getValue }) => {
          const company = getValue<string | null>();
          return (
            <span
              className={
                company ? "text-sm text-foreground" : "text-sm text-muted"
              }
            >
              {company ?? "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "message",
        header: intl.formatMessage({
          id: "contact_submissions.column_message",
          defaultMessage: "Message",
        }),
        cell: ({ getValue }) => <MessageCell message={getValue<string>()} />,
      },
      {
        accessorKey: "createdAt",
        header: intl.formatMessage({
          id: "contact_submissions.column_received",
          defaultMessage: "Received",
        }),
        cell: ({ getValue }) => {
          const date = new Date(getValue<string>());
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {date.toLocaleDateString()}
              </span>
              <span className="text-xs text-muted">
                {date.toLocaleTimeString()}
              </span>
            </div>
          );
        },
      },
    ],
    [intl],
  );

  const table = useReactTable({
    data: submissions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.pagination.totalPages ?? 0,
    state: {
      pagination,
    },
  });

  const totalEntries = data?.pagination.total ?? 0;
  const totalPages = Math.max(data?.pagination.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart =
    totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd =
    totalEntries === 0 ? 0 : pageStart + (data?.data.length ?? 0) - 1;

  if (!canRead) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">
            {intl.formatMessage({
              id: "contact_submissions.permission_denied",
              defaultMessage:
                "You do not have permission to view contact inquiries.",
            })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "contact-submissions-list",
        totalRecords: totalEntries,
        currentPage,
        totalPages,
        visibleRows: submissions.map((submission) => ({
          id: submission.id,
          name: submission.name,
          email: submission.email,
        })),
      })}
    >
      <Card>
        <Card.Header className="flex items-start justify-between gap-3">
          <div>
            <PageTitle
              title={intl.formatMessage({
                id: "contact_submissions.index.title",
                defaultMessage: "Contact Inquiries",
              })}
            />
            <Card.Title className="text-2xl">
              {intl.formatMessage({
                id: "contact_submissions.index.title",
                defaultMessage: "Contact Inquiries",
              })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({
                id: "contact_submissions.index.description",
                defaultMessage:
                  "Messages submitted through the public contact form.",
              })}
            </Card.Description>
          </div>
          <div className="w-80">
            <SearchField
              variant="secondary"
              fullWidth
              id="contact-submissions-search"
              value={searchInput}
              onChange={setSearchInput}
              aria-label={intl.formatMessage({
                id: "contact_submissions.index.search_placeholder",
                defaultMessage: "Search inquiries (name, email)",
              })}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={intl.formatMessage({
                    id: "contact_submissions.index.search_placeholder",
                    defaultMessage: "Search inquiries (name, email)",
                  })}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Contact inquiries table"
                className="min-w-full"
              >
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column
                        key={header.id}
                        isRowHeader={header.id === "name"}
                      >
                        <span className="font-semibold">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </span>
                      </Table.Column>
                    )),
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <AppIcon name="inbox" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {intl.formatMessage({
                          id: "contact_submissions.index.empty_state",
                          defaultMessage: "No inquiries yet.",
                        })}
                      </span>
                    </EmptyState>
                  )}
                >
                  {isLoading ? (
                    <Table.Row id="loading-row">
                      <Table.Cell
                        className="py-10 text-center"
                        colSpan={columns.length}
                      >
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({
                            id: "contact_submissions.index.loading",
                            defaultMessage: "Loading inquiries...",
                          })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : isError ? (
                    <Table.Row id="error-row">
                      <Table.Cell
                        className="py-10 text-center"
                        colSpan={columns.length}
                      >
                        <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted">
                          <AppIcon
                            name="cloud-error"
                            className="size-6 text-danger"
                          />
                          <span>
                            {intl.formatMessage({
                              id: "contact_submissions.index.error",
                              defaultMessage:
                                "Failed to load contact inquiries.",
                            })}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => void refetch()}
                          >
                            {intl.formatMessage({
                              id: "contact_submissions.index.retry",
                              defaultMessage: "Retry",
                            })}
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer>
              <Pagination size="sm">
                <Pagination.Summary>
                  {pageStart} to {pageEnd} of {totalEntries} results
                </Pagination.Summary>
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      isDisabled={!table.getCanPreviousPage()}
                      onPress={() => table.previousPage()}
                    >
                      <Pagination.PreviousIcon />
                      Prev
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
                            onPress={() => table.setPageIndex(item - 1)}
                          >
                            {item}
                          </Pagination.Link>
                        </Pagination.Item>
                      ),
                  )}
                  <Pagination.Item>
                    <Pagination.Next
                      isDisabled={!table.getCanNextPage()}
                      onPress={() => table.nextPage()}
                    >
                      Next
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>
    </section>
  );
}

export { ContactSubmissionsIndexPage };
