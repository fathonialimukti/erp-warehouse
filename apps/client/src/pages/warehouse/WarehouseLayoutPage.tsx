import { Card } from '@heroui/react';
import GlbCanvasViewer from '../../components/GlbCanvasViewer';

const WAREHOUSE_LAYOUT_GLB = '/glb/warehouse-layout.glb';

export default function WarehouseLayoutPage() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Warehouse Layout 3D
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Interactive warehouse map powered by GLB. Place your file at
          {' '}
          apps/client/public/glb/warehouse-layout.glb.
        </p>
      </div>

      <Card className="bg-white p-0 dark:bg-gray-900">
        <GlbCanvasViewer
          className="h-[70vh] min-h-[460px] w-full"
          modelUrl={WAREHOUSE_LAYOUT_GLB}
        />
      </Card>
    </>
  );
}
