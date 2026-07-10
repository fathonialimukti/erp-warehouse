# Detail Page Template

File: `apps/client/src/pages/{domain}/{Domain}DetailPage.tsx`

```tsx
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useNavigate, useParams } from 'react-router';
import { useAtomValue } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

interface {Domain}Detail {
  id: string;
  name: string;
  // Add domain-specific fields
  createdAt: string;
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p>{value ?? '-'}</p>
    </div>
  );
}

export function {Domain}DetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('{domain}@update');
  const canDelete = hasPermission('{domain}@delete');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['{domain}Detail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.{namespace}.detail.query({ id: id ?? '' }),
  });

  const record = data as {Domain}Detail | undefined;

  const handleDelete = async () => {
    if (!record || isDeleting) return;
    setIsDeleting(true);
    try {
      await trpcClient.{namespace}.delete.mutate({ id: record.id });
      await queryClient.invalidateQueries({ queryKey: ['{domain}List'] });
      queryClient.removeQueries({ queryKey: ['{domain}Detail', record.id] });
      setDeleteModalOpen(false);
      navigate('/{domain}');
    } catch (error) {
      console.error(error);
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted">
        {intl.formatMessage({ id: '{domain}.detail.loading_detail', defaultMessage: 'Loading details...' })}
      </p>
    );
  }

  if (!record) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">
          {intl.formatMessage({ id: '{domain}.detail.not_found', defaultMessage: '{Domain} not found.' })}
        </p>
        <Button variant="ghost" onPress={() => navigate('/{domain}')}>
          {intl.formatMessage({ id: '{domain}.detail.back', defaultMessage: 'Back to {Domain}s' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={record.name}
        onBack={() => navigate('/{domain}')}
        onEdit={canUpdate ? () => navigate(`/{domain}/${record.id}/edit`) : undefined}
        onDelete={canDelete ? () => setDeleteModalOpen(true) : undefined}
      />

      <Card>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <DetailField
            label={intl.formatMessage({ id: '{domain}.detail.id_label', defaultMessage: 'ID' })}
            value={record.id}
          />
          <DetailField
            label={intl.formatMessage({ id: '{domain}.detail.name_label', defaultMessage: 'Name' })}
            value={record.name}
          />
          {/* Add DetailField for each domain-specific field */}
          <DetailField
            label={intl.formatMessage({ id: '{domain}.detail.created_at_label', defaultMessage: 'Created At' })}
            value={new Date(record.createdAt).toLocaleDateString()}
          />
        </div>
      </Card>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            {intl.formatMessage({ id: 'common.modal.confirm_delete_title', defaultMessage: 'Confirm Delete' })}
          </ModalHeader>
          <ModalBody>
            {intl.formatMessage(
              { id: '{domain}.detail.delete_confirm_body', defaultMessage: 'Delete "{name}"? This cannot be undone.' },
              { name: record.name },
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setDeleteModalOpen(false)}>
              {intl.formatMessage({ id: 'common.action.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button color="danger" isLoading={isDeleting} onPress={() => void handleDelete()}>
              {intl.formatMessage({ id: 'common.action.delete', defaultMessage: 'Delete' })}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}

export default {Domain}DetailPage;
```

## Notes

- Replace `trpcClient.{namespace}.detail.query(...)` with the correct router path.
- Add `<EntityPhoto>` import and usage when the domain has a `photo` field.
- For domains with sub-tables (like `StorageLocationTable` in Warehouse), create a separate `_{SubEntity}Table.tsx` component in the same folder.
