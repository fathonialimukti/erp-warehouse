import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertDialog, Button, toast } from '@heroui/react';
import { Icon } from '@iconify/react';
import { trpcClient } from '../../lib/trpc';
import { BACKUPS_QUERY_KEY, type BackupFileInfo } from './_backup-shared';

interface DeleteModalProps {
  info: BackupFileInfo | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Danger confirmation for permanently deleting a backup file. */
function DeleteModal({ info, isOpen, onOpenChange }: DeleteModalProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (input: { fileName: string }) => trpcClient.backup.delete.mutate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BACKUPS_QUERY_KEY });
      toast.success(intl.formatMessage({ id: 'backup.toast.deleted', defaultMessage: 'Backup deleted.' }));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error && error.message
          ? error.message
          : intl.formatMessage({ id: 'backup.toast.failed', defaultMessage: 'Operation failed.' })
      );
    },
  });

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            {info ? (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>
                    {intl.formatMessage({ id: 'backup.deleteModal.title', defaultMessage: 'Delete backup' })}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <div className="space-y-3 text-sm leading-6">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:file-linear" className="size-4 shrink-0 text-muted" />
                      <span className="break-all font-medium text-foreground">{info.fileName}</span>
                    </div>
                    <div className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
                      <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                      <span>
                        {intl.formatMessage({
                          id: 'backup.deleteModal.description',
                          defaultMessage: 'Permanently delete this backup file? This cannot be undone.',
                        })}
                      </span>
                    </div>
                  </div>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button variant="tertiary" onPress={() => onOpenChange(false)} isDisabled={deleteMutation.isPending}>
                    {intl.formatMessage({ id: 'action_cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button
                    variant="danger"
                    isPending={deleteMutation.isPending}
                    onPress={() => deleteMutation.mutate({ fileName: info.fileName })}
                  >
                    {({ isPending }) => (
                      <>
                        <Icon
                          icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'}
                          className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                        />
                        {intl.formatMessage({ id: 'backup.deleteModal.confirm', defaultMessage: 'Delete' })}
                      </>
                    )}
                  </Button>
                </AlertDialog.Footer>
              </>
            ) : null}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

export { DeleteModal };
