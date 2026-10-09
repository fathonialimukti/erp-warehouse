import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  Button,
  Label,
  Spinner,
  Switch,
  toast,
} from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { trpcClient } from "../../lib/trpc";
import { BACKUPS_QUERY_KEY, type BackupFileInfo } from "./_backup-shared";

interface RestoreModalProps {
  info: BackupFileInfo | null;
  /** Server package version from `backup.list` — the exact version the server's restore guard enforces. */
  appVersion: string | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Danger-styled confirmation for the destructive full-DB restore. Blocks
 * dismissal while the restore runs (it can take minutes on large databases).
 */
function RestoreModal({
  info,
  appVersion,
  isOpen,
  onOpenChange,
}: RestoreModalProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [force, setForce] = useState(false);

  // Reset the explicit "restore anyway" choice each time a new backup is targeted.
  useEffect(() => {
    if (isOpen) setForce(false);
  }, [isOpen]);

  const restoreMutation = useMutation({
    mutationFn: (input: { fileName: string; force: boolean }) =>
      trpcClient.backup.restore.mutate(input),
    onSuccess: () => {
      // Restore replaces the entire DB (roles/permissions included) — re-sync every cached query.
      void queryClient.invalidateQueries();
      void queryClient.invalidateQueries({ queryKey: BACKUPS_QUERY_KEY });
      toast.success(
        intl.formatMessage({
          id: "backup.toast.restored",
          defaultMessage: "Database restored successfully.",
        }),
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error && error.message
          ? error.message
          : intl.formatMessage({
              id: "backup.toast.failed",
              defaultMessage: "Operation failed.",
            }),
      );
    },
  });

  const versionMismatch =
    info !== null &&
    appVersion !== undefined &&
    info.schemaVersion !== appVersion;

  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        isDismissable={!restoreMutation.isPending}
        isKeyboardDismissDisabled={restoreMutation.isPending}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-lg">
            {restoreMutation.isPending ? (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Heading>
                    {intl.formatMessage({
                      id: "backup.restoring",
                      defaultMessage: "Restoring…",
                    })}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body className="flex flex-col items-center gap-4 py-8">
                  <Spinner size="lg" />
                  <p className="text-center text-sm text-muted">
                    {intl.formatMessage({
                      id: "backup.restoreModal.inProgress",
                      defaultMessage:
                        "Restoring database… this can take a while. Do not close this page.",
                    })}
                  </p>
                </AlertDialog.Body>
              </>
            ) : info ? (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>
                    {intl.formatMessage({
                      id: "backup.restoreModal.title",
                      defaultMessage: "Restore database from backup",
                    })}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <div className="space-y-4 text-sm leading-6">
                    <div className="flex items-center gap-2">
                      <AppIcon
                        name="file"
                        className="size-4 shrink-0 text-muted"
                      />
                      <span className="break-all font-medium text-foreground">
                        {info.fileName}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted">
                          {intl.formatMessage({
                            id: "backup.restoreModal.currentVersion",
                            defaultMessage: "Current version",
                          })}
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {appVersion}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted">
                          {intl.formatMessage({
                            id: "backup.restoreModal.backupVersion",
                            defaultMessage: "Backup version",
                          })}
                        </span>
                        <span
                          className={`font-mono tabular-nums ${versionMismatch ? "text-warning" : "text-foreground"}`}
                        >
                          {info.schemaVersion}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-muted">
                        {intl.formatMessage({
                          id: "backup.restoreModal.countsLabel",
                          defaultMessage: "Rows per table",
                        })}
                      </span>
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-border px-3 py-2">
                        {Object.entries(info.tableCounts).map(
                          ([tableName, count]) => (
                            <div
                              key={tableName}
                              className="flex items-center justify-between gap-4"
                            >
                              <span className="truncate text-foreground/80">
                                {tableName}
                              </span>
                              <span className="tabular-nums text-foreground">
                                {intl.formatNumber(count)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
                      <AppIcon
                        name="warning"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        {intl.formatMessage({
                          id: "backup.restoreModal.description",
                          defaultMessage:
                            "Restoring will erase ALL current data and replace it with the contents of this backup. This action cannot be undone.",
                        })}
                      </span>
                    </div>

                    {versionMismatch ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
                          <AppIcon
                            name="shield-alert"
                            className="mt-0.5 size-4 shrink-0"
                          />
                          <span>
                            {intl.formatMessage({
                              id: "backup.restoreModal.versionMismatchWarning",
                              defaultMessage:
                                "This backup was created with a different app version and may not restore correctly.",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="backup-force-restore">
                            {intl.formatMessage({
                              id: "backup.restoreModal.forceRestore",
                              defaultMessage: "Restore anyway",
                            })}
                          </Label>
                          <Switch
                            id="backup-force-restore"
                            isSelected={force}
                            onChange={(selected) => setForce(selected)}
                          >
                            <Switch.Content>
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch.Content>
                          </Switch>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button
                    variant="tertiary"
                    onPress={() => onOpenChange(false)}
                  >
                    {intl.formatMessage({
                      id: "action_cancel",
                      defaultMessage: "Cancel",
                    })}
                  </Button>
                  <Button
                    variant="danger"
                    isDisabled={versionMismatch && !force}
                    onPress={() =>
                      restoreMutation.mutate({ fileName: info.fileName, force })
                    }
                  >
                    <AppIcon name="history" className="size-4" />
                    {intl.formatMessage({
                      id: "backup.restoreModal.confirm",
                      defaultMessage: "Restore now",
                    })}
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

export { RestoreModal };
