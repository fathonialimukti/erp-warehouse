import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Dropdown, EmptyState, Form, Input, Label, ListBox, Modal, Select, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Table as TanstackTable,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { IntlShape } from 'react-intl';
import * as XLSX from 'xlsx';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

const lokasiStatusValues = ['ACTIVE', 'MAINTENANCE', 'FULL'] as const;
type LokasiStatus = (typeof lokasiStatusValues)[number];

interface WarehouseDetail {
  id: string;
  name: string;
  address: string;
  totalCapacity: number | null;
  photo: string | null;
}

type LokasiRow = {
  id: string;
  status: LokasiStatus;
  pallet: {
    id: string;
    palletType: {
      name: string;
      sku: {
        name: string;
      };
    };
  } | null;
  createdAt: string;
};

type ExportRow = {
  ID: string;
  Status: LokasiStatus;
  PaletID: string;
  JenisPalet: string;
  SKU: string;
};

interface LokasiListResult {
  data: LokasiRow[];
}

interface WarehouseLocationTableCardProps {
  intl: IntlShape;
  table: TanstackTable<LokasiRow>;
  columns: ColumnDef<LokasiRow>[];
  isLoadingLokasi: boolean;
  isFetchingLokasi: boolean;
  lokasiRows: LokasiRow[];
  occupiedCount: number;
  feedbackMessage: string | null;
  feedbackTone: 'danger' | 'success';
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenAddLocation: () => void;
}

