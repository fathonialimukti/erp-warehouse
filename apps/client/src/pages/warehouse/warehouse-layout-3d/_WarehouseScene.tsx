import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Bounds,
  Grid,
  Html,
  KeyboardControls,
  useGLTF,
} from '@react-three/drei';
import { useQuery } from '@tanstack/react-query';
import * as THREE from 'three';
export type { PalletInteractionInfo };
import { getGlbAssetUrl, type GlbAssetKey } from '../../../lib/glb-assets';
import { trpcClient } from '../../../lib/trpc';
import { WAREHOUSE_LAYOUT_MOCK_ROWS } from '../../../lib/warehouse-layout-mock';
import { PalletInteractionInfo, preloadWarehouseModels } from './_WarehouseModel';
import { KeyboardHandler } from './_KeyboardHandler';
import { SceneCameraControls } from './_SceneCameraControls';
import { SceneGizmo } from './_SceneGizmo';
import { SceneLighting } from './_SceneLighting';
import { SackOnPallet } from '../../../assets/object/SackOnPallet';
import { CartonOnPallet } from '../../../assets/object/CartonOnPallet';
import { CrateOnPallet } from '../../../assets/object/CrateOnPallet';
import { DrumOnPallet } from '../../../assets/object/DrumOnPallet';
import { IBCOnPallet } from '../../../assets/object/IBCOnPallet';

