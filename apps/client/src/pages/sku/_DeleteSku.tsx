import { useState } from "react";
import { useIntl } from "react-intl";
import { AlertDialog, Button } from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { trpcClient } from "../../lib/trpc";

interface DeleteSkuDialogProps {
  id: string;
  name?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  onError?: (message: string) => void;
  onDeletingChange?: (isDeleting: boolean) => void;
}

function DeleteSkuDialog({
  id,
  name,
  isOpen,
  onOpenChange,
  onDeleted,
  onError,
  onDeletingChange,
}: DeleteSkuDialogProps) {
  const intl = useIntl();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!id) return;

    setErrorMessage(null);
    setIsDeleting(true);
    onDeletingChange?.(true);

    try {
      await trpcClient.product.delete.mutate({ id });
      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: "sku.delete.error",
              defaultMessage: "Failed to delete SKU.",
            });
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setIsDeleting(false);
      onDeletingChange?.(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                {intl.formatMessage({
                  id: "sku.delete.title",
                  defaultMessage: "Delete SKU",
                })}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <div className="space-y-3 text-sm leading-6 text-muted">
                <p>
                  {intl.formatMessage(
                    {
                      id: "sku.delete.body",
                      defaultMessage:
                        "Are you sure you want to delete SKU {name}? This action cannot be undone.",
                    },
                    { name: name ?? id },
                  )}
                </p>
                <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-danger">
                  {intl.formatMessage({
                    id: "sku.delete.warning",
                    defaultMessage:
                      "Make sure this SKU is no longer required by inventory or warehouse operations.",
                  })}
                </div>
                {errorMessage ? (
                  <p className="text-sm text-danger">{errorMessage}</p>
                ) : null}
              </div>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="primary"
                onPress={() => onOpenChange(false)}
                isDisabled={isDeleting}
              >
                {intl.formatMessage({
                  id: "sku.delete.cancel",
                  defaultMessage: "Cancel",
                })}
              </Button>
              <Button
                variant="danger"
                onPress={() => void handleDelete()}
                isPending={isDeleting}
              >
                {({ isPending }) => (
                  <>
                    <AppIcon
                      name={isPending ? "refresh" : "trash"}
                      className={`size-4 ${isPending ? "animate-spin" : ""}`}
                    />
                    {isPending
                      ? intl.formatMessage({
                          id: "sku.delete.deleting",
                          defaultMessage: "Deleting...",
                        })
                      : intl.formatMessage({
                          id: "sku.delete.delete",
                          defaultMessage: "Delete",
                        })}
                  </>
                )}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

export { DeleteSkuDialog };
