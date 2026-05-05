import { Icon } from '@iconify/react';
import { Button, Card } from '@heroui/react';
import type { PalletInteractionInfo } from './_WarehouseScene';

interface DetailModalProps {
  data: { x: number; y: number; info: PalletInteractionInfo };
  onClose: () => void;
}

export function DetailModal({ data, onClose }: DetailModalProps) {
  const { x, y, info } = data;

  return (
    <div
      style={{ position: 'fixed', top: y, left: x, zIndex: 10000, minWidth: '260px', maxWidth: '320px' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <Card.Title>Pallet Detail</Card.Title>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close detail" onPress={onClose}>
              <Icon icon="mdi:close" className="size-4" />
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-muted">Location</p>
            <p className="text-sm font-medium text-foreground">{info.storageLocationId ?? info.lokasiId}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">Pallet</p>
            <p className="text-sm font-medium text-foreground">{info.palletTypeName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">SKU</p>
            <p className="text-sm font-medium text-foreground">{info.skuName ?? '—'}</p>
          </div>
          {info.inboundTransactionId ? (
            <div>
              <p className="text-xs font-semibold text-muted">Inbound Transaction</p>
              <a
                href={`/transactions/inbound/${info.inboundTransactionId}`}
                className="text-sm font-medium font-mono text-primary hover:underline"
              >
                {info.inboundTransactionId}
              </a>
            </div>
          ) : null}
        </Card.Content>
        <Card.Footer className="flex justify-end">
          <Button variant="ghost" onPress={onClose}>Close</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
