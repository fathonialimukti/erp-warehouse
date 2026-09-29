import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import {
  Card,
  Button,
  Table,
  Spinner,
  EmptyState,
  Chip,
  Dropdown,
  Pagination,
  Modal,
  Form,
  Input,
  Label,
  Select,
  ListBox,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import * as XLSX from "xlsx";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";
import { getPaginationItems } from "../../lib/pagination";

export const lokasiStatusValues = ["ACTIVE", "MAINTENANCE", "FULL"] as const;
export type LokasiStatus = (typeof lokasiStatusValues)[number];

export type LokasiRow = {
  id: string;
  status: LokasiStatus;
  pallet: {
    id: string;
    sku: {
      name: string;
    };
  } | null;
  createdAt: string;
};

type ExportRow = {
  ID: string;
  Status: LokasiStatus;
  PaletID: string;
  SKU: string;
};

interface WarehouseLocationTableCardProps {
  intl: ReturnType<typeof useIntl>;
  columns: { id: string; name: string }[];
  paginatedRows: LokasiRow[];
  page: number;
  pageItems: Array<number | "ellipsis">;
  start: number;
  end: number;
  totalItems: number;
  totalPages: number;
  isLoadingLokasi: boolean;
  isFetchingLokasi: boolean;
  lokasiRows: LokasiRow[];
  occupiedCount: number;
  feedbackMessage: string | null;
  feedbackTone: "danger" | "success";
  canReadLocations: boolean;
  canCreateLocation: boolean;
  canImportLocation: boolean;
  canUpdateLocation: boolean;
  canDeleteLocation: boolean;
  isImporting: boolean;
  isExporting: boolean;
  onExport: (format: "csv" | "xlsx") => void;
  onImport: (file: File | null) => Promise<void>;
  onOpenAddLocation: () => void;
  onEditLocation: (row: LokasiRow) => void;
  onDeleteLocation: (id: string) => void;
  onPageChange: (page: number) => void;
}

export function WarehouseLocationTableCard({
  intl,
  columns,
  paginatedRows,
  page,
  pageItems,
  start,
  end,
  totalItems,
  totalPages,
  isLoadingLokasi,
  isFetchingLokasi,
  lokasiRows,
  occupiedCount,
  feedbackMessage,
  feedbackTone,
  canReadLocations,
  canCreateLocation,
  canImportLocation,
  canUpdateLocation,
  canDeleteLocation,
  isImporting,
  isExporting,
  onExport,
  onImport,
  onOpenAddLocation,
  onEditLocation,
  onDeleteLocation,
  onPageChange,
}: WarehouseLocationTableCardProps) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleImportSubmit = async () => {
    await onImport(importFile);
    if (importFile) {
      setImportFile(null);
      setImportModalOpen(false);
    }
  };

  return (
    <Card>
      <Card.Header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Card.Title className="text-base">
              {intl.formatMessage({
                id: "warehouse.detail.storage_location_title",
                defaultMessage: "Storage Locations",
              })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({
                id: "warehouse.detail.storage_location_description",
                defaultMessage:
                  "Location table for this warehouse, including status, pallet occupancy, and change controls.",
              })}
            </Card.Description>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReadLocations ? (
              <Button
                variant="primary"
                onPress={() => setExportModalOpen(true)}
              >
                {intl.formatMessage({
                  id: "warehouse.detail.export_data_button",
                  defaultMessage: "Export Data",
                })}
              </Button>
            ) : null}
            {canImportLocation ? (
              <Button
                variant="primary"
                onPress={() => setImportModalOpen(true)}
              >
                {intl.formatMessage({
                  id: "warehouse.detail.import_data_button",
                  defaultMessage: "Import Data",
                })}
              </Button>
            ) : null}
            {canCreateLocation ? (
              <Button variant="primary" onPress={onOpenAddLocation}>
                <Icon icon="solar:add-circle-linear" className="size-4" />
                {intl.formatMessage({
                  id: "warehouse.detail.add_location_button",
                  defaultMessage: "Add Location",
                })}
              </Button>
            ) : null}
          </div>
        </div>
      </Card.Header>

      <Card.Content className="space-y-4">
        {feedbackMessage && (
          <p
            className={`rounded-xl border px-3 py-2 text-sm ${
              feedbackTone === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {feedbackMessage}
          </p>
        )}

        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label={intl.formatMessage({
                id: "warehouse.detail.storage_locations_table_aria",
                defaultMessage: "Storage locations table",
              })}
              className="min-w-full"
            >
              <Table.Header columns={columns}>
                {(column) => (
                  <Table.Column isRowHeader={column.id === "id"}>
                    {column.name}
                  </Table.Column>
                )}
              </Table.Header>

              {isLoadingLokasi || isFetchingLokasi ? (
                <Table.Body>
                  <Table.Row id="loading-row">
                    <Table.Cell
                      className="py-10 text-center"
                      colSpan={columns.length}
                    >
                      <div className="flex items-center justify-center gap-2 text-sm text-muted">
                        <Spinner size="sm" />
                        {intl.formatMessage({
                          id: "warehouse.detail.storage_location_loading",
                          defaultMessage: "Loading storage locations...",
                        })}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              ) : !canReadLocations ? (
                <Table.Body>
                  <Table.Row id="restricted-row">
                    <Table.Cell colSpan={columns.length}>
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                        <Icon
                          icon="solar:lock-closed-linear"
                          className="size-6 text-muted"
                        />
                        {intl.formatMessage({
                          id: "warehouse.detail.storage_location_restricted",
                          defaultMessage:
                            "You do not have permission to view storage locations for this warehouse.",
                        })}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              ) : (
                <Table.Body
                  items={paginatedRows}
                  renderEmptyState={() => (
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon
                        icon="solar:map-point-linear"
                        className="size-6 text-muted"
                      />
                      <span className="text-sm text-muted">
                        {intl.formatMessage({
                          id: "warehouse.detail.storage_location_empty_state",
                          defaultMessage: "No storage locations found.",
                        })}
                      </span>
                    </EmptyState>
                  )}
                >
                  {(lokasi) => (
                    <Table.Row
                      key={lokasi.id}
                      id={lokasi.id}
                      className="cursor-pointer"
                    >
                      <Table.Collection items={columns}>
                        {(column) => (
                          <Table.Cell>
                            {column.id === "id" ? (
                              lokasi.id
                            ) : column.id === "status" ? (
                              <Chip
                                size="sm"
                                variant="soft"
                                color={
                                  lokasi.status === "ACTIVE"
                                    ? "success"
                                    : lokasi.status === "MAINTENANCE"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {lokasi.status}
                              </Chip>
                            ) : column.id === "palet" ? (
                              (lokasi.pallet?.id ?? "-")
                            ) : column.id === "sku" ? (
                              (lokasi.pallet?.sku.name ?? "-")
                            ) : column.id === "actions" ? (
                              <Dropdown>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isIconOnly
                                  aria-label="Actions"
                                >
                                  <Icon
                                    icon="solar:menu-dots-bold"
                                    className="size-4"
                                  />
                                </Button>
                                <Dropdown.Popover>
                                  <Dropdown.Menu
                                    aria-label={intl.formatMessage({
                                      id: "warehouse.detail.location_actions_menu_aria",
                                      defaultMessage: "Location actions",
                                    })}
                                  >
                                    {canUpdateLocation ? (
                                      <Dropdown.Item
                                        key="edit"
                                        onPress={() => onEditLocation(lokasi)}
                                      >
                                        <Icon
                                          icon="solar:pen-linear"
                                          className="size-4"
                                        />
                                        {intl.formatMessage({
                                          id: "warehouse.detail.location_action_edit",
                                          defaultMessage: "Edit location",
                                        })}
                                      </Dropdown.Item>
                                    ) : null}
                                    {canDeleteLocation ? (
                                      <Dropdown.Item
                                        key="delete"
                                        variant="danger"
                                        onPress={() =>
                                          void onDeleteLocation(lokasi.id)
                                        }
                                      >
                                        <Icon
                                          icon="solar:trash-bin-trash-linear"
                                          className="size-4"
                                        />
                                        {intl.formatMessage({
                                          id: "warehouse.detail.location_action_delete",
                                          defaultMessage: "Delete location",
                                        })}
                                      </Dropdown.Item>
                                    ) : null}
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                            ) : null}
                          </Table.Cell>
                        )}
                      </Table.Collection>
                    </Table.Row>
                  )}
                </Table.Body>
              )}
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {intl.formatMessage(
                {
                  id: "warehouse.detail.storage_location_summary",
                  defaultMessage:
                    "{total} locations found, {occupied} occupied",
                },
                { total: lokasiRows.length, occupied: occupiedCount },
              )}
            </span>
            {lokasiRows.length > 0 ? (
              <>
                <Pagination size="sm">
                  <Pagination.Summary>
                    {start} to {end} of {totalItems} results
                  </Pagination.Summary>
                  <Pagination.Content>
                    <Pagination.Item>
                      <Pagination.Previous
                        isDisabled={page === 1}
                        onPress={() => onPageChange(Math.max(1, page - 1))}
                      >
                        <Pagination.PreviousIcon />
                        Prev
                      </Pagination.Previous>
                    </Pagination.Item>
                    {pageItems.map((pageNumber, index) =>
                      pageNumber === "ellipsis" ? (
                        <Pagination.Item key={`ellipsis-${index}`}>
                          <Pagination.Ellipsis />
                        </Pagination.Item>
                      ) : (
                        <Pagination.Item key={pageNumber}>
                          <Pagination.Link
                            isActive={pageNumber === page}
                            onPress={() => onPageChange(pageNumber)}
                          >
                            {pageNumber}
                          </Pagination.Link>
                        </Pagination.Item>
                      ),
                    )}
                    <Pagination.Item>
                      <Pagination.Next
                        isDisabled={page === totalPages}
                        onPress={() =>
                          onPageChange(Math.min(totalPages, page + 1))
                        }
                      >
                        Next
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              </>
            ) : null}
          </Table.Footer>
        </Table>

        <Modal isOpen={importModalOpen} onOpenChange={setImportModalOpen}>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="sm:max-w-125">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>
                    {intl.formatMessage({
                      id: "warehouse.detail.import_modal.title",
                      defaultMessage: "Import Storage Locations",
                    })}
                  </Modal.Heading>
                  <p className="text-sm text-muted mt-1">
                    {intl.formatMessage({
                      id: "warehouse.detail.import_modal.description",
                      defaultMessage:
                        "Upload a CSV or Excel file to import storage location data.",
                    })}
                  </p>
                </Modal.Header>
                <Form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await handleImportSubmit();
                  }}
                >
                  <Modal.Body className="space-y-4">
                    <div className="p-2">
                      <Label>
                        {intl.formatMessage({
                          id: "warehouse.detail.import_modal.file_label",
                          defaultMessage: "Choose file",
                        })}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={importFile?.name ?? ""}
                          readOnly
                          variant="primary"
                          placeholder={intl.formatMessage({
                            id: "warehouse.detail.import_modal.file_placeholder",
                            defaultMessage: "Select a CSV/XLSX file",
                          })}
                          className="flex-1"
                        />
                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-default-300 px-3 text-sm font-medium text-foreground hover:bg-default-100">
                          {intl.formatMessage({
                            id: "warehouse.detail.import_modal.browse",
                            defaultMessage: "Browse",
                          })}
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={(event) =>
                              setImportFile(event.target.files?.[0] ?? null)
                            }
                          />
                        </label>
                      </div>
                    </div>

                    {feedbackMessage && (
                      <p
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          feedbackTone === "success"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-danger/30 bg-danger/10 text-danger"
                        }`}
                      >
                        {feedbackMessage}
                      </p>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      type="button"
                      variant="ghost"
                      onPress={() => setImportModalOpen(false)}
                    >
                      {intl.formatMessage({
                        id: "warehouse.detail.import_modal.cancel",
                        defaultMessage: "Cancel",
                      })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onPress={() => setImportFile(null)}
                      isDisabled={!importFile}
                    >
                      {intl.formatMessage({
                        id: "warehouse.detail.import_modal.reset",
                        defaultMessage: "Reset File",
                      })}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isDisabled={isImporting || !importFile}
                    >
                      {isImporting
                        ? intl.formatMessage({
                            id: "warehouse.detail.import_modal.importing",
                            defaultMessage: "Importing...",
                          })
                        : intl.formatMessage({
                            id: "warehouse.detail.import_modal.import",
                            defaultMessage: "Import",
                          })}
                    </Button>
                  </Modal.Footer>
                </Form>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>

        <Modal isOpen={exportModalOpen} onOpenChange={setExportModalOpen}>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="sm:max-w-100">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>
                    {intl.formatMessage({
                      id: "warehouse.detail.export_modal.title",
                      defaultMessage: "Export Storage Locations",
                    })}
                  </Modal.Heading>
                  <p className="text-sm text-muted mt-1">
                    {intl.formatMessage({
                      id: "warehouse.detail.export_modal.description",
                      defaultMessage:
                        "Select a file format to export storage location data.",
                    })}
                  </p>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <div className="grid gap-3">
                    <Button
                      variant="primary"
                      isDisabled={isExporting}
                      onPress={() => {
                        onExport("csv");
                        setExportModalOpen(false);
                      }}
                      className="justify-start"
                    >
                      <Icon icon="solar:file-text-linear" className="size-4" />
                      {intl.formatMessage({
                        id: "warehouse.detail.export_modal.export_csv",
                        defaultMessage: "Export as CSV",
                      })}
                    </Button>
                    <Button
                      variant="primary"
                      isDisabled={isExporting}
                      onPress={() => {
                        onExport("xlsx");
                        setExportModalOpen(false);
                      }}
                      className="justify-start"
                    >
                      <Icon icon="solar:file-linear" className="size-4" />
                      {intl.formatMessage({
                        id: "warehouse.detail.export_modal.export_xlsx",
                        defaultMessage: "Export as XLSX",
                      })}
                    </Button>
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        feedbackTone === "success"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-danger/30 bg-danger/10 text-danger"
                      }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="ghost"
                    onPress={() => setExportModalOpen(false)}
                  >
                    {intl.formatMessage({
                      id: "warehouse.detail.export_modal.cancel",
                      defaultMessage: "Cancel",
                    })}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </Card.Content>
    </Card>
  );
}

function sanitizeFileSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
}

