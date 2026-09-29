import { useState } from "react";
import { useAtomValue } from "jotai";
import { useIntl } from "react-intl";
import { Button, Card, Chip, Modal, Table } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate, useParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";
import { MaterialDialog } from "./_MaterialDialog";

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
      <p className="text-sm text-foreground">{value ?? "-"}</p>
    </div>
  );
}

type MaterialSku = {
  supplierId: string;
  skuId: string;
  supplierItemCode: string | null;
  unitPrice: number | null;
  leadTimeDays: number | null;
  minimumOrderQty: number | null;
  isPreferred: boolean;
  sku: {
    id: string;
    code: string | null;
    name: string;
    type: "RAW_MATERIAL" | "PACKAGING_MATERIAL";
    baseUnit: string;
    packageName: string;
    packagesPerPallet: number;
    quantityPerPackage: number;
    packageUnit: string;
  };
};

function SupplierDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdateSupplier = hasPermission("supplier@update");
  const canDeleteSupplier = hasPermission("supplier@delete");
  const canAddMaterial = hasPermission("sku@create");
  const canUpdateMaterial = hasPermission("sku@update");
  const canRemoveMaterial = hasPermission("sku@delete");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialSku | null>(
    null,
  );
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [materialToRemove, setMaterialToRemove] = useState<MaterialSku | null>(
    null,
  );
  const [isRemovingMaterial, setIsRemovingMaterial] = useState(false);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplierDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.supplier.detail.query({ id: id ?? "" }),
  });

  const { data: supplierAging } = useQuery({
    queryKey: ["inventoryAgingBySupplier", id],
    enabled: Boolean(id) && hasPermission("inventoryAging@read"),
    queryFn: () =>
      trpcClient.inventoryAging.bySupplier.query({ supplierId: id ?? "" }),
  });

  const handleDeleteSupplier = async () => {
    if (!supplier || isDeleting) return;

    setIsDeleting(true);
    try {
      await trpcClient.supplier.delete.mutate({ id: supplier.id });
      await queryClient.invalidateQueries({ queryKey: ["supplierList"] });
      queryClient.removeQueries({ queryKey: ["supplierDetail", supplier.id] });
      setDeleteModalOpen(false);
      navigate("/suppliers");
    } catch (error) {
      console.error(error);
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveMaterial = async () => {
    if (!materialToRemove || !supplier || isRemovingMaterial) return;

    setIsRemovingMaterial(true);
    try {
      await trpcClient.supplier.removeMaterial.mutate({
        supplierId: supplier.id,
        skuId: materialToRemove.skuId,
      });
      await queryClient.invalidateQueries({
        queryKey: ["supplierDetail", supplier.id],
      });
      setRemoveModalOpen(false);
      setMaterialToRemove(null);
    } catch (error) {
      console.error(error);
      setRemoveModalOpen(false);
    } finally {
      setIsRemovingMaterial(false);
    }
  };

  const openAddMaterialDialog = () => {
    setEditingMaterial(null);
    setMaterialDialogOpen(true);
  };

  const openEditMaterialDialog = (material: MaterialSku) => {
    setEditingMaterial(material);
    setMaterialDialogOpen(true);
  };

  const openRemoveMaterialDialog = (material: MaterialSku) => {
    setMaterialToRemove(material);
    setRemoveModalOpen(true);
  };

  const handleMaterialDialogClose = () => {
    setMaterialDialogOpen(false);
    setEditingMaterial(null);
  };

  const handleMaterialSaved = () => {
    if (supplier) {
      queryClient.invalidateQueries({
        queryKey: ["supplierDetail", supplier.id],
      });
    }
    handleMaterialDialogClose();
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted">
        {intl.formatMessage({
          id: "supplier.detail.loading",
          defaultMessage: "Loading supplier details...",
        })}
      </p>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">
          {intl.formatMessage({
            id: "supplier.detail.not_found",
            defaultMessage: "Supplier not found.",
          })}
        </p>
        <Button variant="ghost" onPress={() => navigate("/suppliers")}>
          {intl.formatMessage({
            id: "supplier.detail.back_to_list",
            defaultMessage: "Back to Suppliers",
          })}
        </Button>
      </div>
    );
  }

  const materials =
    (supplier as unknown as { skus?: MaterialSku[] }).skus ?? [];

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: "supplier-detail",
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        materialCount: materials.length,
      })}
    >
      <PageHeader
        title={supplier.name}
        onBack={() => navigate("/suppliers")}
        onEdit={
          canUpdateSupplier
            ? () => navigate(`/suppliers/${supplier.id}/edit`)
            : undefined
        }
        onDelete={
          canDeleteSupplier ? () => setDeleteModalOpen(true) : undefined
        }
      />

      {/* Supplier Info Card */}
      <Card className="rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.09)_0%,rgba(56,189,248,0.04)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(3,101,161,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.2)_0%,rgba(56,189,248,0.08)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {intl.formatMessage({
              id: "supplier.detail.code_label",
              defaultMessage: "Supplier Code",
            })}
          </p>
          <p className="font-mono text-sm text-foreground">
            {supplier.code ?? "-"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {supplier.name}
          </h1>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField
            label={intl.formatMessage({
              id: "supplier.detail.email_label",
              defaultMessage: "Email",
            })}
            value={supplier.email}
          />
          <DetailField
            label={intl.formatMessage({
              id: "supplier.detail.phone_label",
              defaultMessage: "Phone",
            })}
            value={supplier.phone}
          />
          <DetailField
            label={intl.formatMessage({
              id: "supplier.detail.address_label",
              defaultMessage: "Address",
            })}
            value={supplier.address}
          />
          <DetailField
            label={intl.formatMessage({
              id: "supplier.detail.notes_label",
              defaultMessage: "Notes",
            })}
            value={supplier.notes}
          />
        </div>
      </Card>

      {/* Materials Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {intl.formatMessage({
                id: "supplier.detail.materials_title",
                defaultMessage: "Materials",
              })}
            </h2>
            <p className="text-sm text-muted">
              {intl.formatMessage({
                id: "supplier.detail.materials_description",
                defaultMessage:
                  "Raw and packaging materials linked to this supplier.",
              })}
            </p>
          </div>
          {canAddMaterial ? (
            <Button variant="primary" size="sm" onPress={openAddMaterialDialog}>
              <Icon icon="material-symbols:add-2-rounded" className="size-4" />
              {intl.formatMessage({
                id: "supplier.detail.add_material",
                defaultMessage: "Add Material",
              })}
            </Button>
          ) : null}
        </div>

        <Card>
          <Card.Content>
            <Table aria-label="Materials table">
              <Table.ScrollContainer>
                <Table.Content aria-label="Materials content">
                  <Table.Header>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.material_header_code",
                        defaultMessage: "Code",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.material_header_name",
                        defaultMessage: "Name",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.material_header_type",
                        defaultMessage: "Type",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.material_header_unit_price",
                        defaultMessage: "Unit Price",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.material_header_lead_time",
                        defaultMessage: "Lead Time",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.material_header_preferred",
                        defaultMessage: "Preferred",
                      })}
                    </Table.Column>
                    <Table.Column>
                      <span className="sr-only">Actions</span>
                    </Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                        <Icon
                          icon="solar:box-linear"
                          className="size-6 text-muted"
                        />
                        <span className="text-sm text-muted">
                          {intl.formatMessage({
                            id: "supplier.detail.materials_empty",
                            defaultMessage:
                              "No materials linked to this supplier.",
                          })}
                        </span>
                      </div>
                    )}
                  >
                    {materials.map((material) => (
                      <Table.Row key={material.skuId} id={material.skuId}>
                        <Table.Cell key={`${material.skuId}-code`}>
                          <span className="font-mono text-sm">
                            {material.sku.code ?? "-"}
                          </span>
                        </Table.Cell>
                        <Table.Cell key={`${material.skuId}-name`}>
                          {material.sku.name}
                        </Table.Cell>
                        <Table.Cell key={`${material.skuId}-type`}>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {material.sku.type === "RAW_MATERIAL"
                              ? intl.formatMessage({
                                  id: "sku.type.raw_material",
                                  defaultMessage: "Raw Material",
                                })
                              : intl.formatMessage({
                                  id: "sku.type.packaging_material",
                                  defaultMessage: "Packaging Material",
                                })}
                          </span>
                        </Table.Cell>
                        <Table.Cell key={`${material.skuId}-price`}>
                          {material.unitPrice != null
                            ? material.unitPrice.toLocaleString("id-ID")
                            : "-"}
                        </Table.Cell>
                        <Table.Cell key={`${material.skuId}-lead`}>
                          {material.leadTimeDays != null
                            ? intl.formatMessage(
                                {
                                  id: "supplier.detail.material_lead_time_days",
                                  defaultMessage: "{days} days",
                                },
                                { days: material.leadTimeDays },
                              )
                            : "-"}
                        </Table.Cell>
                        <Table.Cell key={`${material.skuId}-preferred`}>
                          {material.isPreferred ? (
                            <Icon
                              icon="solar:star-bold"
                              className="size-4 text-warning"
                            />
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </Table.Cell>
                        <Table.Cell key={`${material.skuId}-actions`}>
                          <div className="flex gap-1">
                            {canUpdateMaterial ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                onPress={() => openEditMaterialDialog(material)}
                              >
                                <Icon
                                  icon="solar:pen-linear"
                                  className="size-4"
                                />
                              </Button>
                            ) : null}
                            {canRemoveMaterial ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                className="text-danger"
                                onPress={() =>
                                  openRemoveMaterialDialog(material)
                                }
                              >
                                <Icon
                                  icon="solar:trash-bin-trash-linear"
                                  className="size-4"
                                />
                              </Button>
                            ) : null}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      </div>

      {/* Inventory Aging */}
      {supplierAging && (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>
                {intl.formatMessage({
                  id: "supplier.detail.aging_title",
                  defaultMessage: "Inventory Aging",
                })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: "supplier.detail.aging_description",
                  defaultMessage:
                    "Aging status of material SKUs from this supplier in current warehouse stock.",
                })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-danger-soft p-3 text-center">
                <p className="text-lg font-bold text-danger">
                  {supplierAging.deadStockSkuCount}
                </p>
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "supplier.detail.aging_dead_skus",
                    defaultMessage: "Dead Stock SKUs",
                  })}
                </p>
                <p className="mt-1 text-sm font-semibold text-danger">
                  {formatCompact(supplierAging.deadStockValue)}
                </p>
              </div>
              <div className="rounded-lg bg-warning-soft p-3 text-center">
                <p className="text-lg font-bold text-warning">
                  {
                    supplierAging.items.filter(
                      (i: { agingCategory: string }) =>
                        i.agingCategory === "slow_moving",
                    ).length
                  }
                </p>
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "supplier.detail.aging_slow_skus",
                    defaultMessage: "Slow Moving SKUs",
                  })}
                </p>
                <p className="mt-1 text-sm font-semibold text-warning">
                  {formatCompact(supplierAging.slowMovingValue)}
                </p>
              </div>
              <div className="rounded-lg bg-success-soft p-3 text-center">
                <p className="text-lg font-bold text-success">
                  {
                    supplierAging.items.filter(
                      (i: { agingCategory: string }) =>
                        i.agingCategory === "active",
                    ).length
                  }
                </p>
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "supplier.detail.aging_active_skus",
                    defaultMessage: "Active SKUs",
                  })}
                </p>
                <p className="mt-1 text-sm font-semibold text-success">
                  {formatCompact(supplierAging.activeValue)}
                </p>
              </div>
            </div>
            <Table aria-label="Aging items table">
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.aging_header_sku",
                        defaultMessage: "SKU",
                      })}
                    </Table.Column>
                    <Table.Column className="text-right">
                      {intl.formatMessage({
                        id: "supplier.detail.aging_header_pallets",
                        defaultMessage: "Pallets",
                      })}
                    </Table.Column>
                    <Table.Column className="text-right">
                      {intl.formatMessage({
                        id: "supplier.detail.aging_header_value",
                        defaultMessage: "Value",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.aging_header_last_movement",
                        defaultMessage: "Last Movement",
                      })}
                    </Table.Column>
                    <Table.Column>
                      {intl.formatMessage({
                        id: "supplier.detail.aging_header_status",
                        defaultMessage: "Status",
                      })}
                    </Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                        <span className="text-sm text-muted">
                          {intl.formatMessage({
                            id: "supplier.detail.aging_empty",
                            defaultMessage: "No aging data available.",
                          })}
                        </span>
                      </div>
                    )}
                  >
                    {supplierAging.items.map((item: any) => (
                      <Table.Row key={item.skuId}>
                        <Table.Cell>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {item.skuName}
                            </p>
                            <p className="text-xs text-muted">
                              {item.skuCode ?? item.skuId.slice(0, 8)}
                            </p>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular-nums">
                          {item.palletCount}
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium tabular-nums">
                          {formatCompact(item.totalValue)}
                        </Table.Cell>
                        <Table.Cell>
                          {item.lastMovementDate ? (
                            <div>
                              <p className="text-sm text-foreground">
                                {new Date(
                                  item.lastMovementDate,
                                ).toLocaleDateString("id-ID")}
                              </p>
                              {item.daysSinceMovement !== null && (
                                <p className="text-xs text-muted">
                                  {intl.formatMessage(
                                    {
                                      id: "inventory_aging.days_ago",
                                      defaultMessage: "{days} days ago",
                                    },
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

      {/* Delete Supplier Modal */}
      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <Icon
                    icon="solar:trash-bin-trash-linear"
                    className="size-5"
                  />
                </Modal.Icon>
                <Modal.Heading>
                  {intl.formatMessage({
                    id: "supplier.detail.delete_title",
                    defaultMessage: "Delete Supplier",
                  })}
                </Modal.Heading>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {intl.formatMessage(
                    {
                      id: "supplier.detail.delete_description",
                      defaultMessage:
                        "Supplier {name} will be removed. Material SKU links will also be deleted.",
                    },
                    { name: supplier.name },
                  )}
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-sm text-danger">
                  {intl.formatMessage({
                    id: "supplier.detail.delete_warning",
                    defaultMessage:
                      "Make sure no active operational processes still require this record.",
                  })}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="primary"
                  onPress={() => setDeleteModalOpen(false)}
                  isDisabled={isDeleting}
                >
                  {intl.formatMessage({
                    id: "supplier.detail.delete_cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => void handleDeleteSupplier()}
                  isPending={isDeleting}
                >
                  {({ isPending }) => (
                    <>
                      <Icon
                        icon={
                          isPending
                            ? "solar:refresh-linear"
                            : "solar:trash-bin-trash-linear"
                        }
                        className={`size-4 ${isPending ? "animate-spin" : ""}`}
                      />
                      {isPending
                        ? intl.formatMessage({
                            id: "supplier.detail.delete_deleting",
                            defaultMessage: "Deleting...",
                          })
                        : intl.formatMessage({
                            id: "supplier.detail.delete_confirm",
                            defaultMessage: "Delete Supplier",
                          })}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Remove Material Modal */}
      <Modal isOpen={removeModalOpen} onOpenChange={setRemoveModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {intl.formatMessage({
                    id: "supplier.detail.remove_material_title",
                    defaultMessage: "Remove Material",
                  })}
                </Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage(
                    {
                      id: "supplier.detail.remove_material_body",
                      defaultMessage:
                        'Are you sure you want to remove material "{materialName}" from this supplier? The SKU record will be deleted if it has no stock.',
                    },
                    { materialName: materialToRemove?.sku.name },
                  )}
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-sm text-danger">
                  {intl.formatMessage({
                    id: "supplier.detail.remove_material_warning",
                    defaultMessage: "This action cannot be undone.",
                  })}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="primary"
                  onPress={() => setRemoveModalOpen(false)}
                  isDisabled={isRemovingMaterial}
                >
                  {intl.formatMessage({
                    id: "supplier.detail.delete_cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => void handleRemoveMaterial()}
                  isPending={isRemovingMaterial}
                >
                  {({ isPending }) => (
                    <>
                      <Icon
                        icon={
                          isPending
                            ? "solar:refresh-linear"
                            : "solar:trash-bin-trash-linear"
                        }
                        className={`size-4 ${isPending ? "animate-spin" : ""}`}
                      />
                      {isPending
                        ? intl.formatMessage({
                            id: "supplier.detail.delete_deleting",
                            defaultMessage: "Deleting...",
                          })
                        : intl.formatMessage({
                            id: "supplier.detail.remove_material_confirm",
                            defaultMessage: "Remove",
                          })}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Material Dialog */}
      <MaterialDialog
        isOpen={materialDialogOpen}
        onClose={handleMaterialDialogClose}
        onSaved={handleMaterialSaved}
        supplierId={supplier.id}
        editingMaterial={editingMaterial}
      />
    </section>
  );
}

function AgingChip({ category }: { category: string }) {
  const intl = useIntl();
  if (category === "dead_stock") {
    return (
      <Chip size="sm" variant="soft" className="bg-danger-soft">
        <span className="text-danger">
          {intl.formatMessage({
            id: "inventory_aging.category.dead_stock",
            defaultMessage: "Dead Stock",
          })}
        </span>
      </Chip>
    );
  }
  if (category === "slow_moving") {
    return (
      <Chip size="sm" variant="soft" className="bg-warning-soft">
        <span className="text-warning">
          {intl.formatMessage({
            id: "inventory_aging.category.slow_moving",
            defaultMessage: "Slow Moving",
          })}
        </span>
      </Chip>
    );
  }
  if (category === "active") {
    return (
      <Chip size="sm" variant="soft" className="bg-success-soft">
        <span className="text-success">
          {intl.formatMessage({
            id: "inventory_aging.category.active",
            defaultMessage: "Active",
          })}
        </span>
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="soft" className="bg-default-soft">
      <span className="text-muted">
        {intl.formatMessage({
          id: "inventory_aging.category.no_data",
          defaultMessage: "No Data",
        })}
      </span>
    </Chip>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${n.toFixed(0)}`;
}

export { SupplierDetailPage };
