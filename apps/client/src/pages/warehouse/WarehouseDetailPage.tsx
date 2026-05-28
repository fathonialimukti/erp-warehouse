import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Modal } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { useAtomValue } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EntityPhoto } from '../../components/EntityPhoto';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
import { WarehouseLocationSection } from './_StorageLocationTable';

interface WarehouseDetail {
  id: string;
  objectId?: string | null;
  name: string;
  address: string;
  totalCapacity: number | null;
  photo: string | null;
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
      <p className="text-sm font-medium text-muted">{label}</p>
      <p>{value ?? '-'}</p>
    </div>
  );
}

function WarehouseDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdateWarehouse = hasPermission('warehouse@update');
  const canDeleteWarehouse = hasPermission('warehouse@delete');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeletingWarehouse, setIsDeletingWarehouse] = useState(false);

  const { data: warehouseQueryData, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.warehouse.detail.query({ id: id ?? '' }),
  });

  const warehouse = warehouseQueryData as WarehouseDetail | undefined;

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
      console.error(error);
    } finally {
      setIsDeletingWarehouse(false);
    }
  };

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
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'warehouse-detail',
        id: warehouse.id,
        name: warehouse.name,
        address: warehouse.address,
        objectId: warehouse.objectId ?? null,
        totalCapacity: warehouse.totalCapacity,
      })}
    >
      <PageHeader
        title={warehouse.name}
        onBack={() => navigate('/warehouse')}
        onEdit={canUpdateWarehouse ? () => navigate(`/warehouse/${warehouse.id}/edit`) : undefined}
        onDelete={canDeleteWarehouse ? () => setDeleteModalOpen(true) : undefined}
      >
        <Button onPress={() => navigate(`/warehouse/${warehouse.id}/layout`)}>
          <Icon icon="tdesign:map-3d" />
          <span className="hidden md:block">{intl.formatMessage({ id: 'warehouse.detail.view_3d_layout', defaultMessage: 'View 3D Layout' })}</span>
        </Button>
      </PageHeader>

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
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.object_id_label', defaultMessage: 'Object ID' })}
                value={warehouse.objectId ?? '-'}
              />
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.address_label', defaultMessage: 'Address' })}
                value={warehouse.address}
              />
              <DetailField
                label={intl.formatMessage({ id: 'warehouse.detail.total_capacity_label', defaultMessage: 'Total Capacity' })}
                value={warehouse.totalCapacity?.toLocaleString('id-ID') ?? '-'}
              />
            </div>
          </div>
        </div>
      </Card>

      <WarehouseLocationSection
        warehouseId={warehouse.id}
        warehouseName={warehouse.name}
      />

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


    </section>
  );
}

export { WarehouseDetailPage };
