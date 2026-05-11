import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  Button,
  Card,
  Description,
  EmptyState,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Input,
  Label,
  Modal,
  SearchField,
  Spinner,
  Table,
  TextArea,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput, inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { PageHeader } from '../../../components/PageHeader';

type DispatchPreviewOutput = inferProcedureOutput<AppRouter['outboundTransaction']['getDispatchAssignmentData']>;
type DispatchAssignInput = inferProcedureInput<AppRouter['outboundTransaction']['SubmitDispatchAssignment']>;

interface AssignmentPair {
  outboundTransactionItemId: string;
  palletId: string;
}

function OutboundDispatchAssignationPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission('outbound_transaction@read') || hasPermission('outbound_transaction@update');
  const canAssign = hasPermission('outbound_transaction@update');

  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [pairs, setPairs] = useState<AssignmentPair[]>([]);
  const [search, setSearch] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<DispatchPreviewOutput>({
    queryKey: ['outboundDispatchPreview', id],
    queryFn: () => trpcClient.outboundTransaction.getDispatchAssignmentData.query({ outboundTransactionId: id! }),
    enabled: Boolean(id) && canRead,
  });

  useEffect(() => {
    if (!data) return;
    setPairs(
      data.assignedPallets.map((pallet) => ({
        outboundTransactionItemId: pallet.outboundTransactionItemId,
        palletId: pallet.palletId,
      })),
    );
  }, [data]);

  const assignedPalletIds = useMemo(() => new Set(pairs.map((pair) => pair.palletId)), [pairs]);
  const itemMap = useMemo(
    () => new Map(data?.items.map((item) => [item.outboundTransactionItemId, item]) ?? []),
    [data],
  );

  const pairsByItem = useMemo(() => {
    const map = new Map<string, AssignmentPair[]>();
    pairs.forEach((pair) => {
      const current = map.get(pair.outboundTransactionItemId) ?? [];
      current.push(pair);
      map.set(pair.outboundTransactionItemId, current);
    });
    return map;
  }, [pairs]);

  const filteredAvailablePallets = useMemo(() => {
    if (!data) return [] as DispatchPreviewOutput['availablePallets'];
    const lower = search.trim().toLowerCase();
    return data.availablePallets.filter((pallet) => {
      if (assignedPalletIds.has(pallet.palletId)) return false;
      if (!lower) return true;
      return (
        pallet.palletId.toLowerCase().includes(lower) ||
        pallet.skuName?.toLowerCase().includes(lower) ||
        pallet.palletTypeName?.toLowerCase().includes(lower)
      );
    });
  }, [data, search, assignedPalletIds]);

  const availableByItem = useMemo(() => {
    const map = new Map<string, DispatchPreviewOutput['availablePallets']>();
    filteredAvailablePallets.forEach((pallet) => {
      const current = map.get(pallet.outboundTransactionItemId) ?? [];
      current.push(pallet);
      map.set(pallet.outboundTransactionItemId, current);
    });
    return map;
  }, [filteredAvailablePallets]);

  const suggestionPairs = useMemo(() => data?.suggestedAssignments ?? [], [data]);

  const assignMutation = useMutation<unknown, unknown, DispatchAssignInput>({
    mutationFn: (payload) => trpcClient.outboundTransaction.SubmitDispatchAssignment.mutate(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['outboundTransactionDetail', id] }),
        queryClient.invalidateQueries({ queryKey: ['outboundDispatchPreview', id] }),
      ]);
      setIsConfirmOpen(false);
      navigate(`/transactions/outbound/${id}`);
    },
  });

  const handleApplySuggestions = () => {
    setPairs(suggestionPairs.map((item) => ({ outboundTransactionItemId: item.outboundTransactionItemId, palletId: item.palletId })));
  };

  const handleRemoveAssignment = (palletId: string) => {
    setPairs((current) => current.filter((pair) => pair.palletId !== palletId));
  };

  const handleAddAssignment = (itemId: string, palletId: string) => {
    setPairs((current) => [...current, { outboundTransactionItemId: itemId, palletId }]);
  };

  const hasPendingPallets = data ? data.pendingPalletCount > 0 : false;
  const canSubmit = canAssign && pairs.length > 0 && !assignMutation.isPending;
  const assignedCount = pairs.length;

  if (!canRead) {
    return (
      <section className="space-y-6">
        <PageHeader
          title={intl.formatMessage({ id: 'dispatch.page_title', defaultMessage: 'Outbound Dispatch Assignment' })}
          onBack={() => navigate(`/transactions/outbound/${id ?? ''}`)}
        />
        <EmptyState>
          {intl.formatMessage({ id: 'dispatch.access_denied', defaultMessage: 'You do not have permission to access dispatch assignments.' })}
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'dispatch.page_title', defaultMessage: 'Outbound Dispatch Assignment' })}
        onBack={() => navigate(`/transactions/outbound/${id!}`)}
      />
      <p className="text-sm text-muted">
        {intl.formatMessage({
          id: 'dispatch.page_subtitle',
          defaultMessage: 'Assign available pallets to approved outbound items to prepare the shipment.',
        })}
      </p>

      {isLoading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'dispatch.loading', defaultMessage: 'Loading dispatch preview...' })}
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
          {intl.formatMessage({ id: 'dispatch.empty_preview', defaultMessage: 'No dispatch assignment preview available.' })}
        </EmptyState>
      ) : (
        <>
          <Card>
            <Card.Header>
              <Card.Title>{intl.formatMessage({ id: 'dispatch.summary_title', defaultMessage: 'Dispatch Summary' })}</Card.Title>
              <Card.Description>
                {intl.formatMessage(
                  { id: 'dispatch.summary_description', defaultMessage: '{pending} pending pallets and {available} available pallets for assignment.' },
                  { pending: data.pendingPalletCount, available: data.availablePalletCount },
                )}
              </Card.Description>
            </Card.Header>
            {data.hasInsufficientPallets && (
              <Card.Content>
                <p className="text-sm text-danger">
                  {intl.formatMessage({ id: 'dispatch.insufficient_pallets', defaultMessage: 'Not enough available pallets to fulfill all outbound items.' })}
                </p>
              </Card.Content>
            )}
          </Card>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchField value={search} onChange={setSearch} placeholder={intl.formatMessage({ id: 'dispatch.search_placeholder', defaultMessage: 'Search pallets or SKUs…' })}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <div className="flex gap-2">
                <Button variant="secondary" onPress={handleApplySuggestions} isDisabled={!suggestionPairs.length || assignMutation.isPending}>
                  <Icon icon="mdi:lightning-bolt" className="size-4" />
                  {intl.formatMessage({ id: 'dispatch.apply_suggestions_button', defaultMessage: 'Apply Suggestions' })}
                </Button>
              </div>
            </div>

            {data.items.map((item) => {
              const currentPairs = pairsByItem.get(item.outboundTransactionItemId) ?? [];
              const availableForItem = availableByItem.get(item.outboundTransactionItemId) ?? [];
              const remaining = Math.max(0, item.quantity - currentPairs.length);

              return (
                <Card key={item.outboundTransactionItemId}>
                  <Card.Header>
                    <div>
                      <Card.Title>
                        {item.skuName ?? item.skuId} / {item.palletTypeName ?? item.palletTypeId}
                      </Card.Title>
                      <Card.Description>
                        {intl.formatMessage(
                          { id: 'dispatch.item_summary', defaultMessage: '{assigned} of {quantity} pallets assigned' },
                          { assigned: currentPairs.length, quantity: item.quantity },
                        )}
                      </Card.Description>
                    </div>
                  </Card.Header>
                  <Card.Content>
                    <Fieldset>
                      <FieldsetLegend>{intl.formatMessage({ id: 'dispatch.section_assigned', defaultMessage: 'Assigned pallets' })}</FieldsetLegend>
                      <FieldGroup>
                        {currentPairs.length > 0 ? (
                          <Table>
                            <Table.ScrollContainer>
                              <Table.Content aria-label={intl.formatMessage({ id: 'dispatch.assigned_table_aria', defaultMessage: 'Assigned pallets' })}>
                                <Table.Header>
                                  <Table.Column>{intl.formatMessage({ id: 'dispatch.col_pallet_id', defaultMessage: 'Pallet ID' })}</Table.Column>
                                  <Table.Column>{intl.formatMessage({ id: 'dispatch.col_action', defaultMessage: 'Action' })}</Table.Column>
                                </Table.Header>
                                <Table.Body>
                                  {currentPairs.map((pair) => (
                                    <Table.Row key={pair.palletId}>
                                      <Table.Cell>{pair.palletId}</Table.Cell>
                                      <Table.Cell>
                                        <Button size="sm" variant="ghost" onPress={() => handleRemoveAssignment(pair.palletId)} isDisabled={!canAssign || assignMutation.isPending}>
                                          {intl.formatMessage({ id: 'dispatch.remove_button', defaultMessage: 'Remove' })}
                                        </Button>
                                      </Table.Cell>
                                    </Table.Row>
                                  ))}
                                </Table.Body>
                              </Table.Content>
                            </Table.ScrollContainer>
                          </Table>
                        ) : (
                          <EmptyState>
                            {intl.formatMessage({ id: 'dispatch.no_assigned_pallets', defaultMessage: 'No pallets assigned yet.' })}
                          </EmptyState>
                        )}
                      </FieldGroup>
                    </Fieldset>

                    <Fieldset>
                      <FieldsetLegend>{intl.formatMessage({ id: 'dispatch.section_available', defaultMessage: 'Available pallets' })}</FieldsetLegend>
                      <Description>
                        {remaining > 0
                          ? intl.formatMessage({ id: 'dispatch.remaining_to_assign', defaultMessage: '{count} more pallets required.', }, { count: remaining })
                          : intl.formatMessage({ id: 'dispatch.assignment_complete', defaultMessage: 'This item is fully assigned.' })}
                      </Description>
                      <FieldGroup>
                        {availableForItem.length > 0 ? (
                          <Table>
                            <Table.ScrollContainer>
                              <Table.Content aria-label={intl.formatMessage({ id: 'dispatch.available_table_aria', defaultMessage: 'Available pallets' })}>
                                <Table.Header>
                                  <Table.Column>{intl.formatMessage({ id: 'dispatch.col_pallet_id', defaultMessage: 'Pallet ID' })}</Table.Column>
                                  <Table.Column>{intl.formatMessage({ id: 'dispatch.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                                  <Table.Column>{intl.formatMessage({ id: 'dispatch.col_action', defaultMessage: 'Action' })}</Table.Column>
                                </Table.Header>
                                <Table.Body>
                                  {availableForItem.map((pallet) => (
                                    <Table.Row key={pallet.palletId}>
                                      <Table.Cell>{pallet.palletId}</Table.Cell>
                                      <Table.Cell>{pallet.skuName ?? pallet.skuId}</Table.Cell>
                                      <Table.Cell>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onPress={() => handleAddAssignment(item.outboundTransactionItemId, pallet.palletId)}
                                          isDisabled={!canAssign || assignMutation.isPending || currentPairs.length >= item.quantity}
                                        >
                                          {intl.formatMessage({ id: 'dispatch.assign_button', defaultMessage: 'Assign' })}
                                        </Button>
                                      </Table.Cell>
                                    </Table.Row>
                                  ))}
                                </Table.Body>
                              </Table.Content>
                            </Table.ScrollContainer>
                          </Table>
                        ) : (
                          <EmptyState>
                            {intl.formatMessage({ id: 'dispatch.no_available_pallets', defaultMessage: 'No available pallets for this item.' })}
                          </EmptyState>
                        )}
                      </FieldGroup>
                    </Fieldset>
                  </Card.Content>
                </Card>
              );
            })}

            <Card>
              <Card.Content>
                <FieldGroup>
                  <Label>{intl.formatMessage({ id: 'dispatch.field_message', defaultMessage: 'Dispatch note (optional)' })}</Label>
                  <TextArea value={assignmentMessage} onChange={(event) => setAssignmentMessage(event.target.value)} placeholder={intl.formatMessage({ id: 'dispatch.field_message_placeholder', defaultMessage: 'Add dispatch note...' })} />
                </FieldGroup>
              </Card.Content>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted">
                {intl.formatMessage(
                  { id: 'dispatch.assignment_summary', defaultMessage: '{assigned} assignments selected' },
                  { assigned: assignedCount },
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onPress={() => setIsConfirmOpen(true)}
                  isDisabled={!canSubmit}
                >
                  <Icon icon="mdi:check" className="size-4" />
                  {intl.formatMessage({ id: 'dispatch.confirm_button', defaultMessage: 'Confirm Dispatch' })}
                </Button>
              </div>
            </div>
          </div>

          <Modal>
            <Modal.Backdrop
              isOpen={isConfirmOpen}
              onOpenChange={(open) => {
                if (!open) setIsConfirmOpen(false);
              }}
              isDismissable={!assignMutation.isPending}
              isKeyboardDismissDisabled={assignMutation.isPending}
            >
              <Modal.Container size="sm">
                <Modal.Dialog>
                  {assignMutation.isPending ? (
                    <>
                      <Modal.Header>
                        <Modal.Heading>
                          {intl.formatMessage({ id: 'dispatch.processing_title', defaultMessage: 'Processing…' })}
                        </Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="flex flex-col items-center gap-4 py-8">
                        <Spinner size="lg" />
                        <p className="text-sm text-muted">
                          {intl.formatMessage({ id: 'dispatch.processing', defaultMessage: 'Please wait while dispatch assignments are saved.' })}
                        </p>
                      </Modal.Body>
                    </>
                  ) : (
                    <>
                      <Modal.Header>
                        <Modal.Heading>
                          {intl.formatMessage({ id: 'dispatch.confirm_title', defaultMessage: 'Confirm Dispatch Assignment' })}
                        </Modal.Heading>
                      </Modal.Header>
                      <Modal.Body>
                        <p className="text-sm text-muted">
                          {intl.formatMessage(
                            { id: 'dispatch.confirm_description', defaultMessage: 'Assign {count} pallets to this outbound transaction?' },
                            { count: assignedCount },
                          )}
                        </p>
                        <div className="mt-4">
                          <TextArea
                            value={assignmentMessage}
                            onChange={(event) => setAssignmentMessage(event.target.value)}
                            placeholder={intl.formatMessage({ id: 'dispatch.confirm_message_placeholder', defaultMessage: 'Add dispatch note (optional)' })}
                          />
                        </div>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button variant="secondary" onPress={() => setIsConfirmOpen(false)}>
                          {intl.formatMessage({ id: 'dispatch.cancel_button', defaultMessage: 'Cancel' })}
                        </Button>
                        <Button onPress={() => void assignMutation.mutateAsync({ outboundTransactionId: id!, assignments: pairs, message: assignmentMessage.trim() || undefined })}>
                          {intl.formatMessage({ id: 'dispatch.confirm_button', defaultMessage: 'Confirm Dispatch' })}
                        </Button>
                      </Modal.Footer>
                    </>
                  )}
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </>
      )}
    </section>
  );
}

export { OutboundDispatchAssignationPage };
