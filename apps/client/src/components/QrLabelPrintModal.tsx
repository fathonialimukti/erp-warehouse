import { useMemo, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { buildQrLabelsPdfBlob, type QrLabelField } from "../lib/qr-label-pdf";
import { PdfPreviewModal } from "./PdfPreviewModal";

export interface QrLabelRowInput {
  /** String encoded into the QR; also printed as the number under it. */
  qrValue: string;
  /** Bold headline on the right section (item name). */
  name: string;
  /** Detail rows (item code, receive date, supplier…). */
  fields: QrLabelField[];
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One row → one A8 landscape page (QR left, details right). */
  rows: QrLabelRowInput[];
  /** PDF file name stem, e.g. `${documentNumber}-qr-labels`. */
  fileName: string;
}

/**
 * QR label print modal (client-side PDF preview + print/download via
 * PdfPreviewModal). QRs are rendered offscreen via QRCodeCanvas and read as
 * PNG data URLs; one A8 landscape page per row — QR left, details right.
 */
function QrLabelPrintModal({
  isOpen,
  onOpenChange,
  title,
  rows,
  fileName,
}: Props) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Offscreen QR canvases — one per unique value, rasterized into the PDF
  const uniqueValues = useMemo(
    () => [...new Set(rows.map((row) => row.qrValue))],
    [rows],
  );
  // rows identity churns on parent re-renders — key the rebuild on a stable signature
  const rowsKey = useMemo(() => JSON.stringify(rows), [rows]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  return (
    <>
      <PdfPreviewModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title={title}
        fileName={fileName}
        buildKey={rowsKey}
        buildBlob={() => {
          const dataUrls = new Map<string, string>();
          canvasWrapRef.current
            ?.querySelectorAll("canvas")
            .forEach((canvas, index) => {
              const value = uniqueValues[index];
              if (value)
                dataUrls.set(
                  value,
                  (canvas as HTMLCanvasElement).toDataURL("image/png"),
                );
            });
          return buildQrLabelsPdfBlob(
            rowsRef.current.map((row) => ({
              ...row,
              qrDataUrl: dataUrls.get(row.qrValue) ?? null,
            })),
          );
        }}
      />
      {/* Offscreen QR raster source (mounted only while the modal is open) */}
      {isOpen ? (
        <div
          ref={canvasWrapRef}
          aria-hidden
          className="pointer-events-none fixed -left-[9999px] top-0 opacity-0"
        >
          {uniqueValues.map((value) => (
            <QRCodeCanvas
              key={value}
              value={value}
              size={256}
              level="M"
              marginSize={0}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export { QrLabelPrintModal };
