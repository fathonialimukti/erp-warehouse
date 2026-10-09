import { useState } from "react";
import { useAtomValue } from "jotai";
import { useIntl } from "react-intl";
import { Button, Card, Chip, Modal } from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/PageHeader";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";

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

function KnowledgeDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission("knowledge@update");
  const canDelete = hasPermission("knowledge@delete");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["knowledgeDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.knowledge.getById.query({ id: id ?? "" }),
  });

  const handleDelete = async () => {
    if (!doc || isDeleting) return;

    setIsDeleting(true);
    try {
      await trpcClient.knowledge.delete.mutate({ id: doc.id });
      await queryClient.invalidateQueries({ queryKey: ["knowledgeList"] });
      queryClient.removeQueries({ queryKey: ["knowledgeDetail", doc.id] });
      setDeleteModalOpen(false);
      navigate("/knowledge");
    } catch (error) {
      console.error(error);
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReindex = async () => {
    if (!doc || isReindexing) return;

    setIsReindexing(true);
    setReindexMessage(null);
    try {
      const result = await trpcClient.knowledge.reindex.mutate({ id: doc.id });
      await queryClient.invalidateQueries({
        queryKey: ["knowledgeDetail", doc.id],
      });
      await queryClient.invalidateQueries({ queryKey: ["knowledgeList"] });
      setReindexMessage(
        intl.formatMessage(
          {
            id: "knowledge.detail.reindex_success",
            defaultMessage: "Reindexed successfully ({count} chunks).",
          },
          { count: result.chunks },
        ),
      );
    } catch (error) {
      console.error(error);
      setReindexMessage(
        intl.formatMessage({
          id: "knowledge.detail.reindex_failed",
          defaultMessage: "Reindex failed.",
        }),
      );
    } finally {
      setIsReindexing(false);
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted">
        {intl.formatMessage({
          id: "knowledge.detail.loading_detail",
          defaultMessage: "Loading document...",
        })}
      </p>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">
          {intl.formatMessage({
            id: "knowledge.detail.not_found",
            defaultMessage: "Document not found.",
          })}
        </p>
        <Button variant="ghost" onPress={() => navigate("/knowledge")}>
          {intl.formatMessage({
            id: "knowledge.detail.back",
            defaultMessage: "Back to Knowledge Base",
          })}
        </Button>
      </div>
    );
  }

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: "knowledge-detail",
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        chunkCount: doc.chunkCount,
      })}
    >
      <PageHeader
        title={doc.title}
        onBack={() => navigate("/knowledge")}
        onEdit={
          canUpdate ? () => navigate(`/knowledge/${doc.id}/edit`) : undefined
        }
        onDelete={canDelete ? () => setDeleteModalOpen(true) : undefined}
      >
        {canUpdate ? (
          <Button
            variant="secondary"
            onPress={() => void handleReindex()}
            isDisabled={isReindexing}
          >
            <AppIcon
              name={isReindexing ? "refresh" : "refresh"}
              className={`size-4 ${isReindexing ? "animate-spin" : ""}`}
            />
            <span className="hidden md:block">
              {isReindexing
                ? intl.formatMessage({
                    id: "knowledge.detail.reindexing",
                    defaultMessage: "Reindexing...",
                  })
                : intl.formatMessage({
                    id: "knowledge.detail.reindex",
                    defaultMessage: "Reindex",
                  })}
            </span>
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center gap-3">
            <Card.Title>{doc.title}</Card.Title>
            <Chip
              size="sm"
              variant="soft"
              color={doc.isActive ? "success" : "default"}
            >
              {doc.isActive
                ? intl.formatMessage({
                    id: "knowledge.detail.active_yes",
                    defaultMessage: "Active",
                  })
                : intl.formatMessage({
                    id: "knowledge.detail.active_no",
                    defaultMessage: "Inactive",
                  })}
            </Chip>
          </div>
          <Card.Description className="font-mono">{doc.slug}</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField
              label={intl.formatMessage({
                id: "knowledge.detail.slug_label",
                defaultMessage: "Slug",
              })}
              value={doc.slug}
            />
            <DetailField
              label={intl.formatMessage({
                id: "knowledge.detail.chunk_count_label",
                defaultMessage: "Chunks",
              })}
              value={doc.chunkCount}
            />
            <DetailField
              label={intl.formatMessage({
                id: "knowledge.detail.updated_label",
                defaultMessage: "Updated",
              })}
              value={new Date(doc.updatedAt).toLocaleString("id-ID")}
            />
            <DetailField
              label={intl.formatMessage({
                id: "knowledge.detail.created_label",
                defaultMessage: "Created",
              })}
              value={new Date(doc.createdAt).toLocaleString("id-ID")}
            />
          </div>

          {reindexMessage ? (
            <p className="mt-4 text-sm text-muted">{reindexMessage}</p>
          ) : null}

          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium text-muted">
              {intl.formatMessage({
                id: "knowledge.detail.content_label",
                defaultMessage: "Content",
              })}
            </p>
            <pre className="max-h-[32rem] overflow-auto rounded-2xl border border-border/70 bg-default-50 p-4 text-sm whitespace-pre-wrap text-foreground dark:bg-default-100/10">
              {doc.content || "—"}
            </pre>
          </div>
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {intl.formatMessage({
                    id: "knowledge.detail.delete_title",
                    defaultMessage: "Delete Document",
                  })}
                </Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage(
                    {
                      id: "knowledge.detail.delete_confirm_body",
                      defaultMessage:
                        'Are you sure you want to delete "{title}"? Indexed chunks will also be removed.',
                    },
                    { title: doc.title },
                  )}
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {intl.formatMessage({
                    id: "common.action.cancel",
                    defaultMessage: "Cancel",
                  })}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => void handleDelete()}
                  isDisabled={isDeleting}
                >
                  {isDeleting
                    ? intl.formatMessage({
                        id: "knowledge.detail.deleting",
                        defaultMessage: "Deleting...",
                      })
                    : intl.formatMessage({
                        id: "common.action.delete",
                        defaultMessage: "Delete",
                      })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { KnowledgeDetailPage };
