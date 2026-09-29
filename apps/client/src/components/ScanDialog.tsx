import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { Icon } from "@iconify/react";
import { trpcClient } from "../lib/trpc";

/**
 * Camera QR/barcode scanner (BarcodeDetector API, Chromium + Android).
 * Falls back to manual entry when the API or camera is unavailable —
 * the scanned/typed pallet number is looked up and navigated to.
 */
export function ScanDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const lookupAndNavigate = async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;
    setResolving(true);
    setLookupError(null);
    try {
      const result = await trpcClient.pallet.list.query({
        page: 1,
        limit: 1,
        search: value,
      });
      const pallet = result.data[0];
      if (pallet) {
        onOpenChange(false);
        navigate(`/pallets/${pallet.id}`);
      } else {
        setLookupError(
          intl.formatMessage(
            {
              id: "scan.not_found",
              defaultMessage: 'No pallet matches "{value}".',
            },
            { value },
          ),
        );
      }
    } catch {
      setLookupError(
        intl.formatMessage({
          id: "scan.lookup_failed",
          defaultMessage: "Lookup failed. Try again.",
        }),
      );
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const Detector =
      typeof window !== "undefined" ? window.BarcodeDetector : undefined;
    setSupported(Boolean(Detector));
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        if (Detector) {
          const detector = new Detector({
            formats: ["qr_code", "code_128", "code_39", "ean_13"],
          });
          let lastRead = "";
          let lastReadAt = 0;
          interval = setInterval(() => {
            void (async () => {
              if (!videoRef.current || videoRef.current.readyState < 2) return;
              try {
                const codes = await detector.detect(videoRef.current);
                const first = codes[0]?.rawValue;
                if (
                  first &&
                  !(first === lastRead && Date.now() - lastReadAt < 4000)
                ) {
                  lastRead = first;
                  lastReadAt = Date.now();
                  await lookupAndNavigate(first);
                }
              } catch {
                // transient frame errors — keep scanning
              }
            })();
          }, 350);
        }
      } catch {
        setError(
          intl.formatMessage({
            id: "scan.camera_denied",
            defaultMessage: "Camera unavailable. Use manual entry below.",
          }),
        );
        setSupported(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {intl.formatMessage({
                  id: "scan.title",
                  defaultMessage: "Scan Pallet",
                })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                {supported !== false ? (
                  <div className="overflow-hidden rounded-2xl border bg-black/90">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="aspect-video w-full object-cover"
                      aria-label={intl.formatMessage({
                        id: "scan.video_aria",
                        defaultMessage: "Camera preview",
                      })}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    <div className="flex items-start gap-2">
                      <Icon
                        icon="solar:danger-triangle-linear"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        {error ??
                          intl.formatMessage({
                            id: "scan.unsupported",
                            defaultMessage:
                              "Camera scanning is not supported here. Use manual entry below.",
                          })}
                      </span>
                    </div>
                  </div>
                )}

                <TextField fullWidth name="scan-manual">
                  <Label>
                    {intl.formatMessage({
                      id: "scan.manual_label",
                      defaultMessage: "Or type the pallet number",
                    })}
                  </Label>
                  <Input
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        void lookupAndNavigate(manualValue);
                    }}
                    placeholder="2609010001"
                    variant="secondary"
                    aria-label={intl.formatMessage({
                      id: "scan.manual_label",
                      defaultMessage: "Pallet number",
                    })}
                  />
                </TextField>

                {lookupError ? (
                  <p className="text-sm text-danger">{lookupError}</p>
                ) : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => onOpenChange(false)}>
                {intl.formatMessage({
                  id: "action_cancel",
                  defaultMessage: "Cancel",
                })}
              </Button>
              <Button
                variant="primary"
                isPending={resolving}
                onPress={() => void lookupAndNavigate(manualValue)}
              >
                <Icon icon="solar:magnifer-linear" className="size-4" />
                {intl.formatMessage({
                  id: "scan.lookup",
                  defaultMessage: "Find pallet",
                })}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
