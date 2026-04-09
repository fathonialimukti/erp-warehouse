import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';

const transactionPages = [
  { label: 'Masuk', path: '/transaksi/masuk', icon: 'solar:download-linear' },
  { label: 'Keluar', path: '/transaksi/keluar', icon: 'solar:upload-linear' },
  { label: 'Temuan', path: '/transaksi/temuan', icon: 'solar:search-minimalistic-linear' },
  { label: 'Kehilangan', path: '/transaksi/kehilangan', icon: 'solar:warning-linear' },
];

export default function TransaksiIndexPage() {
  const navigate = useNavigate();

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header>
          <Card.Title className="text-2xl">Transaksi Gudang</Card.Title>
          <Card.Description>
            Pilih jenis transaksi untuk melihat daftar, membuat data baru, atau membuka detail transaksi.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {transactionPages.map((item) => (
              <Card
                key={item.path}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => navigate(item.path)}
              >
                <Card.Content className="flex items-center gap-3">
                  <Icon icon={item.icon} className="size-6 text-primary" />
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-sm text-muted">Buka halaman {item.label.toLowerCase()}.</p>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
