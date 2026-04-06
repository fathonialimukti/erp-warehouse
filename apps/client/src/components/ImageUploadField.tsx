import { useId, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import EntityPhoto from './EntityPhoto';

type ImageUploadFieldProps = {
  value?: string;
  onChange: (value?: string) => void;
  disabled?: boolean;
  helperText?: string;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const readFileAsDataUrl = async (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
};

export default function ImageUploadField({
  value,
  onChange,
  disabled = false,
  helperText = 'JPG, PNG, WEBP, GIF, atau SVG. Maksimal 5 MB.',
}: ImageUploadFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const handlePick = () => {
    if (disabled) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('File harus berupa gambar.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage('Ukuran foto maksimal 5 MB.');
      return;
    }

    setIsReading(true);
    setErrorMessage(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memproses gambar.');
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-default-50 p-4">
      <div className="flex items-center gap-4">
        <EntityPhoto src={value} alt="Preview foto" className="h-20 w-20 rounded-3xl border border-default-200" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onPress={handlePick} isDisabled={disabled || isReading}>
              <Icon icon="solar:camera-add-linear" className="size-4" />
              {value ? 'Ganti Foto' : 'Pilih Foto'}
            </Button>
            {value && (
              <Button variant="ghost" type="button" onPress={() => onChange(undefined)} isDisabled={disabled || isReading}>
                Hapus Foto
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">{isReading ? 'Membaca file gambar...' : helperText}</p>
          {errorMessage && <p className="text-xs text-danger">{errorMessage}</p>}
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  );
}