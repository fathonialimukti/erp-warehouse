import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

/**
 * The modal state machine duplicated across every transaction form page.
 *
 * - `idle` — no modal.
 * - `confirm-draft` / `confirm-propose` / `confirm-save` — the "are you sure?"
 *   step shown before submitting. Which one depends on the intent the user
 *   picked (draft-propose pages have draft + propose; single-save pages only save).
 * - `loading` — the request is in flight. Not dismissable.
 * - `success` — saved; auto-redirects after {@link SUCCESS_REDIRECT_MS}.
 * - `error` — the mutation rejected; shows the server message.
 */
export type ModalStage =
  | 'idle'
  | 'confirm-draft'
  | 'confirm-propose'
  | 'confirm-save'
  | 'loading'
  | 'success'
  | 'error';

/**
 * Which approval status the pending submit will carry.
 *
 * `SAVE` is the single-save equivalent of `PROPOSED` — it submits without the
 * draft/propose distinction (used by pages whose records have no approval flow).
 */
export type TransactionIntent = 'DRAFT' | 'PROPOSED' | 'SAVE';

/** Whether the form offers "Save Draft" + "Propose", or a single save action. */
export type TransactionIntentMode = 'draft-propose' | 'single-save';

/**
 * Every string the modal renders. Pages resolve these with `intl.formatMessage`
 * before handing them over, so the primitive stays locale-agnostic.
 */
export interface TransactionFormModalMessages {
  /** Loading branch heading. */
  saving: string;
  /** Optional extra line under the loading spinner (e.g. "Please wait…"). */
  pleaseWait?: string;
  /** Success branch heading. */
  successTitle: string;
  /** Error branch heading. */
  errorTitle: string;
  /** Confirm-branch heading for the propose intent. */
  confirmPropose: string;
  /** Confirm-branch heading for the draft intent. */
  confirmDraft: string;
  /** Confirm-branch body for the propose intent. */
  confirmProposeDesc: string;
  /** Confirm-branch body for the draft intent. */
  confirmDraftDesc: string;
  /** Confirm-branch heading for the single-save intent (falls back to `confirmDraft`). */
  confirmSave?: string;
  /** Confirm-branch body for the single-save intent (falls back to `confirmDraftDesc`). */
  confirmSaveDesc?: string;
  /** Label of the optional approval note textarea. */
  messageLabel: string;
  /** Placeholder of the optional approval note textarea. */
  messagePlaceholder: string;
  /** Confirm-branch cancel button. */
  cancel: string;
  /** Confirm-branch confirm button. */
  confirm: string;
  /** Error branch close button. */
  close: string;
  /** Success branch "view the record that was just saved" button. */
  viewDetail: string;
}

export interface UseTransactionFormModalOptions {
  intentMode: TransactionIntentMode;
  /**
   * Resolve the detail URL for a saved record. Receives the id returned by the
   * mutation (which may be `null` on update flows that don't echo the id), so
   * pages typically fall back to the route id.
   */
  redirectOnSuccess: (id: string | null) => string;
  messages: TransactionFormModalMessages;
}

export interface UseTransactionFormModalResult {
  /** The intent the pending submit will carry. */
  intent: TransactionIntent;
  modalStage: ModalStage;
  resultMessage: string;
  approvalMessage: string;
  setApprovalMessage: (value: string) => void;
  successDetailId: string | null;
  /** `true` while the submit request is in flight — used to disable every input. */
  isSubmitting: boolean;
  clearTimer: () => void;
  handleModalClose: () => void;
  /** Arm the intent and open the matching confirm step. */
  handleActionConfirm: (status: TransactionIntent) => void;
  /** Flip to `loading` and run the form's `handleSubmit`. */
  handleConfirmSubmit: (handleSubmit: () => Promise<void>) => Promise<void>;
  /** Mutations call this on success: record the id, show the message, arm the redirect. */
  handleSuccess: (id: string | null, message: string) => void;
  /** Mutations call this on error: show the server message. */
  handleError: (message: string) => void;
  /** Success-branch "View Detail" — navigates to `redirectOnSuccess(successDetailId)`. */
  handleViewDetail: () => void;
}

/**
 * Delay before the success modal auto-redirects to the detail page.
 * Kept as a named constant so the 10 duplicated `setTimeout(..., 1500)` calls
 * it replaces stay obviously identical.
 */
const SUCCESS_REDIRECT_MS = 1500;

/**
 * Owns the transaction-form modal state machine: intent staging, the four modal
 * stages, the approval-note draft, and the success auto-redirect timer.
 *
 * This is a straight hoist of the block duplicated across the transaction form
 * pages — same guard order, same timer semantics, no behaviour changes.
 */
export function useTransactionFormModal(
  opts: UseTransactionFormModalOptions,
): UseTransactionFormModalResult {
  const { intentMode, redirectOnSuccess } = opts;
  const navigate = useNavigate();

  const intentRef = useRef<TransactionIntent>(intentMode === 'single-save' ? 'SAVE' : 'DRAFT');
  const [modalStage, setModalStage] = useState<ModalStage>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [successDetailId, setSuccessDetailId] = useState<string | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  const handleModalClose = () => {
    if (modalStage === 'loading') return;
    clearTimer();
    setApprovalMessage('');
    setModalStage('idle');
  };

  // Unmount must not leave a pending navigation behind.
  useEffect(() => () => clearTimer(), []);

  const handleActionConfirm = (status: TransactionIntent) => {
    intentRef.current = status;
    if (status === 'PROPOSED') setModalStage('confirm-propose');
    else if (status === 'SAVE') setModalStage('confirm-save');
    else setModalStage('confirm-draft');
  };

  const handleConfirmSubmit = async (handleSubmit: () => Promise<void>) => {
    setModalStage('loading');
    await handleSubmit();
  };

  const handleSuccess = (id: string | null, message: string) => {
    setSuccessDetailId(id);
    setResultMessage(message);
    setModalStage('success');
    clearTimer();
    resultTimerRef.current = window.setTimeout(() => navigate(redirectOnSuccess(id)), SUCCESS_REDIRECT_MS);
  };

  const handleError = (message: string) => {
    setResultMessage(message);
    setModalStage('error');
  };

  const handleViewDetail = () => {
    navigate(redirectOnSuccess(successDetailId));
  };

  return {
    intent: intentRef.current,
    modalStage,
    resultMessage,
    approvalMessage,
    setApprovalMessage,
    successDetailId,
    isSubmitting: modalStage === 'loading',
    clearTimer,
    handleModalClose,
    handleActionConfirm,
    handleConfirmSubmit,
    handleSuccess,
    handleError,
    handleViewDetail,
  };
}
