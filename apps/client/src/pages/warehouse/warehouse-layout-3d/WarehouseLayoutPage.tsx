import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card } from '@heroui/react';
import {
  WarehouseScene,
  type PalletInteractionInfo,
  type WarehouseDataSourceMode,
} from './_WarehouseScene';
import { DetailModal } from './_DetailModal';

/** Switch to `'live'` to load layout from the database (TRPC). */
const WAREHOUSE_DATA_SOURCE: WarehouseDataSourceMode = 'live'; // 'live' || 'mock'

/**
 * When `WAREHOUSE_DATA_SOURCE === 'mock'`, also render a pallet model at every
 * `floor_placeholder.*` from the GLB (same behaviour as the old stress test).
 */
const WAREHOUSE_MOCK_FILL_ALL_PLACEHOLDERS = true;

function WarehouseLayoutPage() {
  const { id } = useParams<{ id: string }>();
  const showGrid = false;
  const [detailModal, setDetailModal] = useState<{ x: number; y: number; info: PalletInteractionInfo } | null>(null);

  useEffect(() => {
    if (!detailModal) return;
    const closeAll = () => setDetailModal(null);
    document.addEventListener('pointerdown', closeAll);
    return () => document.removeEventListener('pointerdown', closeAll);
  }, [detailModal]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailModal(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div>
      <Card>
        <Card.Content>
          <WarehouseScene
            height={700}
            showGrid={showGrid}
            dataSource={WAREHOUSE_DATA_SOURCE}
            warehouseId={id}
            mockFillAllPlaceholders={
              WAREHOUSE_DATA_SOURCE === 'mock' && WAREHOUSE_MOCK_FILL_ALL_PLACEHOLDERS
            }
            onPalletClick={(info) => {
              const modalW = 340;
              const modalH = 300;
              const x = info.screenX + modalW > window.innerWidth ? info.screenX - modalW : info.screenX + 4;
              const y = info.screenY + modalH > window.innerHeight ? info.screenY - modalH : info.screenY + 4;
              setDetailModal({ x, y, info });
            }}
            onPalletContextMenu={() => {
              // Intentionally empty for now; right-click behavior will be redesigned.
            }}
          />
        </Card.Content>
      </Card>

      {detailModal && (
        <DetailModal
          data={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}

export { WarehouseLayoutPage };
