import { useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { EntityPhoto } from "./EntityPhoto";

type ImageUploadFieldProps = {
  value?: string;
  onChange: (value?: string) => void;
  disabled?: boolean;
  helperText?: string;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// Mirrors the server's upload allowlist (`IMAGE_EXTENSION_BY_MIME` in
// apps/server/src/lib/upload-file.ts) so the picker never offers a format that
// will be rejected with UNSUPPORTED_IMAGE_FORMAT. `image/svg+xml` is
// deliberately absent: an SVG served inline on the API origin would execute in
// the app's origin, so the server refuses it. `.avif` is not listed either —
// the server only maps `.avif` for *sending* existing files, not for upload.
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

// Some older browsers still report `image/jpg` for .jpg files. The server
// accepts that alias, so rejecting it here would be a false negative.
const ACCEPTED_IMAGE_TYPE_SET: ReadonlySet<string> = new Set([
  ...ACCEPTED_IMAGE_TYPES,
  "image/jpg",
]);

// Resolves `null` on an unreadable file so the caller owns the message and can
// translate it, instead of leaking a raw FileReader error string.
const readFileAsDataUrl = async (file: File) => {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

function ImageUploadField({
  value,
  onChange,
  disabled = false,
  helperText,
}: ImageUploadFieldProps) {
  const intl = useIntl();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const helperTextValue =
    helperText ??
    intl.formatMessage({
      id: "imageupload_helpertext",
      defaultMessage: "JPG, PNG, WEBP, or GIF. Max 5 MB.",
    });

  const handlePick = () => {
    if (disabled) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPE_SET.has(file.type)) {
      setErrorMessage(
        intl.formatMessage({
          id: "imageupload_errorinvalidtype",
          defaultMessage:
            "Unsupported image format. Use JPG, PNG, WEBP, or GIF.",
        }),
      );
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage(
        intl.formatMessage({
          id: "imageupload_errortoolarge",
          defaultMessage: "Image size must be 5 MB or smaller.",
        }),
      );
      return;
    }

    setIsReading(true);
    setErrorMessage(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl === null) {
        setErrorMessage(
          intl.formatMessage({
            id: "imageupload_errorunreadable",
            defaultMessage: "That image could not be read. Try another file.",
          }),
        );
        return;
      }
      onChange(dataUrl);
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-default-50 p-4">
      <div className="flex items-center gap-4">
        <EntityPhoto
          src={value}
          alt={intl.formatMessage({
            id: "imageupload_previewalt",
            defaultMessage: "Preview photo",
          })}
          className="h-20 w-20 rounded-3xl border border-default-200"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              type="button"
              onPress={handlePick}
              isDisabled={disabled || isReading}
            >
              <Icon icon="solar:camera-add-linear" className="size-4" />
              {value
                ? intl.formatMessage({
                    id: "imageupload_replacebutton",
                    defaultMessage: "Replace Photo",
                  })
                : intl.formatMessage({
                    id: "imageupload_choosebutton",
                    defaultMessage: "Choose Photo",
                  })}
            </Button>
            {value && (
              <Button
                variant="ghost"
                type="button"
                onPress={() => onChange(undefined)}
                isDisabled={disabled || isReading}
              >
                {intl.formatMessage({
                  id: "imageupload_removebutton",
                  defaultMessage: "Remove Photo",
                })}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            {isReading
              ? intl.formatMessage({
                  id: "imageupload_readingfile",
                  defaultMessage: "Reading image file...",
                })
              : helperTextValue}
          </p>
          {errorMessage && (
            <p className="text-xs text-danger">{errorMessage}</p>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  );
}

export { ImageUploadField };
