import { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Button, Card, EmptyState, Label, Modal, Spinner, Table, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferProcedureInput, inferProcedureOutput } from '@trpc/server';
import type { AppRouterType as AppRouter } from '../../../lib/trpc';
import { trpcClient } from '../../../lib/trpc';
import { PageHeader } from '../../../components/PageHeader';
import { hasPermissionAtom } from '../../../lib/atoms';

type PutawayPreviewOutput = inferProcedureOutput<AppRouter['putaway']['getAssignmentPreview']>;
type PutawayAssignInput = inferProcedureInput<AppRouter['putaway']['assignSuggested']>;

const InboundPutawayPage = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id?: string }>();

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canReadPutaway = hasPermission('putaway_read') || hasPermission('putaway_assign');
  const canAssignPutaway = hasPermission('putaway_assign');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState('');

  const { data, isLoading, isError, error } = useQuery<PutawayPreviewOutput>({
    queryKey: ['putawayPreview', id],
    queryFn: () => trpcClient.putaway.getAssignmentPreview.query({ inboundTransactionId: id! }),
    enabled: Boolean(id) && canReadPutaway,
  });

  const assignMutation = useMutation<unknown, unknown, PutawayAssignInput>({
    mutationFn: (payload) => trpcClient.putaway.assignSuggested.mutate(payload),
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

  const suggestedAssignments = useMemo(() => data?.suggestedAssignments ?? [], [data]);
  const hasSuggestions = suggestedAssignments.length > 0;
  const canSubmit = canAssignPutaway && hasSuggestions && !data?.hasInsufficientLocations;

  const handleConfirmAssign = async () => {
    if (!id || !canSubmit) return;
    await assignMutation.mutateAsync({
      inboundTransactionId: id,
      assignments: suggestedAssignments.map((item) => ({
        palletId: item.palletId,
        storageLocationId: item.storageLocationId,
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
        {intl.formatMessage({ id: 'putaway.page_subtitle', defaultMessage: 'Review the suggested pallet-to-location mapping and confirm assignment once.' })}
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
          <Card>
            <Card.Header>
              <Card.Title>
                {intl.formatMessage({ id: 'putaway.summary_title', defaultMessage: 'Assignment Summary' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage(
                  { id: 'putaway.summary_description', defaultMessage: '{pending} pending pallets and {locations} available ACTIVE locations in this warehouse.' },
                  { pending: data.pendingPalletCount, locations: data.availableLocationCount },
                )}
              </Card.Description>
            </Card.Header>
            {data.hasInsufficientLocations ? (
              <Card.Content>
                <p className="text-sm text-danger">
                  {intl.formatMessage({ id: 'putaway.insufficient_locations', defaultMessage: 'Not enough active empty locations to assign all pending pallets.' })}
                </p>
              </Card.Content>
            ) : null}
          </Card>

          {hasSuggestions ? (
            <Card>
              <Card.Header>
                <Card.Title>
                  {intl.formatMessage({ id: 'putaway.suggested_table_title', defaultMessage: 'Suggested Mapping' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({ id: 'putaway.suggested_table_description', defaultMessage: 'Assignments are generated by first available ACTIVE location ordered by ID.' })}
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label={intl.formatMessage({ id: 'putaway.table_aria', defaultMessage: 'Putaway suggested assignments' })}>
                      <Table.Header>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_pallet_id', defaultMessage: 'Pallet ID' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_sku', defaultMessage: 'SKU' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_pallet_type', defaultMessage: 'Pallet Type' })}</Table.Column>
                        <Table.Column>{intl.formatMessage({ id: 'putaway.col_storage_location', defaultMessage: 'Storage Location' })}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {suggestedAssignments.map((assignment) => (
                          <Table.Row key={assignment.palletId}>
                            <Table.Cell>{assignment.palletId}</Table.Cell>
                            <Table.Cell>{assignment.skuName}</Table.Cell>
                            <Table.Cell>{assignment.palletTypeName}</Table.Cell>
                            <Table.Cell>{assignment.storageLocationId}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Card.Content>
            </Card>
          ) : (
            <EmptyState>
              {intl.formatMessage({ id: 'putaway.no_pending_pallets', defaultMessage: 'No pending pallets to assign for this inbound transaction.' })}
            </EmptyState>
          )}

          <div className="flex justify-end">
            <Button onPress={() => setIsConfirmOpen(true)} isDisabled={!canSubmit}>
              <Icon icon="solar:map-point-bold" className="size-4" />
              {intl.formatMessage({ id: 'putaway.confirm_button', defaultMessage: 'Confirm Assignment' })}
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
                  {intl.formatMessage({ id: 'putaway.confirm_title', defaultMessage: 'Confirm Putaway Assignment' })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {intl.formatMessage(
                    { id: 'putaway.confirm_description', defaultMessage: 'Assign {count} pallets to the suggested storage locations?' },
                    { count: suggestedAssignments.length },
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
                    ? intl.formatMessage({ id: 'putaway.assigning_button', defaultMessage: 'Assigning...' })
                    : intl.formatMessage({ id: 'putaway.submit_button', defaultMessage: 'Assign Now' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
};

export default InboundPutawayPage;