import { Icon } from '@iconify/react';
import { Button, Card } from '@heroui/react';
import type { PalletInteractionInfo } from './_WarehouseScene';

interface DetailModalProps {
  data: { x: number; y: number; info: PalletInteractionInfo };
  onClose: () => void;
  onOpenInbound: (inboundTransactionId: string) => void;
}

export function DetailModal({ data, onClose, onOpenInbound }: DetailModalProps) {
  const { x, y, info } = data;

  return (
    <div
      style={{ position: 'fixed', top: y, left: x, zIndex: 10000, minWidth: '280px', maxWidth: '340px' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Card>
        <Card.Header>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <Card.Description className="font-semibold">
                {info.storageLocationId ?? info.lokasiId}
              </Card.Description>
              <Card.Description>Pallet: {info.palletId}</Card.Description>
              <Card.Description>Inbound: {info.inboundTransactionId ?? '-'}</Card.Description>
            </div>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close detail" onPress={onClose}>
              <Icon icon="solar:close-linear" className="size-4" />
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="grid grid-cols-2 gap-3 px-3 pb-3">
          {([
            { label: 'Type', value: info.assetKey },
            { label: 'Inbound Item', value: info.inboundTransactionItemId ?? '-' },
          ] as { label: string; value: string }[]).map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs font-semibold text-muted">{label}</p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </Card.Content>
        <Card.Footer className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>Close</Button>
          <Button
            variant="primary"
            isDisabled={!info.inboundTransactionId}
            onPress={() => {
              if (!info.inboundTransactionId) {
                return;
              }
              onOpenInbound(info.inboundTransactionId);
            }}
          >
            Open Inbound
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
