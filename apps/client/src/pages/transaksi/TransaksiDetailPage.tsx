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

export default function TransaksiDetailPage() {
  const navigate = useNavigate();
  const { type, id } = useParams<{ type?: string; id?: string }>();
  const transaksiType = getTransaksiType(type);

  if (!transaksiType || !id) {
    return (
      <section className="space-y-4">
        <Card>
          <Card.Header>
            <Card.Title>Detail transaksi tidak valid</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-sm text-muted">Tipe transaksi atau ID tidak dikenali. Pastikan URL sesuai format yang diminta.</p>
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
            <Card.Title>Detail {LABELS[transaksiType]}</Card.Title>
            <Card.Description>
              Menampilkan informasi transaksi {LABELS[transaksiType].toLowerCase()} dengan ID {id}.
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transaksi')}>
            <Icon icon="solar:arrow-left-linear" className="size-4" />
            Kembali
          </Button>
        </Card.Header>

        <Card.Content>
          <p className="text-sm text-muted">
            Konten detail masih berupa placeholder. Ganti dengan tampilan data transaksi, status approval, dan jejak audit.
          </p>
        </Card.Content>
      </Card>
    </section>
  );
}
