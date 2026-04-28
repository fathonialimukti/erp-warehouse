import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Label,
  Modal,
  Pagination,
  SearchField,
  Spinner,
  Table,
  TextArea,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { inferProcedureInput, inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { PageHeader } from '../../../components/PageHeader';
import { hasPermissionAtom } from '../../../lib/atoms';

type PutawayPreviewOutput = inferProcedureOutput<AppRouter['inboundTransaction']['getAssignmentData']>;
type PutawayAssignInput = inferProcedureInput<AppRouter['inboundTransaction']['SubmitPalletAssignment']>;
type AllPallet = PutawayPreviewOutput['allPallets'][number];
type Pair = { palletId: string; storageLocationId: string };

const LOCATIONS_PER_PAGE = 10;

const parseId = (id: string): { type: 'pallet' | 'location'; value: string } | null => {
  if (id.startsWith('pallet::')) return { type: 'pallet', value: id.slice(8) };
  if (id.startsWith('location::')) return { type: 'location', value: id.slice(10) };
  return null;
};

// ---------------------------------------------------------------------------
// Drag overlay ghost preview
// ---------------------------------------------------------------------------

interface ActiveDragPreviewProps {
  activeId: string;
  allPallets: AllPallet[];
}

const ActiveDragPreview = ({ activeId, allPallets }: ActiveDragPreviewProps) => {
  const parsed = parseId(activeId);
  if (!parsed) return null;

  if (parsed.type === 'pallet') {
    const pallet = allPallets.find((p) => p.palletId === parsed.value);
    if (!pallet) return null;
    return (
      <div className="flex items-center gap-4 rounded-lg border border-divider bg-content1 px-3 py-2.5 shadow-xl cursor-grabbing">
        <span className="font-mono text-xs text-foreground/60">{pallet.palletId}</span>
        <span className="text-sm">{pallet.palletTypeName}</span>
        <span className="text-sm text-foreground/70">{pallet.skuName}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center rounded-lg border border-divider bg-content1 px-3 py-2.5 shadow-xl cursor-grabbing">
      <span className="font-mono text-xs text-foreground/60">{parsed.value}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Draggable + Droppable row components
// ---------------------------------------------------------------------------

interface DraggablePalletRowProps {
  pallet: AllPallet;
  activeId: string | null;
}

const DraggablePalletRow = ({ pallet, activeId }: DraggablePalletRowProps) => {
  const dndId = `pallet::${pallet.palletId}`;
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({ id: dndId });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dndId });

  const highlight = isOver && Boolean(activeId?.startsWith('location::'));

  return (
    <Table.Row
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`select-none cursor-grab transition-colors ${highlight ? 'bg-primary/10 outline-1 outline-primary/40' : 'hover:bg-default-50'}`}
    >
      <Table.Cell>
        <span className="font-mono text-xs text-foreground/60">{pallet.palletId}</span>
      </Table.Cell>
      <Table.Cell>{pallet.palletTypeName}</Table.Cell>
      <Table.Cell>{pallet.skuName}</Table.Cell>
    </Table.Row>
  );
};

interface DraggableLocationRowProps {
  locationId: string;
  activeId: string | null;
}

const DraggableLocationRow = ({ locationId, activeId }: DraggableLocationRowProps) => {
  const dndId = `location::${locationId}`;
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({ id: dndId });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dndId });

  const highlight = isOver && Boolean(activeId?.startsWith('pallet::'));

  return (
    <Table.Row
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`select-none cursor-grab transition-colors ${highlight ? 'bg-primary/10 outline-1 outline-primary/40' : 'hover:bg-default-50'}`}
    >
      <Table.Cell>
        <span className="font-mono text-xs text-foreground/60">{locationId}</span>
      </Table.Cell>
    </Table.Row>
  );
};

function InboundPalletAssignationPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canReadPutaway = hasPermission('inbound_transaction@read') || hasPermission('inbound_transaction@assign');
  const canAssignPutaway = hasPermission('inbound_transaction@assign');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [locationPage, setLocationPage] = useState(1);
  const [palletSearch, setPalletSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { data, isLoading, isError, error } = useQuery<PutawayPreviewOutput>({
    queryKey: ['putawayPreview', id],
    queryFn: () => trpcClient.inboundTransaction.getAssignmentData.query({ inboundTransactionId: id! }),
    enabled: Boolean(id) && canReadPutaway,
  });

  console.log('Putaway preview data:', data);

  const allPallets = useMemo(() => data?.allPallets ?? [], [data]);
  const availableLocations = useMemo(() => data?.availableLocations ?? [], [data]);
  const filteredLocations = useMemo(
    () => availableLocations.filter((location) =>
      location.id.toLowerCase().includes(locationSearch.trim().toLowerCase()),
    ),
    [availableLocations, locationSearch],
  );

  useEffect(() => {
    setLocationPage(1);
  }, [locationSearch]);

  useEffect(() => {
    if (data?.allPallets) {
      const currentPairs = data.allPallets
        .filter(p => p.storageLocationId)
        .map(p => ({ palletId: p.palletId, storageLocationId: p.storageLocationId! }));
      setPairs(currentPairs);
    }
  }, [data]);

  const pairedPalletIds = useMemo(() => new Set(pairs.map((p) => p.palletId)), [pairs]);
  const pairedLocationIds = useMemo(() => new Set(pairs.map((p) => p.storageLocationId)), [pairs]);

  const unassignedPallets = useMemo(
    () => allPallets.filter((p) => !pairedPalletIds.has(p.palletId)),
    [allPallets, pairedPalletIds],
  );
  const filteredUnassignedPallets = useMemo(
    () => unassignedPallets.filter((pallet) =>
      pallet.palletId.toLowerCase().includes(palletSearch.trim().toLowerCase()) ||
      pallet.palletTypeName.toLowerCase().includes(palletSearch.trim().toLowerCase()) ||
      pallet.skuName.toLowerCase().includes(palletSearch.trim().toLowerCase()),
    ),
    [unassignedPallets, palletSearch],
  );

  const unassignedLocations = useMemo(
    () => filteredLocations.filter((location) => !pairedLocationIds.has(location.id)),
    [filteredLocations, pairedLocationIds],
  );

  const filteredPairs = useMemo(
    () => pairs.filter((pair) => {
      const pallet = allPallets.find((p) => p.palletId === pair.palletId);
      return (
        pair.palletId.toLowerCase().includes(resultSearch.trim().toLowerCase()) ||
        pallet?.palletTypeName.toLowerCase().includes(resultSearch.trim().toLowerCase()) ||
        pallet?.skuName.toLowerCase().includes(resultSearch.trim().toLowerCase()) ||
        pair.storageLocationId.toLowerCase().includes(resultSearch.trim().toLowerCase())
      );
    }),
    [pairs, allPallets, resultSearch],
  );

  const totalLocationPages = Math.max(1, Math.ceil(unassignedLocations.length / LOCATIONS_PER_PAGE));
  const safeLocationPage = Math.min(locationPage, totalLocationPages);
  const pagedLocations = unassignedLocations.slice(
    (safeLocationPage - 1) * LOCATIONS_PER_PAGE,
    safeLocationPage * LOCATIONS_PER_PAGE,
  );

  const startLocationIndex = Math.min((safeLocationPage - 1) * LOCATIONS_PER_PAGE + 1, unassignedLocations.length);
  const endLocationIndex = Math.min(safeLocationPage * LOCATIONS_PER_PAGE, unassignedLocations.length);

  const getLocationPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalLocationPages <= 7) {
      return Array.from({ length: totalLocationPages }, (_, index) => index + 1);
    }

    pages.push(1);
    if (locationPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, locationPage - 1);
    const end = Math.min(totalLocationPages - 1, locationPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (locationPage < totalLocationPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalLocationPages);
    return pages;
  };


  const handleApplySuggestedAssignments = () => {
    if (!data?.suggestedAssignments?.length) return;
    setPairs(
      data.suggestedAssignments.map((a) => ({
        palletId: a.palletId,
        storageLocationId: a.storageLocationId,
      })),
    );
  };

  const handleClearAssignments = () => setPairs([]);

  const handleRemovePair = (palletId: string) => {
    setPairs((current) => current.filter((p) => p.palletId !== palletId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const src = parseId(String(active.id));
    const dst = parseId(String(over.id));
    if (!src || !dst || src.type === dst.type) return;

    const palletId = src.type === 'pallet' ? src.value : dst.value;
    const locationId = src.type === 'location' ? src.value : dst.value;

    setPairs((current) => {
      const filtered = current.filter(
        (p) => p.palletId !== palletId && p.storageLocationId !== locationId,
      );
      return [...filtered, { palletId, storageLocationId: locationId }];
    });
  };

  const assignMutation = useMutation<unknown, unknown, PutawayAssignInput>({
    mutationFn: (payload) => trpcClient.inboundTransaction.SubmitPalletAssignment.mutate(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['putawayPreview', id] }),
        queryClient.invalidateQueries({ queryKey: ['inboundTransactionDetail', id] }),
        queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] }),
      ]);
      setIsConfirmOpen(false);
      navigate(`/transactions/inbound/${id!}`);
    },
  });

  const hasPendingPallets = allPallets.length > 0;
  const assignedPalletCount = pairs.length;
  const hasSuggestedAssignments = Boolean(data?.suggestedAssignments?.length);
  const canAutoAssign = hasSuggestedAssignments && assignedPalletCount < allPallets.length;
  const canSubmit = canAssignPutaway && hasPendingPallets && !data?.hasInsufficientLocations && assignedPalletCount >= 0;

  const handleConfirmAssign = async () => {
    if (!id || !canSubmit) return;
    await assignMutation.mutateAsync({
      inboundTransactionId: id,
      assignments: pairs.map((p) => ({
        palletId: p.palletId,
        storageLocationId: p.storageLocationId,
      })),
      message: assignmentMessage.trim() || undefined,
    });
  };

  if (!canReadPutaway) {
    return (
      <section className="space-y-6">
        <PageHeader
          title={intl.formatMessage({ id: 'putaway.page_title', defaultMessage: 'Inbound Putaway Assignment' })}
          onBack={() => navigate(`/transactions/inbound/${id ?? ''}`)}
        />
        <EmptyState>
          {intl.formatMessage({ id: 'putaway.access_denied', defaultMessage: 'You do not have permission to access putaway assignments.' })}
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'putaway.page_title', defaultMessage: 'Inbound Putaway Assignment' })}
        onBack={() => navigate(`/transactions/inbound/${id!}`)}
      />
      <p className="text-sm text-muted">
        {intl.formatMessage({ id: 'putaway.page_subtitle', defaultMessage: 'Drag pallets onto storage locations (or vice versa) to create assignments, then confirm once complete.' })}
      </p>

      {isLoading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'putaway.loading', defaultMessage: 'Loading putaway suggestions...' })}
          </p>
        </div>
      ) : isError ? (
        <Card>
          <Card.Content>
            <p className="text-sm text-danger">{error instanceof Error ? error.message : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' })}</p>
          </Card.Content>
        </Card>
      ) : !data ? (
        <EmptyState>
          {intl.formatMessage({ id: 'putaway.empty_preview', defaultMessage: 'No assignment preview available.' })}
        </EmptyState>
      ) : (
        <>
          {/* Summary card */}
          <Card>
            <Card.Header>
              <Card.Title>
                {intl.formatMessage({ id: 'putaway.summary_title', defaultMessage: 'Assignment Summary' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage(
                  { id: 'putaway.summary_description', defaultMessage: '{all} pallets · {locations} available ACTIVE locations in this warehouse.' },
                  { all: allPallets.length, locations: data.availableLocationCount },
                )}
              </Card.Description>
            </Card.Header>
            {data.hasInsufficientLocations && (
              <Card.Content>
                <p className="text-sm text-danger">
                  {intl.formatMessage({ id: 'putaway.insufficient_locations', defaultMessage: 'Not enough active locations to assign all pallets.' })}
                </p>
              </Card.Content>
            )}
          </Card>

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {intl.formatMessage(
                { id: 'putaway.assignment_progress', defaultMessage: '{assigned} of {total} pallets assigned' },
                { assigned: assignedPalletCount, total: allPallets.length },
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onPress={handleApplySuggestedAssignments}
                isDisabled={!canAutoAssign || assignMutation.isPending}
              >
                {intl.formatMessage({ id: 'putaway.auto_assign_button', defaultMessage: 'Use Suggested Assignments' })}
              </Button>
              <Button
                variant="ghost"
                onPress={handleClearAssignments}
                isDisabled={assignedPalletCount === 0 || assignMutation.isPending}
              >
                {intl.formatMessage({ id: 'putaway.clear_assignments', defaultMessage: 'Clear Assignments' })}
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Top: two source tables side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: unassigned pallets */}
              <Card>
                <Card.Header>
                  <Card.Title>
                    {intl.formatMessage({ id: 'putaway.pallets_table_title', defaultMessage: 'Unassigned Pallets' })}
                  </Card.Title>
                  <Card.Description>
                    {intl.formatMessage(
                      { id: 'putaway.unassigned_pallets_count', defaultMessage: '{count} pallet(s) remaining' },
                      { count: unassignedPallets.length },
                    )}
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <SearchField
                    variant="secondary"
                    fullWidth
                    id="pallet-search"
                    value={palletSearch}
                    onChange={setPalletSearch}
                    aria-label={intl.formatMessage({ id: 'putaway.pallet_search_label', defaultMessage: 'Search pallets' })}
                  >
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder={intl.formatMessage({ id: 'putaway.pallet_search_label', defaultMessage: 'Search pallets' })} />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content
                        aria-label={intl.formatMessage({ id: 'putaway.pallets_table_aria', defaultMessage: 'Unassigned pallets' })}
                      >
                        <Table.Header>
                          <Table.Column isRowHeader>{intl.formatMessage({ id: 'putaway.col_pallet_id', defaultMessage: 'Pallet ID' })}</Table.Column>
                          <Table.Column>{intl.formatMessage({ id: 'putaway.col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                          <Table.Column>{intl.formatMessage({ id: 'putaway.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        </Table.Header>
                        <Table.Body
                          renderEmptyState={() => (
                            <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                              <Icon className="size-6 text-muted" icon="gravity-ui:tray" />
                              <span className="text-sm text-muted">
                                {palletSearch.trim()
                                  ? intl.formatMessage({ id: 'putaway.no_pallets_found', defaultMessage: 'No pallets match your search.' })
                                  : intl.formatMessage({ id: 'putaway.all_pallets_assigned', defaultMessage: 'All pallets have been assigned.' })}
                              </span>
                            </EmptyState>
                          )}
                        >
                          {filteredUnassignedPallets.map((pallet) => (
                            <DraggablePalletRow key={pallet.palletId} pallet={pallet} activeId={activeId} />
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </Card.Content>
              </Card>

              {/* Right: available storage locations */}
              <Card>
                <Card.Header>
                  <Card.Title>
                    {intl.formatMessage({ id: 'putaway.available_locations_title', defaultMessage: 'Available Storage Locations' })}
                  </Card.Title>
                  <Card.Description>
                    {intl.formatMessage(
                      { id: 'putaway.available_locations_count', defaultMessage: '{count} location(s) available' },
                      { count: unassignedLocations.length },
                    )}
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <SearchField
                  variant="secondary"
                    fullWidth
                    id="location-search"
                    value={locationSearch}
                    onChange={setLocationSearch}
                    aria-label={intl.formatMessage({ id: 'putaway.location_search_label', defaultMessage: 'Search locations' })}
                  >
                    <SearchField.Group>
                      <SearchField.Input placeholder={intl.formatMessage({ id: 'putaway.location_search_label', defaultMessage: 'Search locations' })} />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content
                        aria-label={intl.formatMessage({ id: 'putaway.locations_table_aria', defaultMessage: 'Available storage locations' })}
                      >
                        <Table.Header>
                          <Table.Column isRowHeader>{intl.formatMessage({ id: 'putaway.col_storage_location', defaultMessage: 'Storage Location' })}</Table.Column>
                        </Table.Header>
                        <Table.Body
                          renderEmptyState={() => (
                            <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                              <Icon className="size-6 text-muted" icon="gravity-ui:tray" />
                              <span className="text-sm text-muted">
                                {locationSearch.trim()
                                  ? intl.formatMessage({ id: 'putaway.no_locations_found', defaultMessage: 'No locations match your search.' })
                                  : intl.formatMessage({ id: 'putaway.no_available_locations', defaultMessage: 'No active empty storage locations are currently available.' })}
                              </span>
                            </EmptyState>
                          )}
                        >
                          {pagedLocations.map((location) => (
                            <DraggableLocationRow key={location.id} locationId={location.id} activeId={activeId} />
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                  {totalLocationPages > 1 && (
                    <div className="mt-3 flex justify-end">
                      <Pagination className="w-full justify-between" size="sm">
                        <Pagination.Summary>
                          {intl.formatMessage(
                            { id: 'putaway.pagination_summary', defaultMessage: 'Showing {start}-{end} of {total} locations' },
                            {
                              start: startLocationIndex,
                              end: endLocationIndex,
                              total: unassignedLocations.length,
                            },
                          )}
                        </Pagination.Summary>
                        <Pagination.Content>
                          <Pagination.Item>
                            <Pagination.Previous
                              isDisabled={safeLocationPage === 1}
                              onPress={() => setLocationPage((p) => Math.max(1, p - 1))}
                            >
                              <Pagination.PreviousIcon />
                              Prev
                            </Pagination.Previous>
                          </Pagination.Item>
                          {getLocationPageNumbers().map((page, index) =>
                            page === 'ellipsis' ? (
                              <Pagination.Item key={`ellipsis-${index}`}>
                                <Pagination.Ellipsis />
                              </Pagination.Item>
                            ) : (
                              <Pagination.Item key={page}>
                                <Pagination.Link isActive={page === safeLocationPage} onPress={() => setLocationPage(page)}>
                                  {page}
                                </Pagination.Link>
                              </Pagination.Item>
                            ),
                          )}
                          <Pagination.Item>
                            <Pagination.Next
                              isDisabled={safeLocationPage === totalLocationPages}
                              onPress={() => setLocationPage((p) => Math.min(totalLocationPages, p + 1))}
                            >
                              Next
                              <Pagination.NextIcon />
                            </Pagination.Next>
                          </Pagination.Item>
                        </Pagination.Content>
                      </Pagination>
                    </div>
                  )}
                </Card.Content>
              </Card>
            </div>

            {/* Bottom: assignment result */}
            <Card>
              <Card.Header>
                <Card.Title>
                  {intl.formatMessage({ id: 'putaway.result_title', defaultMessage: 'Assignment Result' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage(
                    { id: 'putaway.result_description', defaultMessage: '{count} pallet(s) paired with a storage location' },
                    { count: pairs.length },
                  )}
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="result-search"
                  value={resultSearch}
                  onChange={setResultSearch}
                  aria-label={intl.formatMessage({ id: 'putaway.result_search_label', defaultMessage: 'Search assignments' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'putaway.result_search_label', defaultMessage: 'Search assignments' })} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label={intl.formatMessage({ id: 'putaway.result_table_aria', defaultMessage: 'Assignment result' })}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader>{intl.formatMessage({ id: 'putaway.col_pallet_id', defaultMessage: 'Pallet ID' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_storage_location', defaultMessage: 'Storage Location' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'common.action', defaultMessage: 'Action' })}</Table.Column>
                      </Table.Header>
                      <Table.Body
                        renderEmptyState={() => (
                          <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                            <Icon className="size-6 text-muted" icon="gravity-ui:tray" />
                            <span className="text-sm text-muted">
                              {resultSearch.trim()
                                ? intl.formatMessage({ id: 'putaway.no_assignments_found', defaultMessage: 'No assignments match your search.' })
                                : intl.formatMessage({ id: 'putaway.no_pairs', defaultMessage: 'Drag a pallet onto a storage location (or vice versa) to create an assignment.' })}
                            </span>
                          </EmptyState>
                        )}
                      >
                        {filteredPairs.map((pair) => {
                          const pallet = allPallets.find((p) => p.palletId === pair.palletId);
                          return (
                            <Table.Row key={pair.palletId}>
                              <Table.Cell>
                                <span className="font-mono text-xs text-foreground/60">{pair.palletId}</span>
                              </Table.Cell>
                              <Table.Cell>{pallet?.palletTypeName ?? '—'}</Table.Cell>
                              <Table.Cell>{pallet?.skuName ?? '—'}</Table.Cell>
                              <Table.Cell>
                                <Chip color="accent">{pair.storageLocationId}</Chip>
                              </Table.Cell>
                              <Table.Cell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onPress={() => handleRemovePair(pair.palletId)}
                                  isDisabled={assignMutation.isPending}
                                  aria-label={intl.formatMessage({ id: 'putaway.remove_pair_aria', defaultMessage: 'Remove assignment' })}
                                >
                                  <Icon icon="solar:trash-bin-trash-bold" className="size-4 text-danger" />
                                </Button>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Card.Content>
            </Card>

            <DragOverlay>
              {activeId ? <ActiveDragPreview activeId={activeId} allPallets={allPallets} /> : null}
            </DragOverlay>
          </DndContext>

          {/* Submit */}
          <div className="flex justify-end">
            <Button onPress={() => setIsConfirmOpen(true)} isDisabled={!canSubmit}>
              <Icon icon="solar:map-point-bold" className="size-4" />
              {assignedPalletCount === 0
                ? intl.formatMessage({ id: 'putaway.reverse_button', defaultMessage: 'Reverse Assignments' })
                : intl.formatMessage({ id: 'putaway.submit_assignments_button', defaultMessage: 'Submit Assignments' })}
            </Button>
          </div>
        </>
      )}

      <Modal>
        <Modal.Backdrop
          isOpen={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          isDismissable={!assignMutation.isPending}
          isKeyboardDismissDisabled={assignMutation.isPending}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  {assignedPalletCount === 0
                    ? intl.formatMessage({ id: 'putaway.reverse_title', defaultMessage: 'Reverse All Assignments' })
                    : intl.formatMessage({ id: 'putaway.confirm_title', defaultMessage: 'Confirm Putaway Assignment' })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {assignedPalletCount === 0
                    ? intl.formatMessage({ id: 'putaway.reverse_description', defaultMessage: 'Remove all pallet assignments and return them to unassigned status?' })
                    : intl.formatMessage(
                      { id: 'putaway.confirm_description', defaultMessage: 'Assign {count} pallets to the selected storage locations?' },
                      { count: assignedPalletCount },
                    )}
                </p>
                <TextField>
                  <Label>
                    {intl.formatMessage({ id: 'putaway.confirm_message_label', defaultMessage: 'Message' })}
                  </Label>
                  <TextArea
                    rows={4}
                    variant="secondary"
                    value={assignmentMessage}
                    onChange={(event) => setAssignmentMessage(event.target.value)}
                    placeholder={intl.formatMessage({ id: 'putaway.confirm_message_placeholder', defaultMessage: 'Add assignment note (optional)' })}
                  />
                </TextField>
                {assignMutation.isError ? (
                  <p className="text-sm text-danger">
                    {assignMutation.error instanceof Error
                      ? assignMutation.error.message
                      : intl.formatMessage({ id: 'error_generic', defaultMessage: 'An unexpected error occurred.' })}
                  </p>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setIsConfirmOpen(false)} isDisabled={assignMutation.isPending}>
                  {intl.formatMessage({ id: 'putaway.cancel_button', defaultMessage: 'Cancel' })}
                </Button>
                <Button onPress={() => void handleConfirmAssign()} isDisabled={assignMutation.isPending || !canSubmit}>
                  {assignMutation.isPending
                    ? assignedPalletCount === 0
                      ? intl.formatMessage({ id: 'putaway.reversing_button', defaultMessage: 'Reversing...' })
                      : intl.formatMessage({ id: 'putaway.submitting_button', defaultMessage: 'Submitting...' })
                    : assignedPalletCount === 0
                      ? intl.formatMessage({ id: 'putaway.reverse_button', defaultMessage: 'Reverse Assignments' })
                      : intl.formatMessage({ id: 'putaway.submit_assignments_button', defaultMessage: 'Submit Assignments' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
};

export { InboundPalletAssignationPage };