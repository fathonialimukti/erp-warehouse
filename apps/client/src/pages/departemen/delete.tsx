import { useState, useCallback } from 'react';
import { Button, Modal, toast } from '@heroui/react';
import { Trash2 } from 'lucide-react';

import { departemenRepository } from '@/repositories/departemen';

type Departemen = Awaited<
  ReturnType<typeof departemenRepository.table>
>['data'][0];

interface DepartemenDeleteModalProps {
  departemen: Departemen | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DepartemenDeleteModal({
  departemen,
  isOpen,
  onClose,
  onSuccess,
}: DepartemenDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!departemen) return;

    try {
      setDeleting(true);
      await departemenRepository.delete(departemen.id);
      onSuccess();
      toast.success('Departemen berhasil dihapus', {
        description: `Departemen ${departemen.nama} berhasil dihapus`,
      });
      onClose();
    } catch (error) {
      toast.danger('Gagal menghapus departemen', {
        description:
          String(error) || 'Terjadi kesalahan saat menghapus departemen',
      });
      // Failed to delete departemen
    } finally {
      setDeleting(false);
    }
  }, [departemen, onSuccess, onClose]);

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className='flex items-center gap-2'>
              <Trash2 className='h-5 w-5 text-danger' />
              Hapus Departemen
            </Modal.Header>
            <Modal.Body>
              <p className='text-default-600'>
                Apakah Anda yakin ingin menghapus departemen{' '}
                <span className='font-semibold'>
                  &ldquo;{departemen?.nama}&rdquo;
                </span>
                ?
              </p>
              <p className='text-sm text-default-500 mt-2'>
                Tindakan ini tidak dapat dibatalkan dan akan mempengaruhi semua
                karyawan di departemen ini.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant='ghost' isDisabled={deleting} slot='close'>
                Batal
              </Button>
              <Button
                variant='danger'
                isDisabled={deleting}
                isLoading={deleting}
                startContent={!deleting && <Trash2 className='h-4 w-4' />}
                onPress={handleDelete}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