function WarehouseLocationTableCard({
  intl,
  table,
  columns,
  isLoadingLokasi,
  isFetchingLokasi,
  lokasiRows,
  occupiedCount,
  feedbackMessage,
  feedbackTone,
  onOpenExport,
  onOpenImport,
  onOpenAddLocation,
}: WarehouseLocationTableCardProps) {
  return (
    <Card>
      <Card.Header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
              <Card.Title className="text-base">{intl.formatMessage({ id: 'warehouse.detail.storage_location_title', defaultMessage: 'Storage Locations' })}</Card.Title>
              <Card.Description>{intl.formatMessage({ id: 'warehouse.detail.storage_location_description', defaultMessage: 'Location table for this warehouse, including status, pallet occupancy, and change controls.' })}</Card.Description>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onPress={onOpenExport}>
                {intl.formatMessage({ id: 'warehouse.detail.export_data_button', defaultMessage: 'Export Data' })}
              </Button>
              <Button variant="primary" onPress={onOpenImport}>
                {intl.formatMessage({ id: 'warehouse.detail.import_data_button', defaultMessage: 'Import Data' })}
              </Button>
              <Button variant="primary" onPress={onOpenAddLocation}>
                <Icon icon="solar:add-circle-linear" className="size-4" />
                {intl.formatMessage({ id: 'warehouse.detail.add_location_button', defaultMessage: 'Add Location' })}
              </Button>
            </div>
          </div>
        </Card.Header>

      <Card.Content className="space-y-4">

        {feedbackMessage && (
          <p
            className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-danger/30 bg-danger/10 text-danger'
              }`}
          >
            {feedbackMessage}
          </p>
        )}

        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={intl.formatMessage({ id: 'warehouse.detail.storage_locations_table_aria', defaultMessage: 'Storage locations table' })} className="min-w-full">
              <Table.Header>
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <Table.Column key={header.id} isRowHeader={header.id === 'id'}>
                      <span className="font-semibold">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    </Table.Column>
                  ))
                )}
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                    <Icon icon="solar:map-point-linear" className="size-6 text-muted" />
                    <span className="text-sm text-muted">{intl.formatMessage({ id: 'warehouse.detail.storage_location_empty_state', defaultMessage: 'No storage locations found.' })}</span>
                  </EmptyState>
                )}
              >
                {isLoadingLokasi || isFetchingLokasi ? (
                  <Table.Row id="loading-row">
                    <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                      <div className="flex items-center justify-center gap-2 text-sm text-muted">
                        <Spinner size="sm" />
                        {intl.formatMessage({ id: 'warehouse.detail.storage_location_loading', defaultMessage: 'Loading storage locations...' })}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer">
                      {row.getVisibleCells().map((cell) => (
                        <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {intl.formatMessage({ id: 'warehouse.detail.storage_location_summary', defaultMessage: '{total} locations found, {occupied} occupied' }, { total: lokasiRows.length, occupied: occupiedCount })}
            </span>
          </Table.Footer>
        </Table>
      </Card.Content>
    </Card>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted">{label}</Label>
      <p>{value ?? '-'}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </Card>
  );
}

function isLokasiStatus(value: string): value is LokasiStatus {
  return lokasiStatusValues.includes(value as LokasiStatus);
}

function downloadBlob(content: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeFileSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
}

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [lokasiIdInput, setLokasiIdInput] = useState('');
  const [statusInput, setStatusInput] = useState<LokasiStatus>('ACTIVE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeletingWarehouse, setIsDeletingWarehouse] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'danger' | 'success'>('success');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [lokasiModalOpen, setLokasiModalOpen] = useState(false);

  const { data: warehouseQueryData, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.warehouse.detail.query({ id: id ?? '' }),
  });

  const warehouse = warehouseQueryData as WarehouseDetail | undefined;

  const {
    data: lokasiQueryData,
    isLoading: isLoadingLokasi,
    isFetching: isFetchingLokasi,
    refetch: refetchLokasi,
  } = useQuery({
    queryKey: ['warehouseLokasi', id],
    enabled: Boolean(id),
    queryFn: () =>
      trpcClient.warehouse.storageLocation.list.query({
        warehouseId: id,
      }),
  });

  const lokasiData = lokasiQueryData as LokasiListResult | undefined;
  const lokasiRows = useMemo(() => lokasiData?.data ?? [], [lokasiData?.data]);
  const lokasiSummary = useMemo(() => {
    const total = lokasiRows.length;
    const aktif = lokasiRows.filter((row) => row.status === 'ACTIVE').length;
    const maintenance = lokasiRows.filter((row) => row.status === 'MAINTENANCE').length;
    const penuh = lokasiRows.filter((row) => row.status === 'FULL').length;
    const occupied = lokasiRows.filter((row) => row.pallet).length;
    const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { aktif, maintenance, occupied, penuh, total, utilization };
  }, [lokasiRows]);

  const resetLokasiForm = () => {
    setEditingId(null);
    setLokasiIdInput('');
    setStatusInput('ACTIVE');
    setLokasiModalOpen(false);
  };

  const setFeedback = (tone: 'danger' | 'success', message: string) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const startEdit = (row: LokasiRow) => {
    setEditingId(row.id);
    setLokasiIdInput(row.id);
    setStatusInput(row.status);
    setLokasiModalOpen(true);
  };

  const submitLokasi = async () => {
    if (!id) return;

    if (!lokasiIdInput.trim()) {
      setFeedback('danger', intl.formatMessage({ id: 'warehouse.detail.feedback_location_id_required', defaultMessage: 'Location ID is required.' }));
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      if (editingId) {
        await trpcClient.warehouse.storageLocation.update.mutate({
          currentId: editingId,
          id: lokasiIdInput.trim(),
          warehouseId: id,
          status: statusInput,
        });
        setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedback_location_updated', defaultMessage: 'Storage location updated successfully.' }));
      } else {
        await trpcClient.warehouse.storageLocation.create.mutate({
          id: lokasiIdInput.trim(),
          warehouseId: id,
          status: statusInput,
        });
        setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedback_location_added', defaultMessage: 'Storage location added successfully.' }));
      }

      resetLokasiForm();
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedback_location_save_failed', defaultMessage: 'Failed to save storage location.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLokasi = async (lokasiId: string) => {
    if (!confirm(intl.formatMessage({ id: 'warehouse.detail.confirm_delete_location', defaultMessage: 'Delete this storage location?' }))) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.warehouse.storageLocation.delete.mutate({ id: lokasiId });
      setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedback_location_deleted', defaultMessage: 'Storage location deleted successfully.' }));
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedback_location_delete_failed', defaultMessage: 'Failed to delete storage location.' }));
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!warehouse || isDeletingWarehouse) {
      return;
    }

    setIsDeletingWarehouse(true);
    try {
      await trpcClient.warehouse.warehouse.delete.mutate({ id: warehouse.id });
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouse.id] });
      queryClient.removeQueries({ queryKey: ['warehouseLokasi', warehouse.id] });
      setDeleteModalOpen(false);
      navigate('/warehouse');
    } catch (error) {
      setDeleteModalOpen(false);
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.errors.delete_failed', defaultMessage: 'Failed to delete warehouse.' }));
    } finally {
      setIsDeletingWarehouse(false);
    }
  };

  const exportLokasi = async (format: 'csv' | 'xlsx') => {
    if (!id || !warehouse) {
      return;
    }

    setIsExporting(true);
    setFeedbackMessage(null);

    try {
      const rows = await trpcClient.warehouse.storageLocation.exportAll.query({ warehouseId: id });
      const exportRows: ExportRow[] = rows.map((row) => ({
        ID: row.id,
        Status: row.status,
        PaletID: row.pallet?.id ?? '-',
        JenisPalet: row.pallet?.palletType.name ?? '-',
        SKU: row.pallet?.palletType.sku.name ?? '-',
      }));

      const sheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Lokasi');

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const baseName = `lokasi-${sanitizeFileSegment(warehouse.name)}-${timestamp}`;

      if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(sheet);
        downloadBlob(csv, `${baseName}.csv`, 'text/csv;charset=utf-8;');
      } else {
        const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        downloadBlob(xlsxBuffer, `${baseName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }

      setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedback_export_success', defaultMessage: 'Export completed successfully.' }));
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedback_export_failed', defaultMessage: 'Export failed.' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!id || !importFile) {
      setFeedback('danger', intl.formatMessage({ id: 'warehouse.detail.feedback_import_file_required', defaultMessage: 'Please select a CSV/XLSX file first.' }));
      return;
    }

    setIsImporting(true);
    setFeedbackMessage(null);

    try {
      const arrayBuffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.import_error_sheet_missing', defaultMessage: 'No sheet found in the import file.' }));
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        raw: false,
      });

      if (rows.length === 0) {
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.import_error_empty_file', defaultMessage: 'The import file is empty.' }));
      }

      const firstCell = String(rows[0]?.[0] ?? '').trim().toLowerCase();
      const hasHeader = firstCell === 'id' || firstCell === 'kode';
      const startIndex = hasHeader ? 1 : 0;

      const parsed = rows
        .slice(startIndex)
        .map((row) => ({
          id: String(row[0] ?? '').trim(),
          status: String(row[1] ?? '').trim().toUpperCase(),
        }))
        .filter((row) => row.id.length > 0);

      if (parsed.length === 0) {
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.import_error_no_valid_rows', defaultMessage: 'No valid data rows found to import.' }));
      }

      const invalidStatus = parsed.find(
        (row) => row.status.length > 0 && !isLokasiStatus(row.status)
      );
      if (invalidStatus) {
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.import_error_invalid_status', defaultMessage: 'Invalid status for ID {id}: {status}' }, { id: invalidStatus.id, status: invalidStatus.status }));
      }

      const importResult = await trpcClient.warehouse.storageLocation.importBatch.mutate({
        warehouseId: id,
        rows: parsed.map((row) => ({
          id: row.id,
          status: isLokasiStatus(row.status) ? row.status : undefined,
        })),
      });

      setImportFile(null);
      setImportModalOpen(false);
      setFeedback(
        'success',
        `Import selesai. Created: ${importResult.created}, Updated: ${importResult.updated}, Deleted: ${importResult.deleted}.`
      );
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedback_import_failed', defaultMessage: 'Import failed.' }));
    } finally {
      setIsImporting(false);
    }
  };

  const columns: ColumnDef<LokasiRow>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Chip
          size="sm"
          variant="soft"
          color={row.original.status === 'ACTIVE' ? 'success' : row.original.status === 'MAINTENANCE' ? 'warning' : 'danger'}
        >
          {row.original.status}
        </Chip>
      ),
    },
    {
      id: 'palet',
      header: intl.formatMessage({ id: 'warehouse.detail.location_table_header_pallet', defaultMessage: 'Pallet' }),
      cell: ({ row }) => (row.original.pallet ? row.original.pallet.id : '-'),
    },
    {
      id: 'jenisPalet',
      header: intl.formatMessage({ id: 'warehouse.detail.location_table_header_pallet_type', defaultMessage: 'Pallet Type' }),
      cell: ({ row }) => row.original.pallet?.palletType.name ?? '-',
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: ({ row }) => row.original.pallet?.palletType.sku.name ?? '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Dropdown>
          <Dropdown.Trigger>
            <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
              <Icon icon="solar:menu-dots-bold" className="size-4" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label={intl.formatMessage({ id: 'warehouse.detail.location_actions_menu_aria', defaultMessage: 'Location actions' })}>
              <Dropdown.Item
                key="edit"
                onPress={() => startEdit(row.original)}
              >
                <Icon icon="solar:pen-linear" className="size-4" />
                {intl.formatMessage({ id: 'warehouse.detail.location_action_edit', defaultMessage: 'Edit location' })}
              </Dropdown.Item>
              <Dropdown.Item
                key="delete"
                variant="danger"
                onPress={() => void handleDeleteLokasi(row.original.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                {intl.formatMessage({ id: 'warehouse.detail.location_action_delete', defaultMessage: 'Delete location' })}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      ),
    },
  ];

  const table = useReactTable({
    data: lokasiRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoadingWarehouse) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouse.detail.loading_detail', defaultMessage: 'Loading warehouse details...' })}</p>;
  }

  if (!warehouse) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'warehouse.detail.not_found', defaultMessage: 'Warehouse not found.' })}</p>
        <Button variant="ghost" onPress={() => navigate('/warehouse')}>
          {intl.formatMessage({ id: 'warehouse.detail.back_to_warehouses', defaultMessage: 'Back to Warehouses' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={warehouse.name}
        onBack={() => navigate('/warehouse')}
        onEdit={() => navigate(`/warehouse/${warehouse.id}/edit`)}
        onDelete={() => setDeleteModalOpen(true)}
      />

      <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.09)_0%,rgba(56,189,248,0.04)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(3,105,161,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.2)_0%,rgba(56,189,248,0.08)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <EntityPhoto src={warehouse.photo} alt={warehouse.name} className="h-72 w-full rounded-[1.25rem] border border-border/50 object-cover" />

          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {intl.formatMessage({ id: 'warehouse.detail.code_label', defaultMessage: 'Warehouse ID' })}
              </p>
              <p className="font-mono text-sm text-foreground">{warehouse.id}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{warehouse.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Chip variant="primary" color={lokasiSummary.occupied > 0 ? 'success' : 'default'}>
                  {intl.formatMessage({ id: 'warehouse.detail.chip_occupied_locations', defaultMessage: '{count} occupied' }, { count: lokasiSummary.occupied })}
                </Chip>
                <Chip variant="primary" color={lokasiSummary.maintenance > 0 ? 'warning' : 'default'}>
                  {intl.formatMessage({ id: 'warehouse.detail.chip_maintenance_locations', defaultMessage: '{count} maintenance' }, { count: lokasiSummary.maintenance })}
                </Chip>
                <Chip variant="primary" color={lokasiSummary.utilization >= 75 ? 'danger' : 'success'}>
                  {intl.formatMessage({ id: 'warehouse.detail.chip_utilization', defaultMessage: '{percent}% utilization' }, { percent: lokasiSummary.utilization })}
                </Chip>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.address_label', defaultMessage: 'Address' })}
                value={warehouse.address}
              />
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.total_capacity_label', defaultMessage: 'Total Capacity' })}
                value={warehouse.totalCapacity?.toLocaleString('id-ID') ?? '-'}
              />
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.utilization_label', defaultMessage: 'Utilization' })}
                value={`${lokasiSummary.utilization}%`}
              />
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.location_summary_label', defaultMessage: 'Locations' })}
                value={intl.formatMessage({ id: 'warehouse.detail.location_summary_value', defaultMessage: '{total} total, {occupied} occupied' }, { total: lokasiSummary.total, occupied: lokasiSummary.occupied })}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={intl.formatMessage({ id: 'warehouse.detail.overview_total_locations_label', defaultMessage: 'Total Locations' })}
                value={lokasiSummary.total.toLocaleString('id-ID')}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'warehouse.detail.overview_occupied_locations_label', defaultMessage: 'Occupied Locations' })}
                value={lokasiSummary.occupied.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'warehouse.detail.overview_occupied_locations_hint', defaultMessage: 'Locations currently holding pallets.' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'warehouse.detail.overview_utilization_label', defaultMessage: 'Utilization' })}
                value={`${lokasiSummary.utilization}%`}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'warehouse.detail.overview_maintenance_locations_label', defaultMessage: 'Maintenance Locations' })}
                value={lokasiSummary.maintenance.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'warehouse.detail.overview_maintenance_locations_hint', defaultMessage: 'Locations currently under maintenance.' })}
              />
            </div>
          </div>
        </div>

          <WarehouseLocationTableCard
            intl={intl}
            table={table}
            columns={columns}
            isLoadingLokasi={isLoadingLokasi}
            isFetchingLokasi={isFetchingLokasi}
            lokasiRows={lokasiRows}
            occupiedCount={lokasiSummary.occupied}
            feedbackMessage={feedbackMessage}
            feedbackTone={feedbackTone}
            onOpenExport={() => setExportModalOpen(true)}
            onOpenImport={() => setImportModalOpen(true)}
            onOpenAddLocation={() => setLokasiModalOpen(true)}
          />
      </div>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <Icon icon="solar:trash-bin-trash-linear" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>{intl.formatMessage({ id: 'warehouse.detail.delete_warehouse_title', defaultMessage: 'Delete Warehouse' })}</Modal.Heading>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {intl.formatMessage({ id: 'warehouse.detail.delete_warehouse_description', defaultMessage: 'Warehouse {name} will be removed along with any photo references stored on the server.' }, { name: warehouse.name })}
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-sm text-danger">
                  {intl.formatMessage({ id: 'warehouse.detail.delete_warehouse_warning', defaultMessage: 'Make sure no active operational processes still require this record.' })}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onPress={() => setDeleteModalOpen(false)} isDisabled={isDeletingWarehouse}>
                  {intl.formatMessage({ id: 'warehouse.detail.delete_warehouse.cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void handleDeleteWarehouse()} isPending={isDeletingWarehouse}>
                  {({ isPending }) => (
                    <>
                      <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                      {isPending ? intl.formatMessage({ id: 'warehouse.detail.delete_warehouse.deleting', defaultMessage: 'Deleting Warehouse...' }) : intl.formatMessage({ id: 'warehouse.detail.delete_warehouse.delete', defaultMessage: 'Delete Warehouse' })}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={importModalOpen} onOpenChange={setImportModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-125">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'warehouse.detail.import_modal.title', defaultMessage: 'Import Storage Locations' })}</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {intl.formatMessage({ id: 'warehouse.detail.import_modal.description', defaultMessage: 'Upload a CSV or Excel file to import storage location data.' })}
                </p>
              </Modal.Header>
              <Form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleImport();
                }}
              >
                <Modal.Body className="space-y-4">
                  <div className="p-2">
                    <label className="text-sm font-medium">Pilih File</label>
                    <div className="flex gap-2">
                      <Input
                        value={importFile?.name ?? ''}
                        readOnly
                        variant="primary"
                        placeholder={intl.formatMessage({ id: 'warehouse.detail.import_modal.file_placeholder', defaultMessage: 'Select a CSV/XLSX file' })}
                        className="flex-1"
                      />
                      <label className="inline-flex cursor-pointer items-center rounded-xl border border-default-300 px-3 text-sm font-medium text-foreground hover:bg-default-100">
                        Browse
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="hidden"
                          onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-danger/30 bg-danger/10 text-danger'
                        }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="ghost" onPress={() => setImportModalOpen(false)}>
                    {intl.formatMessage({ id: 'warehouse.detail.import_modal.cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={() => setImportFile(null)}
                    isDisabled={!importFile}
                  >
                    {intl.formatMessage({ id: 'warehouse.detail.import_modal.reset', defaultMessage: 'Reset File' })}
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isImporting || !importFile}>
                    {isImporting
                      ? intl.formatMessage({ id: 'warehouse.detail.import_modal.importing', defaultMessage: 'Importing...' })
                      : intl.formatMessage({ id: 'warehouse.detail.import_modal.import', defaultMessage: 'Import' })}
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
                  {intl.formatMessage({ id: 'warehouse.detail.export_modal.title', defaultMessage: 'Export Storage Locations' })}
                </Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {intl.formatMessage({ id: 'warehouse.detail.export_modal.description', defaultMessage: 'Select a file format to export storage location data.' })}
                </p>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <div className="grid gap-3">
                  <Button
                    variant="primary"
                    isDisabled={isExporting}
                    onPress={() => {
                      void exportLokasi('csv');
                      setExportModalOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Icon icon="solar:file-text-linear" className="size-4" />
                    {intl.formatMessage({ id: 'warehouse.detail.export_modal.export_csv', defaultMessage: 'Export as CSV' })}
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={isExporting}
                    onPress={() => {
                      void exportLokasi('xlsx');
                      setExportModalOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Icon icon="solar:file-linear" className="size-4" />
                    {intl.formatMessage({ id: 'warehouse.detail.export_modal.export_xlsx', defaultMessage: 'Export as XLSX' })}
                  </Button>
                </div>

                {feedbackMessage && (
                  <p
                    className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-danger/30 bg-danger/10 text-danger'
                      }`}
                  >
                    {feedbackMessage}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setExportModalOpen(false)}>
                  {intl.formatMessage({ id: 'warehouse.detail.export_modal.cancel', defaultMessage: 'Cancel' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={lokasiModalOpen} onOpenChange={setLokasiModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-125">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {editingId
                    ? intl.formatMessage({ id: 'warehouse.detail.location_modal_title_edit', defaultMessage: 'Edit Storage Location' })
                    : intl.formatMessage({ id: 'warehouse.detail.location_modal_title_create', defaultMessage: 'Add Storage Location' })}
                </Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {editingId
                    ? intl.formatMessage({ id: 'warehouse.detail.location_modal_description_edit', defaultMessage: 'Update the storage location details.' })
                    : intl.formatMessage({ id: 'warehouse.detail.location_modal_description_create', defaultMessage: 'Add a new storage location.' })}
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
                    <Label>{intl.formatMessage({ id: 'warehouse.detail.location_id_label', defaultMessage: 'Location ID' })}</Label>
                    <Input
                      placeholder={intl.formatMessage({ id: 'warehouse.detail.location_id_placeholder', defaultMessage: 'Enter location ID' })}
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
                            <ListBox.Item key={status}>
                              {status}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-danger/30 bg-danger/10 text-danger'
                        }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="ghost" onPress={() => setLokasiModalOpen(false)}>
                    {intl.formatMessage({ id: 'warehouse.detail.location_modal.cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isSubmitting}>
                    {isSubmitting
                      ? intl.formatMessage({ id: 'warehouse.detail.location_modal.saving', defaultMessage: 'Saving...' })
                      : editingId
                        ? intl.formatMessage({ id: 'warehouse.detail.location_modal.submit_update', defaultMessage: 'Save Changes' })
                        : intl.formatMessage({ id: 'warehouse.detail.location_modal.submit_create', defaultMessage: 'Add Location' })}
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
