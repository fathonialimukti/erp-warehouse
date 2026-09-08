import { useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { Button, Card, Spinner, Table, toast } from '@heroui/react';
import { Icon } from '@iconify/react';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
import {
  BACKUPS_QUERY_KEY,
  downloadBase64AsFile,
  formatBytes,
  readFileAsBase64,
  sumTableCounts,
  type BackupFileInfo,
} from './_backup-shared';
import { RestoreModal } from './_RestoreModal';
import { DeleteModal } from './_DeleteModal';

function BackupPage() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canRead = hasPermission('backup@read');
  const canCreate = hasPermission('backup@create');
  const canDelete = hasPermission('backup@delete');
  const canRestore = hasPermission('backup@restore');

  const [restoreTarget, setRestoreTarget] = useState<BackupFileInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupFileInfo | null>(null);

  const t = (id: string, defaultMessage: string) => intl.formatMessage({ id, defaultMessage });

  const backupsQuery = useQuery({
    queryKey: BACKUPS_QUERY_KEY,
    queryFn: () => trpcClient.backup.list.query(),
    enabled: canRead,
  });
  const backups = backupsQuery.data?.backups ?? [];

  const createMutation = useMutation({
    mutationFn: () => trpcClient.backup.create.mutate(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BACKUPS_QUERY_KEY });
      toast.success(t('backup.toast.created', 'Backup created.'));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error && error.message ? error.message : t('backup.toast.failed', 'Operation failed.')
      );
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (input: { fileName: string; content: string }) => trpcClient.backup.upload.mutate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BACKUPS_QUERY_KEY });
      toast.success(t('backup.toast.uploaded', 'Backup file uploaded.'));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error && error.message ? error.message : t('backup.toast.failed', 'Operation failed.')
      );
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (input: { fileName: string }) => trpcClient.backup.download.query(input),
    onSuccess: ({ fileName, base64 }) => downloadBase64AsFile(fileName, base64),
    onError: (error) => {
      toast.danger(
        error instanceof Error && error.message
          ? error.message
          : t('backup.toast.downloadFailed', 'Download failed.')
      );
    },
  });

  const handleUploadFile = async (file: File) => {
    const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJson) {
      toast.danger(t('backup.uploadInvalid', 'Not a valid backup file. Please choose a .json backup.'));
      return;
    }
    const content = await readFileAsBase64(file);
    uploadMutation.mutate({ fileName: file.name, content });
  };

  const columns = [
    t('backup.table.fileName', 'File'),
    t('backup.table.createdAt', 'Created'),
    t('backup.table.size', 'Size'),
    t('backup.table.version', 'Version'),
    t('backup.table.rows', 'Rows'),
    t('backup.table.actions', 'Actions'),
  ];

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'settings-backup-restore',
        totalBackups: backups.length,
        permissions: { read: canRead, create: canCreate, delete: canDelete, restore: canRestore },
        visibleRows: backups.map((backup) => backup.fileName),
      })}
    >
      <Card>
        <Card.Header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Card.Title className="text-2xl">{t('backup.title', 'Backup & Restore')}</Card.Title>
            <Card.Description>
              {t(
                'backup.subtitle',
                'Create, download, and restore full-database backups. Restoring replaces all current data.'
              )}
            </Card.Description>
          </div>
          {canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                isPending={uploadMutation.isPending}
                isDisabled={createMutation.isPending || uploadMutation.isPending}
                onPress={() => fileInputRef.current?.click()}
              >
                {({ isPending }) => (
                  <>
                    <Icon
                      icon={isPending ? 'solar:refresh-linear' : 'solar:upload-linear'}
                      className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                    />
                    <span className="hidden md:block">{isPending ? t('backup.uploading', 'Uploading…') : t('backup.upload', 'Upload backup file')}</span>
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                isPending={createMutation.isPending}
                isDisabled={createMutation.isPending || uploadMutation.isPending}
                onPress={() => createMutation.mutate()}
              >
                {({ isPending }) => (
                  <>
                    <Icon
                      icon={isPending ? 'solar:refresh-linear' : 'solar:database-linear'}
                      className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                    />
                    <span className="hidden md:block">{isPending ? t('backup.creating', 'Creating backup…') : t('backup.create', 'Create backup now')}</span>
                  </>
                )}
              </Button>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleUploadFile(file);
            }}
          />
        </Card.Header>

        <Card.Content className="space-y-4">
          {backupsQuery.isError ? (
            <div className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
              <span>
                {backupsQuery.error instanceof Error && backupsQuery.error.message
                  ? backupsQuery.error.message
                  : t('backup.toast.failed', 'Operation failed.')}
              </span>
            </div>
          ) : null}

          {canRead ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label={t('backup.title', 'Backup & Restore')}>
                  <Table.Header>
                    {columns.map((column, index) => (
                      <Table.Column key={column} isRowHeader={index === 0}>
                        <span className={`font-semibold ${index >= 2 && index <= 4 ? 'block text-right' : ''}`}>{column}</span>
                      </Table.Column>
                    ))}
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                        <Icon icon="solar:database-linear" className="size-6 text-muted" />
                        <span className="text-sm text-muted">
                          {t('backup.empty', 'No backups yet. Create one or upload a backup file.')}
                        </span>
                      </div>
                    )}
                  >
                    {backupsQuery.isLoading ? (
                      <Table.Row id="loading-row">
                        <Table.Cell colSpan={columns.length}>
                            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                              <Spinner size="sm" />
                              {t('common.loading', 'Loading...')}
                            </div>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      backups.map((backup) => (
                        <Table.Row key={backup.fileName} id={backup.fileName}>
                          <Table.Cell>
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:file-linear" className="size-4 shrink-0 text-muted" />
                              <span className="break-all text-sm font-medium text-foreground">{backup.fileName}</span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">
                                {new Date(backup.createdAt).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-muted">
                                {new Date(backup.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-right text-sm tabular-nums text-foreground">
                              {formatBytes(backup.sizeBytes)}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-right">
                              <span className="font-mono text-xs text-foreground">{backup.schemaVersion}</span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-right text-sm tabular-nums text-foreground">
                              {intl.formatNumber(sumTableCounts(backup.tableCounts))}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex justify-end gap-1">
                              {canRestore ? (
                                <Button
                                  variant="tertiary"
                                  size="sm"
                                  isDisabled={restoreTarget !== null}
                                  className="text-accent"
                                  onPress={() => setRestoreTarget(backup)}
                                  aria-label={t('backup.restore', 'Restore')}
                                >
                                  <Icon icon="solar:history-linear" className="size-4" />
                                  <span className="hidden lg:inline">{t('backup.restore', 'Restore')}</span>
                                </Button>
                              ) : null}
                              {canRead ? (
                                <Button
                                  variant="tertiary"
                                  size="sm"
                                  isPending={
                                    downloadMutation.isPending && downloadMutation.variables?.fileName === backup.fileName
                                  }
                                  isDisabled={downloadMutation.isPending}
                                  onPress={() => downloadMutation.mutate({ fileName: backup.fileName })}
                                  aria-label={t('backup.download', 'Download')}
                                >
                                  <Icon icon="solar:download-linear" className="size-4" />
                                  <span className="hidden lg:inline">{t('backup.download', 'Download')}</span>
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button
                                  variant="tertiary"
                                  size="sm"
                                  isDisabled={deleteTarget !== null}
                                  className="text-danger"
                                  onPress={() => setDeleteTarget(backup)}
                                  aria-label={t('backup.delete', 'Delete')}
                                >
                                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                                  <span className="hidden lg:inline">{t('backup.delete', 'Delete')}</span>
                                </Button>
                              ) : null}
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : null}
        </Card.Content>
      </Card>

      <RestoreModal
        info={restoreTarget}
        appVersion={backupsQuery.data?.appVersion}
        isOpen={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
      />
      <DeleteModal
        info={deleteTarget}
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </section>
  );
}

export { BackupPage };
