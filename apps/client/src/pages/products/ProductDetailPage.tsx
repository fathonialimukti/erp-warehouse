import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Chip, Table } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
import { DeleteProductDialog } from './_DeleteProduct';

function ProductDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id } = useParams();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('product@update');
  const canDelete = hasPermission('product@delete');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['productDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.product.detail.query({ id: id! }),
  });

  const { data: productAging } = useQuery({
    queryKey: ['inventoryAgingByProduct', id],
    enabled: Boolean(id) && hasPermission('inventoryAging@read'),
    queryFn: () => trpcClient.inventoryAging.byProduct.query({ skuId: id! }),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted">{intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading...' })}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-danger">{intl.formatMessage({ id: 'product.detail.not_found', defaultMessage: 'Product not found.' })}</p>
        <Button onPress={() => navigate('/products')}>
          {intl.formatMessage({ id: 'product.detail.back_to_list', defaultMessage: 'Back to Products' })}
        </Button>
      </div>
    );
  }

  const totalQuantityPerPallet = Number(product.packagesPerPallet) * Number(product.quantityPerPackage);

  return (
    <section className="space-y-6">
      <PageHeader
        title={product.name}
        onBack={() => navigate('/products')}
        onEdit={canUpdate ? () => navigate(`/products/${id}/edit`) : undefined}
        onDelete={canDelete ? () => setDeleteModalOpen(true) : undefined}
      />
      {product.code && (
        <p className="text-muted">
          {intl.formatMessage({ id: 'product.detail.code_label', defaultMessage: 'Code' })}: {product.code}
        </p>
      )}

      <Card>
        <Card.Header>
          <div>
            <Card.Title>{intl.formatMessage({ id: 'product.detail.section_info', defaultMessage: 'Product Information' })}</Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'product.detail.section_info_desc', defaultMessage: 'Basic product details and identification.' })}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {product.photo && (
              <div>
                <img
                  src={product.photo}
                  alt={product.name}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </div>
            )}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted">
                  {intl.formatMessage({ id: 'product.detail.code', defaultMessage: 'Code' })}
                </p>
                <p className="text-lg font-semibold">{product.code ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted">
                  {intl.formatMessage({ id: 'product.detail.name', defaultMessage: 'Name' })}
                </p>
                <p className="text-lg font-semibold">{product.name}</p>
              </div>
              {product.description && (
                <div>
                  <p className="text-sm font-medium text-muted">
                    {intl.formatMessage({ id: 'product.detail.description', defaultMessage: 'Description' })}
                  </p>
                  <p className="text-foreground">{product.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted">
                  {intl.formatMessage({ id: 'product.detail.base_unit', defaultMessage: 'Base Unit' })}
                </p>
                <p className="text-lg font-semibold">{product.baseUnit}</p>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <div>
            <Card.Title>{intl.formatMessage({ id: 'product.detail.section_packaging', defaultMessage: 'Packaging Configuration' })}</Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'product.detail.section_packaging_desc', defaultMessage: 'How this product is packaged and stored.' })}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted">
                {intl.formatMessage({ id: 'product.detail.package_name', defaultMessage: 'Package Name' })}
              </p>
              <p className="text-lg font-semibold">{product.packageName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted">
                {intl.formatMessage({ id: 'product.detail.packages_per_pallet', defaultMessage: 'Packages per Pallet' })}
              </p>
              <p className="text-lg font-semibold">{product.packagesPerPallet}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted">
                {intl.formatMessage({ id: 'product.detail.quantity_per_package', defaultMessage: 'Quantity per Package' })}
              </p>
              <p className="text-lg font-semibold">{product.quantityPerPackage}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted">
                {intl.formatMessage({ id: 'product.detail.package_unit', defaultMessage: 'Package Unit' })}
              </p>
              <p className="text-lg font-semibold">{product.packageUnit}</p>
            </div>
          </div>
          <div className="mt-6 rounded-lg bg-default-100 p-4">
            <p className="text-sm font-medium text-muted">
              {intl.formatMessage({ id: 'product.detail.total_quantity_per_pallet', defaultMessage: 'Total Quantity per Pallet' })}
            </p>
            <p className="text-2xl font-bold text-primary">
              {totalQuantityPerPallet} {product.packageUnit}
            </p>
            <p className="text-xs text-muted">
              {product.packagesPerPallet} {product.packageName} × {product.quantityPerPackage} {product.packageUnit}
            </p>
          </div>
        </Card.Content>
      </Card>

      {(product.length || product.width || product.height || product.maxWeight) && (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>{intl.formatMessage({ id: 'product.detail.section_dimensions', defaultMessage: 'Dimensions & Weight' })}</Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'product.detail.section_dimensions_desc', defaultMessage: 'Physical dimensions for warehouse storage planning.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {product.length && (
                <div>
                  <p className="text-sm font-medium text-muted">
                    {intl.formatMessage({ id: 'product.detail.length', defaultMessage: 'Length' })}
                  </p>
                  <p className="text-lg font-semibold">{product.length} cm</p>
                </div>
              )}
              {product.width && (
                <div>
                  <p className="text-sm font-medium text-muted">
                    {intl.formatMessage({ id: 'product.detail.width', defaultMessage: 'Width' })}
                  </p>
                  <p className="text-lg font-semibold">{product.width} cm</p>
                </div>
              )}
              {product.height && (
                <div>
                  <p className="text-sm font-medium text-muted">
                    {intl.formatMessage({ id: 'product.detail.height', defaultMessage: 'Height' })}
                  </p>
                  <p className="text-lg font-semibold">{product.height} cm</p>
                </div>
              )}
              {product.maxWeight && (
                <div>
                  <p className="text-sm font-medium text-muted">
                    {intl.formatMessage({ id: 'product.detail.max_weight', defaultMessage: 'Max Weight' })}
                  </p>
                  <p className="text-lg font-semibold">{product.maxWeight} kg</p>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Inventory Aging */}
      {productAging && (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>
                {intl.formatMessage({ id: 'product.detail.aging_title', defaultMessage: 'Inventory Aging' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'product.detail.aging_description', defaultMessage: 'Pallet-level aging breakdown for this product\'s current warehouse stock.' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-danger-soft p-3 text-center">
                <p className="text-lg font-bold text-danger">{productAging.deadStockPallets}</p>
                <p className="text-xs text-muted">
                  {intl.formatMessage({ id: 'product.detail.aging_dead_pallets', defaultMessage: 'Dead Stock Pallets' })}
                </p>
              </div>
              <div className="rounded-lg bg-warning-soft p-3 text-center">
                <p className="text-lg font-bold text-warning">{productAging.slowMovingPallets}</p>
                <p className="text-xs text-muted">
                  {intl.formatMessage({ id: 'product.detail.aging_slow_pallets', defaultMessage: 'Slow Moving Pallets' })}
                </p>
              </div>
              <div className="rounded-lg bg-success-soft p-3 text-center">
                <p className="text-lg font-bold text-success">{productAging.activePallets}</p>
                <p className="text-xs text-muted">
                  {intl.formatMessage({ id: 'product.detail.aging_active_pallets', defaultMessage: 'Active Pallets' })}
                </p>
              </div>
            </div>
            <p className="mb-3 text-sm font-medium text-foreground">
              {intl.formatMessage(
                { id: 'product.detail.aging_total_pallets', defaultMessage: '{total} total pallets' },
                { total: productAging.totalPallets },
              )}
            </p>
            <Table aria-label="Product aging pallets">
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column>{intl.formatMessage({ id: 'product.detail.aging_header_warehouse', defaultMessage: 'Warehouse' })}</Table.Column>
                    <Table.Column>{intl.formatMessage({ id: 'product.detail.aging_header_received', defaultMessage: 'Received' })}</Table.Column>
                    <Table.Column>{intl.formatMessage({ id: 'product.detail.aging_header_last_movement', defaultMessage: 'Last Movement' })}</Table.Column>
                    <Table.Column>{intl.formatMessage({ id: 'product.detail.aging_header_status', defaultMessage: 'Status' })}</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                        <span className="text-sm text-muted">
                          {intl.formatMessage({ id: 'product.detail.aging_empty', defaultMessage: 'No aging data available.' })}
                        </span>
                      </div>
                    )}
                  >
                    {productAging.items.map((item: any) => (
                      <Table.Row key={item.palletId}>
                        <Table.Cell>{item.warehouseName}</Table.Cell>
                        <Table.Cell>{new Date(item.palletCreated).toLocaleDateString('id-ID')}</Table.Cell>
                        <Table.Cell>
                          {item.lastMovementDate ? (
                            <div>
                              <p className="text-sm text-foreground">
                                {new Date(item.lastMovementDate).toLocaleDateString('id-ID')}
                              </p>
                              {item.daysSinceMovement !== null && (
                                <p className="text-xs text-muted">
                                  {intl.formatMessage(
                                    { id: 'inventory_aging.days_ago', defaultMessage: '{days} days ago' },
                                    { days: item.daysSinceMovement },
                                  )}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <AgingChip category={item.agingCategory} />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      )}

      <DeleteProductDialog
        id={product.id}
        name={product.name}
        isOpen={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onDeleted={() => navigate('/products')}
      />
    </section>
  );
}

function AgingChip({ category }: { category: string }) {
  const intl = useIntl();
  if (category === 'dead_stock') {
    return <Chip size="sm" variant="soft" className="bg-danger-soft"><span className="text-danger">{intl.formatMessage({ id: 'inventory_aging.category.dead_stock', defaultMessage: 'Dead Stock' })}</span></Chip>;
  }
  if (category === 'slow_moving') {
    return <Chip size="sm" variant="soft" className="bg-warning-soft"><span className="text-warning">{intl.formatMessage({ id: 'inventory_aging.category.slow_moving', defaultMessage: 'Slow Moving' })}</span></Chip>;
  }
  if (category === 'active') {
    return <Chip size="sm" variant="soft" className="bg-success-soft"><span className="text-success">{intl.formatMessage({ id: 'inventory_aging.category.active', defaultMessage: 'Active' })}</span></Chip>;
  }
  return <Chip size="sm" variant="soft" className="bg-default-soft"><span className="text-muted">{intl.formatMessage({ id: 'inventory_aging.category.no_data', defaultMessage: 'No Data' })}</span></Chip>;
}

export { ProductDetailPage };
