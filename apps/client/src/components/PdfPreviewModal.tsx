import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Button, Modal } from "@heroui/react";
import { AppIcon } from "./AppIcon";
import { SpinnerIcon } from "../assets/IconRegistry";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Download file name — sanitized, `.pdf` appended if missing. */
  fileName: string;
  /** Builds the PDF client-side. Invoked shortly after the modal opens so
   * offscreen sources (e.g. QR canvases) can paint first. */
  buildBlob: () => Blob;
  /** Change this string to regenerate the blob when the data changes. */
  buildKey?: string;
  /** Suppress generation while the caller fetches data. */
  loading?: boolean;
  /** Localized error message — shows an error body instead of the preview. */
  error?: string | null;
}

/** `${stem}.pdf` with path-unsafe chars stripped; `document` fallback. */
function pdfFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, "");
  const safe = base.replace(/[/\\?%*:|"<>]+/g, "-").trim();
  return `${safe.length > 0 ? safe : "document"}.pdf`;
}

/**
 * Client-side PDF preview modal: `buildBlob()` runs entirely in the browser,
 * the Blob is embedded via <iframe> (the browser's native PDF viewer) and
 * printed from there — no download link, no server round-trip.
 */
function PdfPreviewModal({
  isOpen,
  onOpenChange,
  title,
  fileName,
  buildBlob,
  buildKey,
  loading = false,
  error = null,
}: Props) {
  const intl = useIntl();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const urlRef = useRef<string | null>(null);
  const buildRef = useRef(buildBlob);
  buildRef.current = buildBlob;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const downloadName = useMemo(() => pdfFileName(fileName), [fileName]);

  useEffect(() => {
    if (!isOpen || loading || error) return;
    setPdfUrl(null);
    setFailed(false);
    let cancelled = false;
    // Small delay so offscreen sources (e.g. QR canvases) paint before rasterizing
    const timer = window.setTimeout(() => {
      try {
        const blob = buildRef.current();
        if (cancelled) return;
        urlRef.current = URL.createObjectURL(blob);
        setPdfUrl(urlRef.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [isOpen, loading, error, buildKey]);

  const handlePrint = () => {
    try {
      const frame = iframeRef.current;
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch {
      // Some PDF viewers block frame print — hand the PDF to a full tab instead
      if (urlRef.current) window.open(urlRef.current, "_blank");
    }
  };

  const handleDownload = () => {
    if (!urlRef.current) return;
    const anchor = document.createElement("a");
    anchor.href = urlRef.current;
    anchor.download = downloadName;
    anchor.click();
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog aria-label={title} className="sm:max-w-3xl">
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {pdfUrl && !error ? (
                <iframe
                  ref={iframeRef}
                  src={pdfUrl}
                  title={title}
                  className="h-[65vh] w-full rounded-xl border border-border bg-surface-secondary"
                />
              ) : error || failed ? (
                <div className="flex h-[65vh] flex-col items-center justify-center gap-3">
                  <AppIcon name="warning" className="size-10 text-danger" />
                  <p className="text-sm text-muted">
                    {error ??
                      intl.formatMessage({
                        id: "print.pdf.error",
                        defaultMessage: "Failed to generate the PDF.",
                      })}
                  </p>
                </div>
              ) : (
                <div className="flex h-[65vh] flex-col items-center justify-center gap-4">
                  <SpinnerIcon size={32} className="animate-spin text-accent" />
                  <p className="text-sm text-muted">
                    {intl.formatMessage({
                      id: "common.loading",
                      defaultMessage: "Loading…",
                    })}
                  </p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                {intl.formatMessage({
                  id: "print.document.close",
                  defaultMessage: "Close",
                })}
              </Button>
              <Button
                variant="ghost"
                isDisabled={!pdfUrl}
                onPress={handleDownload}
              >
                <AppIcon name="download" style={{ width: 16, height: 16 }} />
                {intl.formatMessage({
                  id: "print.document.download",
                  defaultMessage: "Download PDF",
                })}
              </Button>
              <Button
                variant="primary"
                isDisabled={!pdfUrl}
                onPress={handlePrint}
              >
                <AppIcon name="printer" style={{ width: 16, height: 16 }} />
                {intl.formatMessage({
                  id: "print.pdf.print_save",
                  defaultMessage: "Print / Save PDF",
                })}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export { PdfPreviewModal };
