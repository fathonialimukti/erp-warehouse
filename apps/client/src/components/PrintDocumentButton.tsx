import { useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useIntl } from "react-intl";
import type { TransactionType } from "../lib/transaction-document";
import { TransactionDocumentModal } from "../pages/transactions/TransactionDocumentModal";

interface Props {
  /** Transaction type slug (e.g. 'receiving', 'shipment'). */
  type: TransactionType;
  transactionId: string;
}

/** Opens the transaction document viewer modal (preview + PDF download). */
function PrintDocumentButton({ type, transactionId }: Props) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onPress={() => setIsOpen(true)}>
        <Icon
          icon="solar:printer-bold-duotone"
          style={{ width: 16, height: 16 }}
        />
        {intl.formatMessage({
          id: "print.document.print",
          defaultMessage: "Print / PDF",
        })}
      </Button>
      <TransactionDocumentModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        type={type}
        transactionId={transactionId}
      />
    </>
  );
}

export { PrintDocumentButton };
