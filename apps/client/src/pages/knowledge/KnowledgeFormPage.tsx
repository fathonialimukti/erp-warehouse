import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, FieldError, Input, Label, Switch, TextArea, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillButton } from '../../components/AiFill/AiFillButton';
import { AiFillPanel } from '../../components/AiFill/AiFillPanel';
import { trpcClient } from '../../lib/trpc';
import { knowledgeFormSchema, type KnowledgeFormValues } from '@repo/schemas/knowledge';

const defaultFormValues = (): KnowledgeFormValues => ({
  slug: '',
  title: '',
  content: '',
  isActive: true,
});

function KnowledgeFormContent({
  initialValues,
  isEdit,
  canSave,
  documentId,
}: {
  initialValues: KnowledgeFormValues;
  isEdit: boolean;
  canSave: boolean;
  documentId?: string;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: KnowledgeFormValues) =>
      trpcClient.knowledge.create.mutate({
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        content: payload.content,
        isActive: payload.isActive,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeList'] });
      queryClient.removeQueries({ queryKey: ['knowledgeDetail', created.id] });
      navigate(`/knowledge/${created.id}`);
    },
    onError: (err) => {
      setFormError(
        err instanceof Error
          ? err.message
          : intl.formatMessage({ id: 'knowledge.form.error.create_failed', defaultMessage: 'Failed to create document.' })
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: KnowledgeFormValues) =>
      trpcClient.knowledge.update.mutate({
        id: documentId!,
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        content: payload.content,
        isActive: payload.isActive,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeList'] });
      queryClient.removeQueries({ queryKey: ['knowledgeDetail', documentId] });
      queryClient.removeQueries({ queryKey: ['knowledgeDetail', updated.id] });
      navigate(`/knowledge/${updated.id}`);
    },
    onError: (err) => {
      setFormError(
        err instanceof Error
          ? err.message
          : intl.formatMessage({ id: 'knowledge.form.error.update_failed', defaultMessage: 'Failed to update document.' })
      );
    },
  });

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: knowledgeFormSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      if (!canSave) {
        setFormError(
          intl.formatMessage({
            id: 'knowledge.form.errors.no_permission',
            defaultMessage: 'You do not have permission to save this document.',
          })
        );
        return;
      }

      if (isEdit) {
        updateMutation.mutate(value);
      } else {
        createMutation.mutate(value);
      }
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useAiFillForm({
    slug: (v) => form.setFieldValue('slug', String(v)),
    title: (v) => form.setFieldValue('title', String(v)),
    content: (v) => form.setFieldValue('content', String(v)),
    isActive: (v) => form.setFieldValue('isActive', Boolean(v)),
  });

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'knowledge-form',
        mode: isEdit ? 'edit' : 'create',
        documentId: documentId ?? undefined,
        fields: ['slug', 'title', 'content', 'isActive'],
      })}
    >
      <PageHeader
        title={
          isEdit
            ? intl.formatMessage({ id: 'knowledge.form.title_edit', defaultMessage: 'Edit Document' })
            : intl.formatMessage({ id: 'knowledge.form.title_create', defaultMessage: 'Add Document' })
        }
        onBack={() => navigate('/knowledge')}
      >
        <AiFillButton />
      </PageHeader>

      <AiFillPanel />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Card>
          <Card.Header>
            <div>
              <Card.Title>
                {intl.formatMessage({ id: 'knowledge.form.section_title', defaultMessage: 'Document Information' })}
              </Card.Title>
              <Card.Description>
                {isEdit
                  ? intl.formatMessage({
                      id: 'knowledge.form.section_description_edit',
                      defaultMessage: 'Update knowledge document details. Saving reindexes chunks when content changes.',
                    })
                  : intl.formatMessage({
                      id: 'knowledge.form.section_description_create',
                      defaultMessage: 'Create a knowledge document for AI RAG retrieval.',
                    })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field name="title">
                  {(field) => (
                    <TextField
                      fullWidth
                      isRequired
                      isDisabled={isSubmitting}
                      isInvalid={field.state.meta.errors.length > 0}
                      name="title"
                      value={field.state.value}
                      onChange={field.handleChange}
                    >
                      <Label>{intl.formatMessage({ id: 'knowledge.form.field_title', defaultMessage: 'Title' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({
                          id: 'knowledge.form.title_placeholder',
                          defaultMessage: 'Document title',
                        })}
                        variant="secondary"
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="slug">
                  {(field) => (
                    <TextField
                      fullWidth
                      isRequired
                      isDisabled={isSubmitting}
                      isInvalid={field.state.meta.errors.length > 0}
                      name="slug"
                      value={field.state.value}
                      onChange={field.handleChange}
                    >
                      <Label>{intl.formatMessage({ id: 'knowledge.form.field_slug', defaultMessage: 'Slug' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({
                          id: 'knowledge.form.slug_placeholder',
                          defaultMessage: 'e.g. approval-workflow',
                        })}
                        variant="secondary"
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                      ) : null}
                    </TextField>
                  )}
                </form.Field>
              </div>

              <form.Field name="content">
                {(field) => (
                  <TextField
                    fullWidth
                    isDisabled={isSubmitting}
                    isInvalid={field.state.meta.errors.length > 0}
                    name="content"
                    value={field.state.value}
                    onChange={field.handleChange}
                  >
                    <Label>{intl.formatMessage({ id: 'knowledge.form.field_content', defaultMessage: 'Content' })}</Label>
                    <TextArea
                      placeholder={intl.formatMessage({
                        id: 'knowledge.form.content_placeholder',
                        defaultMessage: 'Markdown content for RAG indexing',
                      })}
                      rows={16}
                      variant="secondary"
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                    ) : null}
                  </TextField>
                )}
              </form.Field>

              <form.Field name="isActive">
                {(field) => (
                  <div className="flex flex-row items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <Label htmlFor="knowledge-is-active">
                        {intl.formatMessage({ id: 'knowledge.form.field_is_active', defaultMessage: 'Active' })}
                      </Label>
                      <span className="text-sm text-muted">
                        {intl.formatMessage({
                          id: 'knowledge.form.is_active_hint',
                          defaultMessage: 'Inactive documents are excluded from RAG indexing.',
                        })}
                      </span>
                    </div>
                    <Switch
                      id="knowledge-is-active"
                      isSelected={field.state.value}
                      isDisabled={isSubmitting}
                      onChange={(value) => field.handleChange(Boolean(value))}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                )}
              </form.Field>

              {formError ? (
                <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </Card.Content>
          <Card.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" type="button" onPress={() => navigate('/knowledge')} isDisabled={isSubmitting}>
                {intl.formatMessage({ id: 'knowledge.form.back', defaultMessage: 'Back' })}
              </Button>
              <Button variant="primary" type="submit" isPending={isSubmitting} isDisabled={!canSave}>
                {({ isPending }) => (
                  <>
                    <Icon
                      icon={isPending ? 'solar:refresh-linear' : 'solar:diskette-linear'}
                      className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                    />
                    {isEdit
                      ? intl.formatMessage({ id: 'knowledge.form.submit_update', defaultMessage: 'Save Changes' })
                      : intl.formatMessage({ id: 'knowledge.form.submit_create', defaultMessage: 'Create Document' })}
                  </>
                )}
              </Button>
            </div>
          </Card.Footer>
        </Card>
      </form>
    </section>
  );
}

function KnowledgeFormPage() {
  const intl = useIntl();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('knowledge@create');
  const canUpdate = hasPermission('knowledge@update');
  const canSave = isEdit ? canUpdate : canCreate;

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['knowledgeDetail', id],
    enabled: isEdit,
    queryFn: () => trpcClient.knowledge.getById.query({ id: id ?? '' }),
  });

  if (isEdit && isLoadingDetail) {
    return (
      <p className="text-sm text-muted">
        {intl.formatMessage({ id: 'knowledge.form.loading_detail', defaultMessage: 'Loading document...' })}
      </p>
    );
  }

  const initialValues: KnowledgeFormValues = detailData
    ? {
        slug: detailData.slug,
        title: detailData.title,
        content: detailData.content,
        isActive: detailData.isActive,
      }
    : defaultFormValues();

  return (
    <KnowledgeFormContent
      initialValues={initialValues}
      isEdit={isEdit}
      canSave={canSave}
      documentId={id ?? undefined}
    />
  );
}

export { KnowledgeFormPage };
