import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  Grid,
  PerspectiveCamera,
  Html,
  useGLTF,
} from '@react-three/drei';
import { useQuery } from '@tanstack/react-query';
import * as THREE from 'three';
import { WarehouseModel, preloadWarehouseModels } from './WarehouseModel';
import { getGlbAssetUrl } from '../lib/glb-assets';
import { trpcClient } from '../lib/trpc';
import { WAREHOUSE_LAYOUT_MOCK_ROWS } from '../lib/warehouse-layout-mock';

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

interface WarehouseSceneProps {
  height?: number;
  showGrid?: boolean;
  dataSource?: WarehouseDataSourceMode;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
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
  palet: {
    id: string;
    jenisPalet: {
      nama: string;
      namaKemasan?: string | null;
    };
  } | null;
};

type RenderPlacementItem = {
  paletId: string;
  lokasiId: string;
  placeholderName: string;
  assetKey: string;
};

const PLACEHOLDER_PALLET_PREFIX = 'pallet_placeholder.';

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

function resolveAssetKeyFromJenis(jenis: { nama: string; namaKemasan?: string | null }): string {
  const normalizedKemasan = jenis.namaKemasan?.toLowerCase().trim() ?? '';
  const normalizedNama = jenis.nama.toLowerCase().trim();
  const source = `${normalizedKemasan} ${normalizedNama}`;

  if (source.includes('barrel') || source.includes('drum')) {
    return 'barrels_on_pallet';
  }
  if (source.includes('danger') || source.includes('hazard')) {
    return 'carton_danger_on_pallet';
  }
  if (source.includes('cement') || source.includes('semen')) {
    return 'cement_on_pallet';
  }
  if (source.includes('concrete') || source.includes('beton')) {
    return 'concrete_on_pallet';
  }
  if (source.includes('gypsum') || source.includes('gipsum')) {
    return 'gypsum_on_pallet';
  }
  if (source.includes('carton') || source.includes('box')) {
    return 'carton_on_pallet';
  }

  return 'pallet';
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

function WarehouseContent({
  showGrid,
  dataSource,
  warehouseId,
  onDiagnosticsChange,
}: {
  showGrid: boolean;
  dataSource: WarehouseDataSourceMode;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
}) {
  const warehouseLayout = getGlbAssetUrl('warehouse_layout');
  const [placeholderMaps, setPlaceholderMaps] = useState<PlaceholderMaps>({
    palletMap: new Map<string, PlaceholderTransform>(),
    floorMap: new Map<string, PlaceholderTransform>(),
  });

  const { data: liveLokasiData } = useQuery({
    queryKey: ['warehouseLayoutSceneData', warehouseId],
    enabled: dataSource === 'live' && Boolean(warehouseId),
    queryFn: () =>
      trpcClient.warehouse.lokasiPenyimpanan.list.query({
        gudangId: warehouseId ?? '',
        page: 1,
        limit: 300,
      }),
  });

  const sourceRows = useMemo<SourceLokasiRow[]>(() => {
    if (dataSource === 'mock') {
      return WAREHOUSE_LAYOUT_MOCK_ROWS;
    }

    return (liveLokasiData?.data ?? []) as SourceLokasiRow[];
  }, [dataSource, liveLokasiData?.data]);

  const placementItems = useMemo<RenderPlacementItem[]>(() => {
    return sourceRows
      .filter((row) => row.palet)
      .map((row) => {
        const placeholderName = normalizeLokasiToPlaceholderName(row.id);
        if (!placeholderName || !row.palet) {
          return null;
        }

        return {
          paletId: row.palet.id,
          lokasiId: row.id,
          placeholderName,
          assetKey: resolveAssetKeyFromJenis(row.palet.jenisPalet),
        };
      })
      .filter((item): item is RenderPlacementItem => item !== null);
  }, [sourceRows]);

  const resolvedPalletInstances = useMemo(() => {
    return placementItems.map((item) => {
      const placeholder = placeholderMaps.palletMap.get(item.placeholderName);
      const modelUrl = getGlbAssetUrl(item.assetKey) ?? getGlbAssetUrl('pallet');
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
      renderedPallets: resolvedPalletInstances.filter((item) => item.placeholder && item.modelUrl)
        .length,
      missingPlaceholderRows: resolvedPalletInstances.filter((item) => !item.placeholder).length,
      missingModelRows: resolvedPalletInstances.filter((item) => !item.modelUrl).length,
    }),
    [placeholderMaps, placementItems, resolvedPalletInstances],
  );

  useEffect(() => {
    onDiagnosticsChange?.(diagnostics);
  }, [diagnostics, onDiagnosticsChange]);

  const unresolvedPlaceholders = useMemo(
    () => resolvedPalletInstances.filter((item) => !item.placeholder).slice(0, 6),
    [resolvedPalletInstances],
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-10, 5, -10]} intensity={0.4} />

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

      {/* Warehouse main structure */}
      <Suspense fallback={<LoadingFallback />}>
        {warehouseLayout ? (
          <WarehouseLayoutModel
            modelUrl={warehouseLayout}
            onPlaceholderMaps={setPlaceholderMaps}
          />
        ) : null}

        {resolvedPalletInstances.map((item) => {
          if (!item.placeholder || !item.modelUrl) {
            return null;
          }

          const modelScale = getGlbAssetUrl('pallet') === item.modelUrl
            ? item.placeholder.scale
            : [1, 1, 1] as [number, number, number];

          return (
            <WarehouseModel
              key={`${item.paletId}-${item.placeholderName}`}
              modelUrl={item.modelUrl}
              position={item.placeholder.position}
              rotation={item.placeholder.rotation}
              scale={modelScale}
            />
          );
        })}
      </Suspense>

      {unresolvedPlaceholders.length > 0 ? (
        <Html position={[0, 9, 0]} center>
          <div className="rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-800 shadow-lg">
            <p className="font-semibold">Unmapped lokasi IDs</p>
            <p className="mt-1">
              {unresolvedPlaceholders.map((item) => item.lokasiId).join(', ')}
            </p>
          </div>
        </Html>
      ) : null}

      {/* Environment for realistic lighting */}
      <Environment preset="warehouse" />

      {/* Camera and controls */}
      <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.8}
        minDistance={5}
        maxDistance={60}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export function WarehouseScene({
  height = 600,
  showGrid = true,
  dataSource = 'mock',
  warehouseId,
  onDiagnosticsChange,
}: WarehouseSceneProps) {
  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <Canvas
        camera={{ position: [15, 10, 15], fov: 50 }}
        shadows="soft"
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
      >
        <WarehouseContent
          showGrid={showGrid}
          dataSource={dataSource}
          warehouseId={warehouseId}
          onDiagnosticsChange={onDiagnosticsChange}
        />
      </Canvas>
    </div>
  );
}
