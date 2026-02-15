import { useState } from 'react';
import { Modal, Input } from '@heroui/react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string;
  exportFn: () => Promise<void>;
  importFn?: (file: File) => Promise<void>; // Made optional since backend might not be ready
  downloadTemplateFn: () => Promise<void>;
}

export function ExportImportModal({
  isOpen,
  onClose,
  modelName,
  exportFn,
  importFn,
  downloadTemplateFn,
}: ExportImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    if (!importFn) {
      // Backend not ready - show message
      alert(
        `Import functionality for ${modelName} is not yet available. Backend implementation needed.`,
      );
      return;
    }

    setImporting(true);
    try {
      await importFn(selectedFile);
      setSelectedFile(null);
      onClose();
    } catch {
      // Error is handled in importFn
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportFn();
    } catch {
      // Error is handled in exportFn
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadTemplateFn();
    } catch {
      // Error is handled in downloadTemplateFn
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>Export / Import {modelName}</Modal.Header>
            <Modal.Body>
              <div className='space-y-4'>
                <div>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className='w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2'>
                    <FileSpreadsheet size={16} />
                    {exporting ? 'Exporting...' : 'Export to Excel'}
                  </button>
                </div>

                <div>
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={downloading}
                    className='w-full px-4 py-2 border border-default-300 rounded-lg hover:bg-default-100 disabled:opacity-50 flex items-center justify-center gap-2'>
                    <Download size={16} />
                    {downloading ? 'Downloading...' : 'Download Template'}
                  </button>
                </div>

                <div className='border-t pt-4'>
                  <h4 className='text-sm font-medium mb-2'>
                    Import from Excel
                  </h4>
                  <Input
                    type='file'
                    accept='.xlsx,.xls'
                    onChange={handleFileChange}
                    className='mb-2'
                  />
                  <button
                    onClick={handleImport}
                    disabled={!selectedFile || !importFn || importing}
                    className='w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2'>
                    <Upload size={16} />
                    {importing
                      ? 'Importing...'
                      : importFn
                        ? 'Import File'
                        : 'Import Not Available'}
                  </button>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <button
                onClick={onClose}
                className='px-4 py-2 border border-default-300 rounded-lg hover:bg-default-100'>
                Close
              </button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