const OBJECT_COMPONENT_MAP: Record<string, React.ComponentType<{
  transforms?: { position: [number, number, number]; rotation?: [number, number, number] }[];
  onClick?: (idx: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onContextMenu?: (idx: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onHover?: (idx: number | null) => void;
}>> = {
  CartonOnPallet,
  CrateOnPallet,
  DrumOnPallet,
  IBCOnPallet,
  SackOnPallet,
  // BrickOnPallet has a different API — falls back to CartonOnPallet
  BrickOnPallet: CartonOnPallet,
};

preloadWarehouseModels();

export type WarehouseDataSourceMode = 'mock' | 'live';

export type WarehouseSceneDiagnostics = {
  totalPalletPlaceholders: number;
  totalFloorPlaceholders: number;
  sourcePalletRows: number;
  renderedPallets: number;
  missingPlaceholderRows: number;
  missingModelRows: number;
};

export type WarehousePerformanceStats = {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  memoryMb: number | null;
};

interface WarehouseSceneProps {
  height?: number;
  showGrid?: boolean;
  dataSource?: WarehouseDataSourceMode;
  /** When `dataSource === 'mock'`, also place models on every `floor_placeholder.*` (old stress behaviour). */
  mockFillAllPlaceholders?: boolean;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
  onPerformanceUpdate?: (stats: WarehousePerformanceStats) => void;
  onPalletClick?: (info: PalletInteractionInfo) => void;
  onPalletContextMenu?: (info: PalletInteractionInfo) => void;
}

type PlaceholderTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

type PlaceholderMaps = {
  palletMap: Map<string, PlaceholderTransform>;
  floorMap: Map<string, PlaceholderTransform>;
};

type SourceLokasiRow = {
  id: string;
  pallet: {
    id: string;
    inboundTransactionItemId: string | null;
    inboundTransactionItem: { inboundTransactionId: string } | null;
    palletType: { id: string; name: string; objectId: string | null; sku: { name: string } } | null;
  } | null;
};

type RenderPlacementItem = {
  palletId: string;
  lokasiId: string;
  storageLocationId: string | null;
  inboundTransactionItemId: string | null;
  inboundTransactionId: string | null;
  palletTypeName: string | null;
  skuName: string | null;
  placeholderName: string;
  objectId: string;
  assetKey: GlbAssetKey;
  placeholderKind: 'pallet' | 'floor';
};

const PLACEHOLDER_PALLET_PREFIX = 'pallet_placeholder.';
const MOCK_FULL_FILL_FLOOR_ASSET_KEY: GlbAssetKey = 'carton_on_pallet';

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[\s-]+/g, '_');

function extractPlaceholderName(
  rawName: string,
  kind: 'pallet' | 'floor',
): string | null {
  const normalized = normalizeName(rawName);
  const keyword = kind === 'pallet' ? 'pallet_placeholder' : 'floor_placeholder';

  if (!normalized.includes(keyword)) {
    return null;
  }

  const suffixMatch = normalized.match(/(\d{1,3})(?!.*\d)/);
  if (!suffixMatch) {
    return null;
  }

  const padded = suffixMatch[1].padStart(3, '0');
  return `${keyword}.${padded}`;
}

function objectToTransform(object3d: THREE.Object3D): PlaceholderTransform {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  object3d.updateWorldMatrix(true, false);
  object3d.matrixWorld.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');

  return {
    position: [position.x, position.y, position.z],
    rotation: [euler.x, euler.y, euler.z],
    scale: [scale.x, scale.y, scale.z],
  };
}

function collectPlaceholderMap(
  root: THREE.Object3D,
  kind: 'pallet' | 'floor',
): Map<string, PlaceholderTransform> {
  const placeholderMap = new Map<string, PlaceholderTransform>();
  root.updateMatrixWorld(true);

  root.traverse((object3d) => {
    const canonicalName = extractPlaceholderName(object3d.name, kind);
    if (!canonicalName) {
      return;
    }
    // Keep first detected transform for each canonical key to avoid duplicate helper nodes.
    if (!placeholderMap.has(canonicalName)) {
      placeholderMap.set(canonicalName, objectToTransform(object3d));
    }
  });

  return placeholderMap;
}

function normalizeLokasiToPlaceholderName(rawLokasiId: string): string | null {
  const match = rawLokasiId.trim().match(/(\d{1,3})$/);
  if (!match) {
    return null;
  }

  return `${PLACEHOLDER_PALLET_PREFIX}${match[1].padStart(3, '0')}`;
}

const FALLBACK_ASSET_KEY: GlbAssetKey = 'carton_on_pallet';

/** Convert PascalCase objectId (e.g. 'CartonOnPallet') to snake_case GLB key (e.g. 'carton_on_pallet'). */
function objectIdToAssetKey(objectId: string): string {
  return objectId.replace(/([A-Z])/g, (_, c, i) => (i > 0 ? '_' : '') + c.toLowerCase());
}

function resolveAssetKey(objectId: string | null | undefined): GlbAssetKey {
  if (!objectId) return FALLBACK_ASSET_KEY;
  const key = objectIdToAssetKey(objectId);
  return getGlbAssetUrl(key) ? (key as GlbAssetKey) : FALLBACK_ASSET_KEY;
}

function WarehouseLayoutModel({
  modelUrl,
  onPlaceholderMaps,
}: {
  modelUrl: string;
  onPlaceholderMaps: (maps: PlaceholderMaps) => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    onPlaceholderMaps({
      palletMap: collectPlaceholderMap(groupRef.current, 'pallet'),
      floorMap: collectPlaceholderMap(groupRef.current, 'floor'),
    });
  }, [clonedScene, onPlaceholderMaps]);

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={[1.2, 1.2, 1.2]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        <p className="text-sm text-gray-600">Loading warehouse...</p>
      </div>
    </Html>
  );
}

function StatsReporter({ onUpdate }: { onUpdate: (stats: WarehousePerformanceStats) => void }) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const elapsed = now - lastTime.current;
    if (elapsed >= 500) {
      const fps = Math.round((frameCount.current / elapsed) * 1000);
      frameCount.current = 0;
      lastTime.current = now;
      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      onUpdate({
        fps,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : null,
      });
    }
  });

  return null;
}

