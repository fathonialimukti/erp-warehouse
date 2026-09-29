import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import type { TransactionType } from "../../lib/transaction-document";
import {
  ADAPTERS,
  isTransactionType,
  normalizeDetail,
} from "../../lib/transaction-document";
import {
  buildTransactionPdfBlob,
  type TransactionPdfLabels,
} from "../../lib/transaction-pdf";
import { PdfPreviewModal } from "../../components/PdfPreviewModal";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Transaction type slug (e.g. 'receiving', 'shipment'). */
  type: TransactionType;
  transactionId: string;
}

/**
 * A4 transaction document (Goods Received Note, Shipment Document, …) as a
 * client-side PDF preview modal with browser-print and download actions.
 */
function TransactionDocumentModal({
  isOpen,
  onOpenChange,
  type,
  transactionId,
}: Props) {
  const intl = useIntl();
  const t = (k: string, fallback: string) =>
    intl.formatMessage({ id: k, defaultMessage: fallback });
  const validType = isTransactionType(type) ? type : null;

  const {
    data: rawDetail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["transactionDocument", validType, transactionId],
    enabled: isOpen && Boolean(validType && transactionId),
    queryFn: () =>
      validType
        ? ADAPTERS[validType].fetch(transactionId)
        : Promise.resolve(null),
  });

  // Memoized so background refetches don't rebuild the preview unnecessarily
  // (normalizeDetail returns a fresh object each call otherwise).
  const doc = useMemo(
    () =>
      validType && rawDetail
        ? normalizeDetail(validType, rawDetail, intl)
        : null,
    [validType, rawDetail, intl],
  );

  const docTitle = validType
    ? t(`print.document.title.${validType.replace(/-/g, "_")}`, validType)
    : type;
  const hasError = !validType || isError || (!isLoading && !rawDetail);

  const labels: TransactionPdfLabels = {
    number: t("print.document.number", "Number"),
    warehouse: t("print.document.warehouse", "Warehouse"),
    counterparty: t("print.document.counterparty", "Counterparty"),
    reference: t("print.document.reference", "Reference"),
    reason: t("print.document.reason", "Reason"),
    skuCode: t("print.document.sku_code", "SKU Code"),
    skuName: t("print.document.sku_name", "SKU Name"),
    qty: t("print.document.qty", "Qty"),
    details: t("print.document.details", "Details"),
    total: t("print.document.total", "Total"),
    noItems: t("print.document.no_items", "No items."),
    createdBy: t("print.document.created_by", "Created by"),
    approvedBy: t("print.document.approved_by", "Approved by"),
    preparedBy: t("print.document.prepared_by", "Prepared by"),
  };

  return (
    <PdfPreviewModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={docTitle}
      fileName={`${doc?.number ?? docTitle}.pdf`}
      loading={isLoading || !doc}
      error={
        hasError
          ? t("print.document.not_found", "Transaction not found.")
          : null
      }
      buildKey={doc ? JSON.stringify(doc) : undefined}
      buildBlob={() => {
        if (!doc) throw new Error("transaction document not loaded");
        return buildTransactionPdfBlob(doc, docTitle, labels);
      }}
    />
  );
}

export { TransactionDocumentModal };