function downloadBlob(content: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isLokasiStatus(value: string): value is LokasiStatus {
  return lokasiStatusValues.includes(value as LokasiStatus);
}

interface WarehouseLocationSectionProps {
  warehouseId: string;
  warehouseName: string;
}

export function WarehouseLocationSection({
  warehouseId,
  warehouseName,
}: WarehouseLocationSectionProps) {
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canReadLocations = hasPermission("storage_location@read");
  const canCreateLocation = hasPermission("storage_location@create");
  const canUpdateLocation = hasPermission("storage_location@update");
  const canDeleteLocation = hasPermission("storage_location@delete");
  const canImportLocation = hasPermission("storage_location@import");

  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lokasiIdInput, setLokasiIdInput] = useState("");
  const [statusInput, setStatusInput] = useState<LokasiStatus>("ACTIVE");
  const [lokasiModalOpen, setLokasiModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"danger" | "success">(
    "success",
  );

  const {
    data: lokasiRows = [],
    isLoading: isLoadingLokasi,
    isFetching: isFetchingLokasi,
    refetch,
  } = useQuery<LokasiRow[]>({
    queryKey: ["warehouseLokasi", warehouseId],
    enabled: Boolean(warehouseId) && canReadLocations,
    queryFn: () =>
      trpcClient.warehouse.storageLocation.exportAll.query({ warehouseId }),
  });

  useEffect(() => {
    setPage(1);
  }, [warehouseId]);

  const totalPages = Math.max(1, Math.ceil(lokasiRows.length / 10));
  const pageItems = useMemo(
    () => getPaginationItems(page, totalPages),
    [page, totalPages],
  );
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * 10;
    return lokasiRows.slice(start, start + 10);
  }, [lokasiRows, page]);
  const start = lokasiRows.length === 0 ? 0 : (page - 1) * 10 + 1;
  const end = Math.min(page * 10, lokasiRows.length);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const lokasiSummary = useMemo(() => {
    const total = lokasiRows.length;
    const aktif = lokasiRows.filter((row) => row.status === "ACTIVE").length;
    const maintenance = lokasiRows.filter(
      (row) => row.status === "MAINTENANCE",
    ).length;
    const penuh = lokasiRows.filter((row) => row.status === "FULL").length;
    const occupied = lokasiRows.filter((row) => row.pallet).length;
    const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { aktif, maintenance, occupied, penuh, total, utilization };
  }, [lokasiRows]);

  const setFeedback = (tone: "danger" | "success", message: string) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const resetLokasiForm = () => {
    setEditingId(null);
    setLokasiIdInput("");
    setStatusInput("ACTIVE");
    setLokasiModalOpen(false);
  };

  const startEdit = (row: LokasiRow) => {
    if (!canUpdateLocation) {
      return;
    }

    setEditingId(row.id);
    setLokasiIdInput(row.id);
    setStatusInput(row.status);
    setLokasiModalOpen(true);
  };

  const submitLokasi = async () => {
    if (!warehouseId) return;

    if (!editingId && !canCreateLocation) {
      setFeedback(
        "danger",
        intl.formatMessage({
          id: "warehouse.detail.feedback_no_permission_create_location",
          defaultMessage:
            "You do not have permission to create a storage location.",
        }),
      );
      return;
    }

    if (editingId && !canUpdateLocation) {
      setFeedback(
        "danger",
        intl.formatMessage({
          id: "warehouse.detail.feedback_no_permission_update_location",
          defaultMessage:
            "You do not have permission to update this storage location.",
        }),
      );
      return;
    }

    if (!lokasiIdInput.trim()) {
      setFeedback(
        "danger",
        intl.formatMessage({
          id: "warehouse.detail.feedback_location_id_required",
          defaultMessage: "Location ID is required.",
        }),
      );
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      if (editingId) {
        await trpcClient.warehouse.storageLocation.update.mutate({
          currentId: editingId,
          id: lokasiIdInput.trim(),
          warehouseId,
          status: statusInput,
        });
        setFeedback(
          "success",
          intl.formatMessage({
            id: "warehouse.detail.feedback_location_updated",
            defaultMessage: "Storage location updated successfully.",
          }),
        );
      } else {
        await trpcClient.warehouse.storageLocation.create.mutate({
          id: lokasiIdInput.trim(),
          warehouseId,
          status: statusInput,
        });
        setFeedback(
          "success",
          intl.formatMessage({
            id: "warehouse.detail.feedback_location_added",
            defaultMessage: "Storage location added successfully.",
          }),
        );
      }

      resetLokasiForm();
      await refetch();
    } catch (error) {
      setFeedback(
        "danger",
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: "warehouse.detail.feedback_location_save_failed",
              defaultMessage: "Failed to save storage location.",
            }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLokasi = async (lokasiId: string) => {
    if (!canDeleteLocation) {
      setFeedback(
        "danger",
        intl.formatMessage({
          id: "warehouse.detail.feedback_no_permission_delete_location",
          defaultMessage:
            "You do not have permission to delete this storage location.",
        }),
      );
      return;
    }

    if (
      !confirm(
        intl.formatMessage({
          id: "warehouse.detail.confirm_delete_location",
          defaultMessage: "Delete this storage location?",
        }),
      )
    ) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.warehouse.storageLocation.delete.mutate({
        id: lokasiId,
      });
      setFeedback(
        "success",
        intl.formatMessage({
          id: "warehouse.detail.feedback_location_deleted",
          defaultMessage: "Storage location deleted successfully.",
        }),
      );
      await refetch();
    } catch (error) {
      setFeedback(
        "danger",
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: "warehouse.detail.feedback_location_delete_failed",
              defaultMessage: "Failed to delete storage location.",
            }),
      );
    }
  };

  const exportLokasi = async (format: "csv" | "xlsx") => {
    if (!warehouseId) {
      return;
    }

    setIsExporting(true);
    setFeedbackMessage(null);

    try {
      const rows = await trpcClient.warehouse.storageLocation.exportAll.query({
        warehouseId,
      });
      const exportRows: ExportRow[] = rows.map((row) => ({
        ID: row.id,
        Status: row.status,
        PaletID: row.pallet?.id ?? "-",
        SKU: row.pallet?.sku.name ?? "-",
      }));

      const sheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Lokasi");

      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      const baseName = `lokasi-${sanitizeFileSegment(warehouseName)}-${timestamp}`;

      if (format === "csv") {
        const csv = XLSX.utils.sheet_to_csv(sheet);
        downloadBlob(csv, `${baseName}.csv`, "text/csv;charset=utf-8;");
      } else {
        const xlsxBuffer = XLSX.write(workbook, {
          type: "array",
          bookType: "xlsx",
        });
        downloadBlob(
          xlsxBuffer,
          `${baseName}.xlsx`,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      }

      setFeedback(
        "success",
        intl.formatMessage({
          id: "warehouse.detail.feedback_export_success",
          defaultMessage: "Export completed successfully.",
        }),
      );
    } catch (error) {
      setFeedback(
        "danger",
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: "warehouse.detail.feedback_export_failed",
              defaultMessage: "Export failed.",
            }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (file: File | null) => {
    if (!warehouseId || !file) {
      setFeedback(
        "danger",
        intl.formatMessage({
          id: "warehouse.detail.feedback_import_file_required",
          defaultMessage: "Please select a CSV/XLSX file first.",
        }),
      );
      return;
    }

    setIsImporting(true);
    setFeedbackMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        throw new Error(
          intl.formatMessage({
            id: "warehouse.detail.import_error_sheet_missing",
            defaultMessage: "No sheet found in the import file.",
          }),
        );
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        raw: false,
      });

      if (rows.length === 0) {
        throw new Error(
          intl.formatMessage({
            id: "warehouse.detail.import_error_empty_file",
            defaultMessage: "The import file is empty.",
          }),
        );
      }

      const firstCell = String(rows[0]?.[0] ?? "")
        .trim()
        .toLowerCase();
      const hasHeader = firstCell === "id" || firstCell === "kode";
      const startIndex = hasHeader ? 1 : 0;

      const parsed = rows
        .slice(startIndex)
        .map((row) => ({
          id: String(row[0] ?? "").trim(),
          status: String(row[1] ?? "")
            .trim()
            .toUpperCase(),
        }))
        .filter((row) => row.id.length > 0);

      if (parsed.length === 0) {
        throw new Error(
          intl.formatMessage({
            id: "warehouse.detail.import_error_no_valid_rows",
            defaultMessage: "No valid data rows found to import.",
          }),
        );
      }

      const invalidStatus = parsed.find(
        (row) => row.status.length > 0 && !isLokasiStatus(row.status),
      );
      if (invalidStatus) {
        throw new Error(
          intl.formatMessage(
            {
              id: "warehouse.detail.import_error_invalid_status",
              defaultMessage: "Invalid status for ID {id}: {status}",
            },
            { id: invalidStatus.id, status: invalidStatus.status },
          ),
        );
      }

      const importResult =
        await trpcClient.warehouse.storageLocation.importBatch.mutate({
          warehouseId,
          rows: parsed.map((row) => ({
            id: row.id,
            status: isLokasiStatus(row.status) ? row.status : undefined,
          })),
        });

      setFeedback(
        "success",
        `Import selesai. Created: ${importResult.created}, Updated: ${importResult.updated}, Deleted: ${importResult.deleted}.`,
      );
      await refetch();
    } catch (error) {
      setFeedback(
        "danger",
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: "warehouse.detail.feedback_import_failed",
              defaultMessage: "Import failed.",
            }),
      );
    } finally {
      setIsImporting(false);
    }
  };

  const columns = [
    { id: "id", name: "ID" },
    {
      id: "status",
      name: intl.formatMessage({
        id: "warehouse.detail.location_table_header_status",
        defaultMessage: "Status",
      }),
    },
    {
      id: "palet",
      name: intl.formatMessage({
        id: "warehouse.detail.location_table_header_pallet",
        defaultMessage: "Pallet",
      }),
    },
    { id: "sku", name: "SKU" },
    { id: "actions", name: "" },
  ];

  return (
    <section className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {intl.formatMessage({
              id: "warehouse.detail.overview_total_locations_label",
              defaultMessage: "Total Locations",
            })}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {lokasiSummary.total.toLocaleString("id-ID")}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {intl.formatMessage({
              id: "warehouse.detail.overview_occupied_locations_label",
              defaultMessage: "Occupied Locations",
            })}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {lokasiSummary.occupied.toLocaleString("id-ID")}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            {intl.formatMessage({
              id: "warehouse.detail.overview_occupied_locations_hint",
              defaultMessage: "Locations currently holding pallets.",
            })}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {intl.formatMessage({
              id: "warehouse.detail.overview_utilization_label",
              defaultMessage: "Utilization",
            })}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{`${lokasiSummary.utilization}%`}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {intl.formatMessage({
              id: "warehouse.detail.overview_maintenance_locations_label",
              defaultMessage: "Maintenance Locations",
            })}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            {lokasiSummary.maintenance.toLocaleString("id-ID")}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            {intl.formatMessage({
              id: "warehouse.detail.overview_maintenance_locations_hint",
              defaultMessage: "Locations currently under maintenance.",
            })}
          </p>
        </Card>
      </div>

      <WarehouseLocationTableCard
        intl={intl}
        columns={columns}
        paginatedRows={paginatedRows}
        page={page}
        pageItems={pageItems}
        start={start}
        end={end}
        totalItems={lokasiRows.length}
        totalPages={totalPages}
        isLoadingLokasi={isLoadingLokasi}
        isFetchingLokasi={isFetchingLokasi}
        lokasiRows={lokasiRows}
        occupiedCount={lokasiSummary.occupied}
        feedbackMessage={feedbackMessage}
        feedbackTone={feedbackTone}
        canReadLocations={canReadLocations}
        canCreateLocation={canCreateLocation}
        canImportLocation={canImportLocation}
        canUpdateLocation={canUpdateLocation}
        canDeleteLocation={canDeleteLocation}
        isImporting={isImporting}
        isExporting={isExporting}
        onExport={exportLokasi}
        onImport={handleImport}
        onOpenAddLocation={() => setLokasiModalOpen(true)}
        onEditLocation={startEdit}
        onDeleteLocation={handleDeleteLokasi}
        onPageChange={setPage}
      />

      <Modal isOpen={lokasiModalOpen} onOpenChange={setLokasiModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-125">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {editingId
                    ? intl.formatMessage({
                        id: "warehouse.detail.location_modal_title_edit",
                        defaultMessage: "Edit Storage Location",
                      })
                    : intl.formatMessage({
                        id: "warehouse.detail.location_modal_title_create",
                        defaultMessage: "Add Storage Location",
                      })}
                </Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {editingId
                    ? intl.formatMessage({
                        id: "warehouse.detail.location_modal_description_edit",
                        defaultMessage: "Update the storage location details.",
                      })
                    : intl.formatMessage({
                        id: "warehouse.detail.location_modal_description_create",
                        defaultMessage: "Add a new storage location.",
                      })}
                </p>
              </Modal.Header>
              <Form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitLokasi();
                }}
              >
                <Modal.Body className="space-y-4">
                  <TextField isRequired>
                    <Label>
                      {intl.formatMessage({
                        id: "warehouse.detail.location_id_label",
                        defaultMessage: "Location ID",
                      })}
                    </Label>
                    <Input
                      placeholder={intl.formatMessage({
                        id: "warehouse.detail.location_id_placeholder",
                        defaultMessage: "Enter location ID",
                      })}
                      value={lokasiIdInput}
                      onChange={(event) => setLokasiIdInput(event.target.value)}
                      variant="primary"
                    />
                  </TextField>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                      selectedKey={statusInput}
                      onSelectionChange={(key) => {
                        if (key == null) return;
                        const nextStatus = String(key);
                        if (isLokasiStatus(nextStatus)) {
                          setStatusInput(nextStatus);
                        }
                      }}
                      variant="primary"
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {lokasiStatusValues.map((status) => (
                            <ListBox.Item key={status}>{status}</ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        feedbackTone === "success"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-danger/30 bg-danger/10 text-danger"
                      }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={() => setLokasiModalOpen(false)}
                  >
                    {intl.formatMessage({
                      id: "warehouse.detail.location_modal.cancel",
                      defaultMessage: "Cancel",
                    })}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={isSubmitting}
                  >
                    {isSubmitting
                      ? intl.formatMessage({
                          id: "warehouse.detail.location_modal.saving",
                          defaultMessage: "Saving...",
                        })
                      : editingId
                        ? intl.formatMessage({
                            id: "warehouse.detail.location_modal.submit_update",
                            defaultMessage: "Save Changes",
                          })
                        : intl.formatMessage({
                            id: "warehouse.detail.location_modal.submit_create",
                            defaultMessage: "Add Location",
                          })}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
