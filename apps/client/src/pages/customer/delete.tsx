import { useState } from 'react';
import { Button, Modal, toast } from '@heroui/react';

import { DeleteModalHeader } from '@/components/shared-ui';
import { customerRepository } from '@/repositories/customer';

type Customer = Awaited<ReturnType<typeof customerRepository.table>>['data'][0];

interface CustomerDeleteModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerDeleteModal({
  isOpen,
  customer,
  onClose,
  onSuccess,
}: CustomerDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    if (!customer) return;
    try {
      setLoading(true);
      await customerRepository.delete(customer.id);
      onSuccess();
      toast.success('Customer berhasil dihapus', {
        description: `Customer ${customer.nama} berhasil dihapus`,
      });
      onClose();
    } catch {
      toast.danger('Gagal menghapus customer', {
        description: 'Terjadi kesalahan saat menghapus customer',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <DeleteModalHeader resource='Customer' />
            </Modal.Header>
            <Modal.Body>
              <p className='text-default-600'>
                Apakah Anda yakin ingin menghapus customer{' '}
                <strong>{customer?.nama}</strong>?
              </p>
              <p className='text-sm text-default-500 mt-2'>
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="danger"
                color='default'
                isDisabled={loading}
                slot='close'>
                Batal
              </Button>
              <Button
                color='danger'
                variant="danger"
                isDisabled={loading}
                isLoading={loading}
                onPress={handleDelete}>
                Hapus
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
