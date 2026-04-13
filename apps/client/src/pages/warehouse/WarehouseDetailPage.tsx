import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Dropdown, EmptyState, Form, Input, Label, ListBox, Modal, Select, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

const lokasiStatusValues = ['AKTIF', 'MAINTENANCE', 'PENUH'] as const;
type LokasiStatus = (typeof lokasiStatusValues)[number];

type LokasiRow = {
  id: string;
  status: LokasiStatus;
  palet: {
    id: string;
    jenisPalet: {
      nama: string;
      sku: {
        nama: string;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [lokasiIdInput, setLokasiIdInput] = useState('');
  const [statusInput, setStatusInput] = useState<LokasiStatus>('AKTIF');
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

  const { data: warehouse, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.gudang.detail.query({ id: id ?? '' }),
  });

  const {
    data: lokasiData,
    isLoading: isLoadingLokasi,
    isFetching: isFetchingLokasi,
    refetch: refetchLokasi,
  } = useQuery({
    queryKey: ['warehouseLokasi', id],
    enabled: Boolean(id),
    queryFn: () =>
      trpcClient.warehouse.lokasiPenyimpanan.list.query({
        gudangId: id,
      }),
  });

  const lokasiRows = useMemo(() => (lokasiData?.data ?? []) as LokasiRow[], [lokasiData?.data]);
  const lokasiSummary = useMemo(() => {
    const total = lokasiRows.length;
    const aktif = lokasiRows.filter((row) => row.status === 'AKTIF').length;
    const maintenance = lokasiRows.filter((row) => row.status === 'MAINTENANCE').length;
    const penuh = lokasiRows.filter((row) => row.status === 'PENUH').length;
    const occupied = lokasiRows.filter((row) => row.palet).length;
    const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { aktif, maintenance, occupied, penuh, total, utilization };
  }, [lokasiRows]);

  const resetLokasiForm = () => {
    setEditingId(null);
    setLokasiIdInput('');
    setStatusInput('AKTIF');
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
      setFeedback('danger', intl.formatMessage({ id: 'warehouse.detail.feedbackLocationIdRequired', defaultMessage: 'Location ID is required.' }));
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      if (editingId) {
        await trpcClient.warehouse.lokasiPenyimpanan.update.mutate({
          currentId: editingId,
          id: lokasiIdInput.trim(),
          gudangId: id,
          status: statusInput,
        });
        setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedbackLocationUpdated', defaultMessage: 'Storage location updated successfully.' }));
      } else {
        await trpcClient.warehouse.lokasiPenyimpanan.create.mutate({
          id: lokasiIdInput.trim(),
          gudangId: id,
          status: statusInput,
        });
        setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedbackLocationAdded', defaultMessage: 'Storage location added successfully.' }));
      }

      resetLokasiForm();
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedbackLocationSaveFailed', defaultMessage: 'Failed to save storage location.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLokasi = async (lokasiId: string) => {
    if (!confirm(intl.formatMessage({ id: 'warehouse.detail.confirmDeleteLocation', defaultMessage: 'Delete this storage location?' }))) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.warehouse.lokasiPenyimpanan.delete.mutate({ id: lokasiId });
      setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedbackLocationDeleted', defaultMessage: 'Storage location deleted successfully.' }));
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedbackLocationDeleteFailed', defaultMessage: 'Failed to delete storage location.' }));
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!warehouse || isDeletingWarehouse) {
      return;
    }

    setIsDeletingWarehouse(true);
    try {
      await trpcClient.warehouse.gudang.delete.mutate({ id: warehouse.id });
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouse.id] });
      queryClient.removeQueries({ queryKey: ['warehouseLokasi', warehouse.id] });
      setDeleteModalOpen(false);
      navigate('/warehouse');
    } catch (error) {
      setDeleteModalOpen(false);
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.errors.deleteFailed', defaultMessage: 'Failed to delete warehouse.' }));
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
      const rows = await trpcClient.warehouse.lokasiPenyimpanan.exportAll.query({ gudangId: id });
      const exportRows: ExportRow[] = rows.map((row) => ({
        ID: row.id,
        Status: row.status,
        PaletID: row.palet?.id ?? '-',
        JenisPalet: row.palet?.jenisPalet.nama ?? '-',
        SKU: row.palet?.jenisPalet.sku.nama ?? '-',
      }));

      const sheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Lokasi');

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const baseName = `lokasi-${sanitizeFileSegment(warehouse.nama)}-${timestamp}`;

      if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(sheet);
        downloadBlob(csv, `${baseName}.csv`, 'text/csv;charset=utf-8;');
      } else {
        const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        downloadBlob(xlsxBuffer, `${baseName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }

      setFeedback('success', intl.formatMessage({ id: 'warehouse.detail.feedbackExportSuccess', defaultMessage: 'Export completed successfully.' }));
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedbackExportFailed', defaultMessage: 'Export failed.' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!id || !importFile) {
      setFeedback('danger', intl.formatMessage({ id: 'warehouse.detail.feedbackImportFileRequired', defaultMessage: 'Please select a CSV/XLSX file first.' }));
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
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.importErrorSheetMissing', defaultMessage: 'No sheet found in the import file.' }));
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        raw: false,
      });

      if (rows.length === 0) {
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.importErrorEmptyFile', defaultMessage: 'The import file is empty.' }));
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
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.importErrorNoValidRows', defaultMessage: 'No valid data rows found to import.' }));
      }

      const invalidStatus = parsed.find(
        (row) => row.status.length > 0 && !lokasiStatusValues.includes(row.status as LokasiStatus)
      );
      if (invalidStatus) {
        throw new Error(intl.formatMessage({ id: 'warehouse.detail.importErrorInvalidStatus', defaultMessage: 'Invalid status for ID {id}: {status}' }, { id: invalidStatus.id, status: invalidStatus.status }));
      }

      const importResult = await trpcClient.warehouse.lokasiPenyimpanan.importBatch.mutate({
        gudangId: id,
        rows: parsed.map((row) => ({
          id: row.id,
          status: row.status.length > 0 ? (row.status as LokasiStatus) : undefined,
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
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'warehouse.detail.feedbackImportFailed', defaultMessage: 'Import failed.' }));
    } finally {
      setIsImporting(false);
    }
  };

  const columns = useMemo<ColumnDef<LokasiRow>[]>(
    () => [
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
            color={row.original.status === 'AKTIF' ? 'success' : row.original.status === 'MAINTENANCE' ? 'warning' : 'danger'}
          >
            {row.original.status}
          </Chip>
        ),
      },
      {
        id: 'palet',
        header: intl.formatMessage({ id: 'warehouse.detail.locationTableHeaderPallet', defaultMessage: 'Pallet' }),
        cell: ({ row }) => (row.original.palet ? row.original.palet.id : '-'),
      },
      {
        id: 'jenisPalet',
        header: intl.formatMessage({ id: 'warehouse.detail.locationTableHeaderPalletType', defaultMessage: 'Pallet Type' }),
        cell: ({ row }) => row.original.palet?.jenisPalet.nama ?? '-',
      },
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => row.original.palet?.jenisPalet.sku.nama ?? '-',
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
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'warehouse.detail.locationActionsMenuAria', defaultMessage: 'Location actions' })}>
                <Dropdown.Item
                  key="edit"
                  onPress={() => startEdit(row.original)}
                >
                  <Icon icon="solar:pen-linear" className="size-4" />
                  {intl.formatMessage({ id: 'warehouse.detail.locationActionEdit', defaultMessage: 'Edit location' })}
                </Dropdown.Item>
                <Dropdown.Item
                  key="delete"
                  variant="danger"
                  onPress={() => void handleDeleteLokasi(row.original.id)}
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  {intl.formatMessage({ id: 'warehouse.detail.locationActionDelete', defaultMessage: 'Delete location' })}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: lokasiRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoadingWarehouse) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'warehouse.detail.loadingDetail', defaultMessage: 'Loading warehouse details...' })}</p>;
  }

  if (!warehouse) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'warehouse.detail.notFound', defaultMessage: 'Warehouse not found.' })}</p>
        <Button variant="ghost" onPress={() => navigate('/warehouse')}>
          {intl.formatMessage({ id: 'warehouse.detail.backToWarehouses', defaultMessage: 'Back to Warehouses' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96)_48%,rgba(37,99,235,0.88))] text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <Card.Content className="grid gap-6 p-6 md:grid-cols-[280px_1fr] md:p-8">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/12 bg-white/6 p-3 backdrop-blur-sm">
              <EntityPhoto src={warehouse.foto} alt={warehouse.nama} className="h-64 w-full rounded-[1.4rem] border border-white/12 object-cover" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Warehouse ID</p>
              <p className="mt-2 font-mono text-sm text-white">{warehouse.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  <Icon icon="solar:buildings-2-linear" className="size-4" />
                  Warehouse Operations
                </div>
                <div>
                  <Card.Title className="text-3xl text-white">{warehouse.nama}</Card.Title>
                  <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                    {intl.formatMessage({ id: 'warehouse.detail.overviewDescription', defaultMessage: 'Manage warehouse identity, storage location distribution, and operational readiness from a concise dashboard.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft" color="success">
                    {intl.formatMessage({ id: 'warehouse.detail.activeLocationsLabel', defaultMessage: '{count} active locations' }, { count: lokasiSummary.aktif })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={lokasiSummary.penuh > 0 ? 'warning' : 'success'}>
                    {intl.formatMessage({ id: 'warehouse.detail.occupiedLocationsLabel', defaultMessage: '{count} occupied locations' }, { count: lokasiSummary.occupied })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={lokasiSummary.maintenance > 0 ? 'warning' : 'default'}>
                    {intl.formatMessage({ id: 'warehouse.detail.maintenanceLocationsLabel', defaultMessage: '{count} maintenance locations' }, { count: lokasiSummary.maintenance })}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="secondary" onPress={() => navigate(`/warehouse/${warehouse.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'warehouse.detail.editWarehouseButton', defaultMessage: 'Edit Warehouse' })}
                </Button>
                <Button variant="danger" onPress={() => setDeleteModalOpen(true)}>
                  <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'warehouse.detail.deleteWarehouseButton', defaultMessage: 'Delete Warehouse' })}
                </Button>
                <Button variant="ghost" onPress={() => navigate('/warehouse')}>
                  <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'warehouse.detail.backToWarehouseListButton', defaultMessage: 'Back' })}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                  {intl.formatMessage({ id: 'warehouse.detail.overviewAddressLabel', defaultMessage: 'Address' })}
                </p>
                <p className="mt-2 text-sm leading-6 text-white">{warehouse.alamat}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                  {intl.formatMessage({ id: 'warehouse.detail.overviewTotalCapacityLabel', defaultMessage: 'Total Capacity' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{warehouse.kapasitasTotal?.toLocaleString('id-ID') ?? '-'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                  {intl.formatMessage({ id: 'warehouse.detail.overviewLocationUtilizationLabel', defaultMessage: 'Location Utilization' })}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{lokasiSummary.utilization}%</p>
                <p className="mt-1 text-xs text-white/60">
                  {intl.formatMessage({ id: 'warehouse.detail.overviewLocationUtilizationSummary', defaultMessage: '{occupied} of {total} locations occupied' }, { occupied: lokasiSummary.occupied, total: lokasiSummary.total })}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                  {intl.formatMessage({ id: 'warehouse.detail.overviewLocationConditionLabel', defaultMessage: 'Location Condition' })}
                </p>
                <div className="mt-2 space-y-1 text-sm text-white/88">
                  <p>{intl.formatMessage({ id: 'warehouse.detail.overviewConditionActive', defaultMessage: 'Active' })}: {lokasiSummary.aktif}</p>
                  <p>{intl.formatMessage({ id: 'warehouse.detail.overviewConditionFull', defaultMessage: 'Full' })}: {lokasiSummary.penuh}</p>
                  <p>{intl.formatMessage({ id: 'warehouse.detail.overviewConditionMaintenance', defaultMessage: 'Maintenance' })}: {lokasiSummary.maintenance}</p>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">{intl.formatMessage({ id: 'warehouse.detail.operationalSnapshotTitle', defaultMessage: 'Operational Snapshot' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'warehouse.detail.operationalSnapshotDescription', defaultMessage: 'Quick summary to help evaluate capacity and location status.' })}</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{intl.formatMessage({ id: 'warehouse.detail.addressLabel', defaultMessage: 'Warehouse Address' })}</p>
              <p className="mt-2 text-sm leading-6 text-foreground">{warehouse.alamat}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{intl.formatMessage({ id: 'warehouse.detail.recordedCapacityLabel', defaultMessage: 'Recorded Capacity' })}</p>
              <p className="mt-2 text-sm text-foreground">{warehouse.kapasitasTotal?.toLocaleString('id-ID') ?? '-'} unit</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{intl.formatMessage({ id: 'warehouse.detail.registeredLocationsLabel', defaultMessage: 'Registered Locations' })}</p>
              <p className="mt-2 text-sm text-foreground">
                {intl.formatMessage({ id: 'warehouse.detail.registeredLocationsSummary', defaultMessage: '{total} locations with {occupied} occupied pallets.' }, { total: lokasiSummary.total, occupied: lokasiSummary.occupied })}
              </p>
            </div>
          </Card.Content>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">{intl.formatMessage({ id: 'warehouse.detail.actionCenterTitle', defaultMessage: 'Action Center' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'warehouse.detail.actionCenterDescription', defaultMessage: 'Quick access for master data operations and location distribution.' })}</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Button variant="primary" fullWidth onPress={() => setLokasiModalOpen(true)}>
              <Icon icon="solar:add-circle-linear" className="size-4" />
              {intl.formatMessage({ id: 'warehouse.detail.addStorageLocationButton', defaultMessage: 'Add Storage Location' })}
            </Button>
            <Button variant="secondary" fullWidth onPress={() => setImportModalOpen(true)}>
              <Icon icon="solar:upload-linear" className="size-4" />
              {intl.formatMessage({ id: 'warehouse.detail.importLocationButton', defaultMessage: 'Import Locations' })}
            </Button>
            <Button variant="secondary" fullWidth onPress={() => setExportModalOpen(true)}>
              <Icon icon="solar:download-linear" className="size-4" />
              {intl.formatMessage({ id: 'warehouse.detail.exportLocationButton', defaultMessage: 'Export Locations' })}
            </Button>
            <Button variant="ghost" fullWidth onPress={() => navigate(`/warehouse/${warehouse.id}/edit`)}>
              <Icon icon="solar:pen-linear" className="size-4" />
              {intl.formatMessage({ id: 'warehouse.detail.editWarehouseDetailsButton', defaultMessage: 'Edit Warehouse Details' })}
            </Button>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <Card.Title className="text-base">{intl.formatMessage({ id: 'warehouse.detail.storageLocationTitle', defaultMessage: 'Storage Locations' })}</Card.Title>
                <Card.Description>{intl.formatMessage({ id: 'warehouse.detail.storageLocationDescription', defaultMessage: 'Location table for this warehouse, including status, pallet occupancy, and change controls.' })}</Card.Description>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onPress={() => setExportModalOpen(true)}>
                  {intl.formatMessage({ id: 'warehouse.detail.exportDataButton', defaultMessage: 'Export Data' })}
                </Button>
                <Button variant="primary" onPress={() => setImportModalOpen(true)}>
                  {intl.formatMessage({ id: 'warehouse.detail.importDataButton', defaultMessage: 'Import Data' })}
                </Button>
                <Button variant="primary" onPress={() => setLokasiModalOpen(true)}>
                  <Icon icon="solar:add-circle-linear" className="size-4" />
                  {intl.formatMessage({ id: 'warehouse.detail.addLocationButton', defaultMessage: 'Add Location' })}
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
              <Table.Content aria-label={intl.formatMessage({ id: 'warehouse.detail.storageLocationsTableAria', defaultMessage: 'Storage locations table' })} className="min-w-full">
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
                      <span className="text-sm text-muted">{intl.formatMessage({ id: 'warehouse.detail.storageLocationEmptyState', defaultMessage: 'No storage locations found.' })}</span>
                    </EmptyState>
                  )}
                >
                  {isLoadingLokasi || isFetchingLokasi ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'warehouse.detail.storageLocationLoading', defaultMessage: 'Loading storage locations...' })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id}>
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
                {intl.formatMessage({ id: 'warehouse.detail.storageLocationSummary', defaultMessage: '{total} locations found, {occupied} occupied' }, { total: lokasiRows.length, occupied: lokasiSummary.occupied })}
              </span>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <Icon icon="solar:trash-bin-trash-linear" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>{intl.formatMessage({ id: 'warehouse.detail.deleteWarehouseTitle', defaultMessage: 'Delete Warehouse' })}</Modal.Heading>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {intl.formatMessage({ id: 'warehouse.detail.deleteWarehouseDescription', defaultMessage: 'Warehouse {name} will be removed along with any photo references stored on the server.' }, { name: warehouse.nama })}
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-sm text-danger">
                  {intl.formatMessage({ id: 'warehouse.detail.deleteWarehouseWarning', defaultMessage: 'Make sure no active operational processes still require this record.' })}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setDeleteModalOpen(false)} isDisabled={isDeletingWarehouse}>
                  {intl.formatMessage({ id: 'warehouse.detail.deleteWarehouse.cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void handleDeleteWarehouse()} isPending={isDeletingWarehouse}>
                  {({ isPending }) => (
                    <>
                      <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                      {isPending ? intl.formatMessage({ id: 'warehouse.detail.deleteWarehouse.deleting', defaultMessage: 'Deleting Warehouse...' }) : intl.formatMessage({ id: 'warehouse.detail.deleteWarehouse.delete', defaultMessage: 'Delete Warehouse' })}
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
                <Modal.Heading>{intl.formatMessage({ id: 'warehouse.detail.importModal.title', defaultMessage: 'Import Storage Locations' })}</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {intl.formatMessage({ id: 'warehouse.detail.importModal.description', defaultMessage: 'Upload a CSV or Excel file to import storage location data.' })}
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
                        variant="secondary"
                        placeholder={intl.formatMessage({ id: 'warehouse.detail.importModal.filePlaceholder', defaultMessage: 'Select a CSV/XLSX file' })}
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
                    {intl.formatMessage({ id: 'warehouse.detail.importModal.cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={() => setImportFile(null)}
                    isDisabled={!importFile}
                  >
                    {intl.formatMessage({ id: 'warehouse.detail.importModal.reset', defaultMessage: 'Reset File' })}
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isImporting || !importFile}>
                    {isImporting
                      ? intl.formatMessage({ id: 'warehouse.detail.importModal.importing', defaultMessage: 'Importing...' })
                      : intl.formatMessage({ id: 'warehouse.detail.importModal.import', defaultMessage: 'Import' })}
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
                  {intl.formatMessage({ id: 'warehouse.detail.exportModal.title', defaultMessage: 'Export Storage Locations' })}
                </Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {intl.formatMessage({ id: 'warehouse.detail.exportModal.description', defaultMessage: 'Select a file format to export storage location data.' })}
                </p>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <div className="grid gap-3">
                  <Button
                    variant="secondary"
                    isDisabled={isExporting}
                    onPress={() => {
                      void exportLokasi('csv');
                      setExportModalOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Icon icon="solar:file-text-linear" className="size-4" />
                    {intl.formatMessage({ id: 'warehouse.detail.exportModal.exportCsv', defaultMessage: 'Export as CSV' })}
                  </Button>
                  <Button
                    variant="secondary"
                    isDisabled={isExporting}
                    onPress={() => {
                      void exportLokasi('xlsx');
                      setExportModalOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Icon icon="solar:file-linear" className="size-4" />
                    {intl.formatMessage({ id: 'warehouse.detail.exportModal.exportXlsx', defaultMessage: 'Export as XLSX' })}
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
                  {intl.formatMessage({ id: 'warehouse.detail.exportModal.cancel', defaultMessage: 'Cancel' })}
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
                    ? intl.formatMessage({ id: 'warehouse.detail.locationModalTitleEdit', defaultMessage: 'Edit Storage Location' })
                    : intl.formatMessage({ id: 'warehouse.detail.locationModalTitleCreate', defaultMessage: 'Add Storage Location' })}
                </Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {editingId
                    ? intl.formatMessage({ id: 'warehouse.detail.locationModalDescriptionEdit', defaultMessage: 'Update the storage location details.' })
                    : intl.formatMessage({ id: 'warehouse.detail.locationModalDescriptionCreate', defaultMessage: 'Add a new storage location.' })}
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
                    <Label>{intl.formatMessage({ id: 'warehouse.detail.locationIdLabel', defaultMessage: 'Location ID' })}</Label>
                    <Input
                      placeholder={intl.formatMessage({ id: 'warehouse.detail.locationIdPlaceholder', defaultMessage: 'Enter location ID' })}
                      value={lokasiIdInput}
                      onChange={(event) => setLokasiIdInput(event.target.value)}
                      variant="secondary"
                    />
                  </TextField>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                      selectedKey={statusInput}
                      onSelectionChange={(key) => setStatusInput(key as LokasiStatus)}
                      variant="secondary"
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
                    {intl.formatMessage({ id: 'warehouse.detail.locationModal.cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isSubmitting}>
                    {isSubmitting
                      ? intl.formatMessage({ id: 'warehouse.detail.locationModal.saving', defaultMessage: 'Saving...' })
                      : editingId
                        ? intl.formatMessage({ id: 'warehouse.detail.locationModal.submitUpdate', defaultMessage: 'Save Changes' })
                        : intl.formatMessage({ id: 'warehouse.detail.locationModal.submitCreate', defaultMessage: 'Add Location' })}
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
