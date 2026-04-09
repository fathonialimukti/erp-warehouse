import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';

const LABELS = {
  masuk: 'Masuk',
  keluar: 'Pengeluaran',
  temuan: 'Temuan',
  kehilangan: 'Kehilangan',
} as const;

type TransaksiType = keyof typeof LABELS;

const getTransaksiType = (type?: string): TransaksiType | null => {
  if (!type) return null;
  const normalized = type.toLowerCase();
  if (normalized === 'pengeluaran') return 'keluar';
  return normalized in LABELS ? (normalized as TransaksiType) : null;
};

export default function TransaksiFormPage() {
  const navigate = useNavigate();
  const { type, id } = useParams<{ type?: string; id?: string }>();
  const transaksiType = getTransaksiType(type);
  const isEdit = Boolean(id);

  if (!transaksiType) {
    return (
      <section className="space-y-4">
        <Card>
          <Card.Header>
            <Card.Title>Tipe transaksi tidak valid</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-sm text-muted">Tipe transaksi tidak dikenali. Gunakan satu dari: masuk, pengeluaran, temuan, kehilangan.</p>
          </Card.Content>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title>{isEdit ? `Edit ${LABELS[transaksiType]}` : `Form ${LABELS[transaksiType]}`}</Card.Title>
            <Card.Description>
              Halaman formulir untuk transaksi {LABELS[transaksiType].toLowerCase()}.
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transaksi')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            Kembali
          </Button>
        </Card.Header>

        <Card.Content>
          <p className="text-sm text-muted">
            Kerangka form ini siap diisi dengan field transaksi {LABELS[transaksiType].toLowerCase()}.
            Gunakan field tipe, lokasi, SKU, jumlah, dan approval sesuai kebutuhan backend.
          </p>
        </Card.Content>
      </Card>
    </section>
  );
}
