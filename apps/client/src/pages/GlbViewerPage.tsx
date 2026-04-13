import { useState } from 'react';
import { Button, Card, Input } from '@heroui/react';
import GlbCanvasViewer from '../components/GlbCanvasViewer';

export default function GlbViewerPage() {
  const [draftPath, setDraftPath] = useState('/glb/example.glb');
  const [modelPath, setModelPath] = useState('/glb/example.glb');

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          GLB 3D Viewer
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Load and inspect GLB models directly in the ERP client.
        </p>
      </div>

      <Card className="bg-white p-4 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">GLB URL</p>
          <Input
            value={draftPath}
            onChange={(event) => setDraftPath(event.target.value)}
            placeholder="/glb/example.glb"
            variant="secondary"
          />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Put your .glb file inside apps/client/public/glb, then use /glb/your-model.glb
            </p>
          </div>
          <Button variant="primary" onPress={() => setModelPath(draftPath.trim())}>
            Load Model
          </Button>
        </div>
      </Card>

      <Card className="bg-white p-0 dark:bg-gray-900">
        <GlbCanvasViewer className="h-[520px] w-full" modelUrl={modelPath || undefined} />
      </Card>
    </>
  );
}
