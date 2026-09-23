import {
  Button,
  Label,
  Modal,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import type { ModalStage, TransactionIntent, TransactionFormModalMessages } from './useTransactionFormModal';

export interface TransactionFormModalProps {
  modalStage: ModalStage;
  intent: TransactionIntent;
  resultMessage: string;
  approvalMessage: string;
  onApprovalMessageChange: (value: string) => void;
  messages: TransactionFormModalMessages;
  /** Backdrop close / backdrop-click / confirm button. */
  onModalClose: () => void;
  /** Confirm button: the page binds it to `handleConfirmSubmit(form.handleSubmit)`. */
  onConfirmSubmit: () => void;
  /** Success-branch "View Detail". The hook's `handleViewDetail` covers this. */
  onViewDetail: () => void;
}

/**
 * The four-branch transaction form modal: loading, success, error, and the
 * confirm step that stages the submit intent (plus its optional approval note).
 *
 * Rendered once per form, driven by `useTransactionFormModal`. Reproduces the
 * modal tree every transaction form page currently inlines: the backdrop stays
 * non-dismissable while loading, success auto-redirects (timer owned by the
 * hook), and the approval note only appears for the propose intent.
 */
export function TransactionFormModal({
  modalStage,
  intent,
  resultMessage,
  approvalMessage,
  onApprovalMessageChange,
  messages,
  onModalClose,
  onConfirmSubmit,
  onViewDetail,
}: TransactionFormModalProps) {
  const isOpen = modalStage !== 'idle';
  const isConfirming = intent === 'PROPOSED';
  const confirmTitle = isConfirming
    ? messages.confirmPropose
    : intent === 'SAVE'
      ? (messages.confirmSave ?? messages.confirmDraft)
      : messages.confirmDraft;
  const confirmDesc = isConfirming
    ? messages.confirmProposeDesc
    : intent === 'SAVE'
      ? (messages.confirmSaveDesc ?? messages.confirmDraftDesc)
      : messages.confirmDraftDesc;

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onModalClose();
        }}
        isDismissable={modalStage !== 'loading'}
        isKeyboardDismissDisabled={modalStage === 'loading'}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            {modalStage === 'loading' ? (
              <>
                <Modal.Header>
                  <Modal.Heading>{messages.saving}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col items-center gap-4 py-8">
                  <Spinner size="lg" />
                  {messages.pleaseWait ? <p className="text-sm text-muted">{messages.pleaseWait}</p> : null}
                </Modal.Body>
              </>
            ) : modalStage === 'success' ? (
              <>
                <Modal.Header>
                  <Modal.Icon>
                    <Icon icon="solar:check-circle-bold" className="size-12 text-success" />
                  </Modal.Icon>
                  <Modal.Heading>{messages.successTitle}</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p className="text-center text-sm text-muted">{resultMessage}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={onViewDetail}>{messages.viewDetail}</Button>
                </Modal.Footer>
              </>
            ) : modalStage === 'error' ? (
              <>
                <Modal.Header>
                  <Modal.Icon>
                    <Icon icon="solar:close-circle-bold" className="size-12 text-danger" />
                  </Modal.Icon>
                  <Modal.Heading>{messages.errorTitle}</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p className="text-center text-sm text-muted">{resultMessage}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={onModalClose}>{messages.close}</Button>
                </Modal.Footer>
              </>
            ) : (
              <>
                <Modal.Header>
                  <Modal.Icon>
                    <Icon
                      icon={
                        isConfirming
                          ? 'solar:send-linear'
                          : intent === 'SAVE'
                            ? 'solar:save-linear'
                            : 'solar:floppy-disk-linear'
                      }
                      className="size-10"
                    />
                  </Modal.Icon>
                  <Modal.Heading>{confirmTitle}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                  <p className="text-sm text-muted">{confirmDesc}</p>
                  {isConfirming && (
                    <TextField fullWidth>
                      <Label>{messages.messageLabel}</Label>
                      <TextArea
                        rows={3}
                        variant="secondary"
                        value={approvalMessage}
                        onChange={(e) => onApprovalMessageChange(e.target.value)}
                        placeholder={messages.messagePlaceholder}
                      />
                    </TextField>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={onModalClose}>
                    {messages.cancel}
                  </Button>
                  <Button onPress={() => onConfirmSubmit()}>{messages.confirm}</Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
