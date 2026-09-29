import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { QrLabelPrintModal } from "../../components/QrLabelPrintModal";

export interface ItemQrEntry {
  /** Transaction item id — unique value encoded into the QR. */
  id: string;
  skuName: string;
  skuCode: string;
}

interface Props {
  items: ItemQrEntry[];
  /** Formatted receive date shown on every label. */
  receivedDate: string;
  /** Source line value (supplier name / work order ref / reason…), if any. */
  sourceValue?: string | null;
  /** Resolved source label text (e.g. "Supplier"). */
  sourceLabel?: string;
  /** PDF file name stem, e.g. `${documentNumber}-qr-labels`. */
  fileName: string;
}

/**
 * "Print QR Codes" — opens a client-side PDF preview modal (one A8 landscape
 * page per item: QR left + item name / code / receive date / source right)
 * with browser-print and download actions.
 */
function ItemQrPrintButton({
  items,
  receivedDate,
  sourceValue,
  sourceLabel,
  fileName,
}: Props) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const itemCode = intl.formatMessage({
    id: "print.qr.item_code",
    defaultMessage: "Item Code",
  });
  const receivedLabel = intl.formatMessage({
    id: "print.qr.received_date",
    defaultMessage: "Receive Date",
  });

  const rows = items.map((item) => ({
    qrValue: item.id,
    name: item.skuName,
    fields: [
      { label: itemCode, value: item.skuCode || "—", mono: true },
      { label: receivedLabel, value: receivedDate },
      ...(sourceValue
        ? [{ label: sourceLabel ?? "", value: sourceValue }]
        : []),
    ],
  }));

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        isDisabled={items.length === 0}
        onPress={() => setIsOpen(true)}
      >
        <Icon
          icon="solar:qr-code-bold-duotone"
          style={{ width: 16, height: 16 }}
        />
        {intl.formatMessage({
          id: "print.qr.print_items",
          defaultMessage: "Print QR Codes",
        })}
      </Button>
      <QrLabelPrintModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={intl.formatMessage({
          id: "print.qr.items_title",
          defaultMessage: "Received Items QR Labels",
        })}
        rows={rows}
        fileName={fileName}
      />
    </>
  );
}

export { ItemQrPrintButton };