function WarehouseContent({
  showGrid,
  dataSource,
  mockFillAllPlaceholders,
  warehouseId,
  onDiagnosticsChange,
  onPerformanceUpdate,
  onPalletClick,
  onPalletContextMenu,
}: {
  showGrid: boolean;
  dataSource: WarehouseDataSourceMode;
  mockFillAllPlaceholders: boolean;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
  onPerformanceUpdate?: (stats: WarehousePerformanceStats) => void;
  onPalletClick?: (info: PalletInteractionInfo) => void;
  onPalletContextMenu?: (info: PalletInteractionInfo) => void;
}) {
  const warehouseLayout = getGlbAssetUrl('warehouse_layout');
  const [placeholderMaps, setPlaceholderMaps] = useState<PlaceholderMaps>({
    palletMap: new Map<string, PlaceholderTransform>(),
    floorMap: new Map<string, PlaceholderTransform>(),
  });
  const handleLeftClick = (info: PalletInteractionInfo) => {
    onPalletClick?.(info);
  };
  const handleRightClick = (info: PalletInteractionInfo) => {
    onPalletContextMenu?.(info);
  };

  const { data: liveLokasiData } = useQuery({
    queryKey: ['warehouseLayoutScene', warehouseId],
    enabled: dataSource === 'live' && Boolean(warehouseId),
    queryFn: () =>
      trpcClient.warehouse.layout.getScene.query({
        warehouseId: warehouseId ?? '',
      }),
    staleTime: 30_000,
  });

  const sourceRows = useMemo<SourceLokasiRow[]>(() => {
    if (dataSource === 'mock') {
      return WAREHOUSE_LAYOUT_MOCK_ROWS;
    }

    return liveLokasiData ?? [];
  }, [dataSource, liveLokasiData]);

  const placementItems = useMemo<RenderPlacementItem[]>(() => {
    const fromRows: RenderPlacementItem[] = sourceRows
      .filter((row): row is SourceLokasiRow & { pallet: NonNullable<SourceLokasiRow['pallet']> } => row.pallet !== null)
      .flatMap((row) => {
        const placeholderName = normalizeLokasiToPlaceholderName(row.id);
        if (!placeholderName) {
          return [];
        }
        return [{
          palletId: row.pallet.id,
          lokasiId: row.id,
          storageLocationId: row.id,
          inboundTransactionItemId: row.pallet.inboundTransactionItemId,
          inboundTransactionId: row.pallet.inboundTransactionItem?.inboundTransactionId ?? null,
          placeholderName,
          objectId: row.pallet.palletType?.objectId ?? 'CartonOnPallet',
          palletTypeName: row.pallet.palletType?.name ?? null,
          skuName: row.pallet.palletType?.sku?.name ?? null,
          assetKey: resolveAssetKey(row.pallet.palletType?.objectId),
          placeholderKind: 'pallet' as const,
        }];
      });

    if (dataSource !== 'mock' || !mockFillAllPlaceholders) {
      return fromRows;
    }

    const floorItems: RenderPlacementItem[] = Array.from(placeholderMaps.floorMap.keys())
      .sort()
      .map((placeholderName) => ({
        palletId: `mock-floor-${placeholderName}`,
        lokasiId: placeholderName,
        storageLocationId: placeholderName,
        inboundTransactionItemId: null,
        inboundTransactionId: null,
        palletTypeName: null,
        skuName: null,
        placeholderName,
        objectId: MOCK_FULL_FILL_FLOOR_ASSET_KEY,
        assetKey: MOCK_FULL_FILL_FLOOR_ASSET_KEY,
        placeholderKind: 'floor' as const,
      }));

    return [...fromRows, ...floorItems];
  }, [dataSource, mockFillAllPlaceholders, placeholderMaps.floorMap, sourceRows]);

  const resolvedPalletInstances = useMemo(() => {
    return placementItems.map((item) => {
      const placeholder = item.placeholderKind === 'floor'
        ? placeholderMaps.floorMap.get(item.placeholderName)
        : placeholderMaps.palletMap.get(item.placeholderName);
      const modelUrl = getGlbAssetUrl(item.assetKey) ?? getGlbAssetUrl(FALLBACK_ASSET_KEY);
      return {
        ...item,
        placeholder,
        modelUrl,
      };
    });
  }, [placementItems, placeholderMaps]);

  const diagnostics = useMemo<WarehouseSceneDiagnostics>(
    () => ({
      totalPalletPlaceholders: placeholderMaps.palletMap.size,
      totalFloorPlaceholders: placeholderMaps.floorMap.size,
      sourcePalletRows: placementItems.length,
      renderedPallets: resolvedPalletInstances.filter(
        (item) => item.placeholder && (dataSource === 'mock' || Boolean(item.modelUrl)),
      )
        .length,
      missingPlaceholderRows: resolvedPalletInstances.filter((item) => !item.placeholder).length,
      missingModelRows: dataSource === 'mock'
        ? 0
        : resolvedPalletInstances.filter((item) => !item.modelUrl).length,
    }),
    [dataSource, placeholderMaps, placementItems, resolvedPalletInstances],
  );

  useEffect(() => {
    onDiagnosticsChange?.(diagnostics);
  }, [diagnostics, onDiagnosticsChange]);

  const unresolvedPlaceholders = useMemo(
    () => resolvedPalletInstances.filter((item) => !item.placeholder),
    [resolvedPalletInstances],
  );

  /**
   * Live items grouped by objectId — one instanced-mesh component per pallet type.
   * Mirrors the mock rendering pattern for consistent performance.
   */
  const liveGroups = useMemo(() => {
    if (dataSource !== 'live') return [];
    const map = new Map<string, { items: typeof resolvedPalletInstances; transforms: { position: [number, number, number]; rotation: [number, number, number] }[] }>();
    for (const item of resolvedPalletInstances) {
      if (!item.placeholder) continue;
      const key = item.objectId;
      if (!map.has(key)) map.set(key, { items: [], transforms: [] });
      const g = map.get(key)!;
      g.items.push(item);
      g.transforms.push({ position: item.placeholder.position, rotation: item.placeholder.rotation });
    }
    return Array.from(map.entries());
  }, [dataSource, resolvedPalletInstances]);

  /**
   * All mock items that have a resolved placeholder — passed as one batch
   * to a single <SackOnPallet> so instancedMesh covers the full warehouse
   * with just 5 draw calls regardless of pallet count.
   */
  const resolvedMockItems = useMemo(
    () => resolvedPalletInstances.filter(
      (item): item is typeof item & { placeholder: PlaceholderTransform } =>
        dataSource === 'mock' && Boolean(item.placeholder),
    ),
    [dataSource, resolvedPalletInstances],
  );

  const mockTransforms = useMemo(
    () => resolvedMockItems.map((item) => ({
      position: item.placeholder.position,
      rotation: item.placeholder.rotation,
    })),
    [resolvedMockItems],
  );

  return (
    <>
      {/* Lighting */}
      <SceneLighting />

      {/* Grid floor */}
      {showGrid && (
        <Grid
          args={[50, 50]}
          cellSize={1}
          cellColor="#6f7280"
          sectionSize={5}
          sectionColor="#9ca3af"
          fadeFrom={25}
          fadeStrength={1}
        />
      )}

      {/* Warehouse main structure — Bounds provides fit context for F-key */}
      <Bounds margin={1.2}>
        <Suspense fallback={<LoadingFallback />}>
          {warehouseLayout ? (
            <WarehouseLayoutModel
              modelUrl={warehouseLayout}
              onPlaceholderMaps={setPlaceholderMaps}
            />
          ) : null}

        {/* Live mode: one instanced-mesh component per objectId group */}
        {dataSource === 'live' && liveGroups.map(([objectId, { items, transforms }]) => {
          const Component = OBJECT_COMPONENT_MAP[objectId] ?? CartonOnPallet;
          return (
            <Component
              key={objectId}
              transforms={transforms}
              onClick={(idx, point, screenX, screenY) => {
                const item = items[idx];
                if (!item) return;
                handleLeftClick({ palletId: item.palletId, lokasiId: item.lokasiId, storageLocationId: item.storageLocationId, inboundTransactionItemId: item.inboundTransactionItemId, inboundTransactionId: item.inboundTransactionId, palletTypeName: item.palletTypeName, skuName: item.skuName, assetKey: item.assetKey, point, screenX, screenY });
              }}
              onContextMenu={(idx, point, screenX, screenY) => {
                const item = items[idx];
                if (!item) return;
                handleRightClick({ palletId: item.palletId, lokasiId: item.lokasiId, storageLocationId: item.storageLocationId, inboundTransactionItemId: item.inboundTransactionItemId, inboundTransactionId: item.inboundTransactionId, palletTypeName: item.palletTypeName, skuName: item.skuName, assetKey: item.assetKey, point, screenX, screenY });
              }}
              onHover={(idx) => {
                void idx; // hover highlight reserved for future use
              }}
            />
          );
        })}

        {/* Single instanced mesh batch for all mock pallets — N pallets = 5 draw calls */}
        {dataSource === 'mock' && resolvedMockItems.length > 0 && (
          <SackOnPallet 
            transforms={mockTransforms}
            onClick={(idx, point, screenX, screenY) => {
              const item = resolvedMockItems[idx];
              if (!item) return;
              handleLeftClick({ palletId: item.palletId, lokasiId: item.lokasiId, storageLocationId: item.storageLocationId, inboundTransactionItemId: item.inboundTransactionItemId, inboundTransactionId: item.inboundTransactionId, palletTypeName: item.palletTypeName, skuName: item.skuName, assetKey: item.assetKey, point, screenX, screenY });
            }}
            onContextMenu={(idx, point, screenX, screenY) => {
              const item = resolvedMockItems[idx];
              if (!item) return;
              handleRightClick({ palletId: item.palletId, lokasiId: item.lokasiId, storageLocationId: item.storageLocationId, inboundTransactionItemId: item.inboundTransactionItemId, inboundTransactionId: item.inboundTransactionId, palletTypeName: item.palletTypeName, skuName: item.skuName, assetKey: item.assetKey, point, screenX, screenY });
            }}
            onHover={(idx) => {
              void idx; // hover highlight reserved for future use
            }}
          />
        )}
        </Suspense>
        <KeyboardHandler />
      </Bounds>

      {unresolvedPlaceholders.length > 0 ? (
        <Html position={[0, 9, 0]} center>
          <div className="rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-800 shadow-lg">
            <p className="font-semibold">{unresolvedPlaceholders.length} lokasi not mapped</p>
            <p className="mt-1">
              {unresolvedPlaceholders.slice(0, 3).map((item) => item.lokasiId).join(', ')}
              {unresolvedPlaceholders.length > 3 ? ` +${unresolvedPlaceholders.length - 3} more` : ''}
            </p>
          </div>
        </Html>
      ) : null}

      {/* Performance stats reporter – dev only */}
      {import.meta.env.DEV && onPerformanceUpdate && <StatsReporter onUpdate={onPerformanceUpdate} />}

      {/* Camera and controls */}
      <SceneCameraControls />

      {/* Viewport orientation gizmo */}
      <SceneGizmo />
    </>
  );
}

const SCENE_KEY_MAP = [
  { name: 'resetView', keys: ['r', 'R'] },
  { name: 'fitAll', keys: ['f', 'F'] },
];

export function WarehouseScene({
  height = 600,
  showGrid = true,
  dataSource = 'mock',
  mockFillAllPlaceholders = false,
  warehouseId,
  onDiagnosticsChange,
  onPerformanceUpdate,
  onPalletClick,
  onPalletContextMenu,
}: WarehouseSceneProps) {
  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <KeyboardControls map={SCENE_KEY_MAP}>
        <Canvas
          camera={{ position: [15, 10, 15], fov: 50 }}
          shadows={false}
          gl={{
            antialias: false,
            alpha: true,  
            powerPreference: 'high-performance',
          }}
          dpr={[1, 1]}
        >
          <WarehouseContent
            showGrid={showGrid}
            dataSource={dataSource}
            mockFillAllPlaceholders={mockFillAllPlaceholders}
            warehouseId={warehouseId}
            onDiagnosticsChange={onDiagnosticsChange}
            onPerformanceUpdate={onPerformanceUpdate}
            onPalletClick={onPalletClick}
            onPalletContextMenu={onPalletContextMenu}
          />
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
