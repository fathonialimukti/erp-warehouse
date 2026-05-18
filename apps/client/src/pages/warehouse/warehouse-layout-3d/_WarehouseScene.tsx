import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Bounds,
  Grid,
  Html,
  KeyboardControls,
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
import { resolveWarehouseLayout, preloadAllWarehouseLayouts, type WarehouseLayoutEntry } from '../../../assets/object/warehouse-layout-registry';

/**
 * Wraps a pallet component group and dims all its instanced mesh materials
 * when `dimmed` is true. Stores original opacities on first traversal so
 * they can be restored faithfully.
 */
function DimmableGroup({ dimmed, children }: { dimmed: boolean; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const originalOpacities = useRef<Map<THREE.Material, number>>(new Map());

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((obj) => {
      if (!(obj instanceof THREE.InstancedMesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial)) continue;
        if (!originalOpacities.current.has(m)) {
          originalOpacities.current.set(m, m.opacity);
        }
        m.transparent = true;
        m.opacity = dimmed ? 0.18 : (originalOpacities.current.get(m) ?? 1.0);
        m.needsUpdate = true;
      }
    });
  }, [dimmed]);

  return <group ref={groupRef}>{children}</group>;
}

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
preloadAllWarehouseLayouts();

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
  height?: number | string;
  showGrid?: boolean;
  dataSource?: WarehouseDataSourceMode;
  /** When `dataSource === 'mock'`, also place models on every `floor_placeholder.*` (old stress behaviour). */
  mockFillAllPlaceholders?: boolean;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
  onPerformanceUpdate?: (stats: WarehousePerformanceStats) => void;
  onPalletClick?: (info: PalletInteractionInfo) => void;
  onPalletContextMenu?: (info: PalletInteractionInfo) => void;
  /** When true, renders clickable markers on empty storage locations. */
  putawayMode?: boolean;
  /** The currently selected pallet id in putaway mode — markers pulse more prominently. */
  selectedPalletId?: string | null;
  /** Called when an empty location marker is clicked in putaway mode. */
  onEmptyLocationClick?: (locationId: string) => void;
  /**
   * In dispatch mode: the set of pallet-type `objectId` values (e.g. `'CartonOnPallet'`)
   * that the active dispatch item requires. Groups not in this set are dimmed.
   * Pass `null` or `undefined` to disable dispatch dimming.
   */
  dispatchActivePalletTypeObjectIds?: Set<string> | null;
}

type PlaceholderTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

/** Single map keyed by canonical placeholder name, e.g. `pallet_placeholder.001`, `floor_placeholder.003`, `rack_placeholder.007`. */
type PlaceholderMap = Map<string, PlaceholderTransform>;

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
};


const MOCK_FULL_FILL_FLOOR_ASSET_KEY: GlbAssetKey = 'carton_on_pallet';

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[\s-]+/g, '_');

/**
 * Extracts a canonical placeholder name from any GLB node name.
 * Matches any `<prefix>_placeholder` pattern, e.g. pallet_placeholder001 → pallet_placeholder.001.
 * Returns null if the node name does not match the pattern.
 */
function extractAnyPlaceholderName(rawName: string): string | null {
  const normalized = normalizeName(rawName);
  const match = normalized.match(/^(.+_placeholder).*?(\d{1,3})(?!.*\d)/);
  if (!match) return null;
  return `${match[1]}.${match[2].padStart(3, '0')}`;
}

/**
 * Converts a storage location ID (DB) to its canonical placeholder name.
 * Since DB IDs mirror the GLB node names (e.g. `floor_placeholder.010`), this
 * just normalizes and extracts the prefix + zero-padded number.
 */
function locationIdToPlaceholderName(locationId: string): string | null {
  return extractAnyPlaceholderName(locationId);
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

/** Traverses the GLB scene once and collects ALL `*_placeholder.*` nodes into a single map. */
function collectAllPlaceholders(root: THREE.Object3D): PlaceholderMap {
  const map: PlaceholderMap = new Map();
  root.updateMatrixWorld(true);
  root.traverse((object3d) => {
    const canonicalName = extractAnyPlaceholderName(object3d.name);
    if (!canonicalName) return;
    // Keep first detected transform per canonical key to avoid duplicate helper nodes.
    if (!map.has(canonicalName)) {
      map.set(canonicalName, objectToTransform(object3d));
    }
  });
  return map;
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

function WarehouseLayoutScene({
  onPlaceholderMaps,
  layout,
}: {
  onPlaceholderMaps: (maps: PlaceholderMap) => void;
  layout: WarehouseLayoutEntry;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { Instances, Model, url } = layout;

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    onPlaceholderMaps(collectAllPlaceholders(groupRef.current));
  }, [onPlaceholderMaps]);

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={[1.2, 1.2, 1.2]}>
      <Instances url={url}>
        <Model />
      </Instances>
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

/** Renders proximity-culled clickable markers for empty storage locations in putaway mode. */
const PUTAWAY_MARKER_VISIBLE_RADIUS = 15; // world-units

function PutawayMarkers({
  markers,
  onEmptyLocationClick,
}: {
  markers: Array<{ locationId: string; placeholderName: string; position: [number, number, number] }>;
  onEmptyLocationClick?: (locationId: string) => void;
}) {
  const { camera } = useThree();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());

  useFrame(() => {
    const camPos = camera.position;
    const next = new Set<string>();
    for (const m of markers) {
      const dx = camPos.x - m.position[0];
      const dz = camPos.z - m.position[2];
      const dist2 = dx * dx + dz * dz;
      if (dist2 <= PUTAWAY_MARKER_VISIBLE_RADIUS * PUTAWAY_MARKER_VISIBLE_RADIUS) {
        next.add(m.locationId);
      }
    }
    setVisibleIds((prev) => {
      if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  });

  return (
    <>
      {markers.filter((m) => visibleIds.has(m.locationId)).map(({ locationId, position }) => (
        <Html
          key={locationId}
          position={[position[0], position[1] + 0.2, position[2]]}
          center
          distanceFactor={6}
          zIndexRange={[100, 200]}
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEmptyLocationClick?.(locationId);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid rgba(59,130,246,0.75)',
                background: 'rgba(59,130,246,0.14)',
                boxShadow: '0 0 10px rgba(59,130,246,0.18)',
              }}
            />
          </button>
        </Html>
      ))}
    </>
  );
}

function PutawayLabels({ markers }: { markers: Array<{ locationId: string; placeholderName: string; position: [number, number, number] }> }) {
  const { camera } = useThree();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());

  useFrame(() => {
    const camPos = camera.position;
    const next = new Set<string>();
    for (const marker of markers) {
      const dx = camPos.x - marker.position[0];
      const dz = camPos.z - marker.position[2];
      const dist2 = dx * dx + dz * dz;
      if (dist2 <= PUTAWAY_MARKER_VISIBLE_RADIUS * PUTAWAY_MARKER_VISIBLE_RADIUS) {
        next.add(marker.locationId);
      }
    }
    setVisibleIds((prev) => {
      if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  });

  return (
    <>
      {markers.filter((m) => visibleIds.has(m.locationId)).map(({ locationId, placeholderName, position }) => (
        <Html
          key={`label-${locationId}`}
          position={[position[0], position[1] + 0.2, position[2]]}
          center
          distanceFactor={6}
          zIndexRange={[100, 200]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(59,130,246,0.4)',
              padding: '4px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
              lineHeight: 1.4,
              backdropFilter: 'blur(6px)',
            }}
          >
            {placeholderName}
          </div>
        </Html>
      ))}
    </>
  );
}

function StatsReporter({ onUpdate }: { onUpdate: (stats: WarehousePerformanceStats) => void }) {  const { gl } = useThree();
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
  putawayMode,
  onEmptyLocationClick,
  dispatchActivePalletTypeObjectIds,
}: {
  showGrid: boolean;
  dataSource: WarehouseDataSourceMode;
  mockFillAllPlaceholders: boolean;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
  onPerformanceUpdate?: (stats: WarehousePerformanceStats) => void;
  putawayMode?: boolean;
  onEmptyLocationClick?: (locationId: string) => void;
  onPalletClick?: (info: PalletInteractionInfo) => void;
  onPalletContextMenu?: (info: PalletInteractionInfo) => void;
  dispatchActivePalletTypeObjectIds?: Set<string> | null;
}) {
  const [placeholderMaps, setPlaceholderMaps] = useState<PlaceholderMap>(new Map());
  const [hoveredPallet, setHoveredPallet] = useState<{ objectId: string; idx: number } | null>(null);
  const handleLeftClick = (info: PalletInteractionInfo) => {
    onPalletClick?.(info);
  };
  const handleRightClick = (info: PalletInteractionInfo) => {
    onPalletContextMenu?.(info);
  };

  const { data: liveSceneData } = useQuery({
    queryKey: ['warehouseLayoutScene', warehouseId],
    enabled: dataSource === 'live' && Boolean(warehouseId),
    queryFn: () =>
      trpcClient.warehouse.layout.getScene.query({
        warehouseId: warehouseId ?? '',
      }),
    staleTime: 30_000,
  });

  const liveLokasiData = liveSceneData?.locations;

  // Resolve the correct layout entry (Instances + Model + url) for this warehouse.
  const warehouseLayout = useMemo(
    () => resolveWarehouseLayout(liveSceneData?.warehouseObjectId),
    [liveSceneData?.warehouseObjectId],
  );

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
        const placeholderName = locationIdToPlaceholderName(row.id);
        if (!placeholderName) return [];
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
        }];
      });

    if (dataSource !== 'mock' || !mockFillAllPlaceholders) {
      return fromRows;
    }

    const floorItems: RenderPlacementItem[] = Array.from(placeholderMaps.keys())
      .filter((name) => name.includes('floor_placeholder'))
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
      }));

    return [...fromRows, ...floorItems];
  }, [dataSource, mockFillAllPlaceholders, placeholderMaps, sourceRows]);

  const resolvedPalletInstances = useMemo(() => {
    return placementItems.map((item) => {
      const placeholder = placeholderMaps.get(item.placeholderName);
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
      totalPalletPlaceholders: Array.from(placeholderMaps.keys()).filter((k) => k.startsWith('pallet_placeholder')).length,
      totalFloorPlaceholders: Array.from(placeholderMaps.keys()).filter((k) => k.startsWith('floor_placeholder')).length,
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
   * Empty location markers — only computed when putaway mode is active.
   * Maps each unoccupied storage location to its 3D placeholder transform.
   */
  const emptyLocationMarkers = useMemo(() => {
    if (!putawayMode || dataSource !== 'live') return [];
    // Deduplicate by placeholder name — multiple location IDs can share the same trailing
    // number and resolve to the same 3D position, which would stack labels on top of each other.
    const seen = new Set<string>();
    return (liveLokasiData ?? [])
      .filter((row) => row.pallet === null)
      .flatMap((row) => {
        const resolvedName = locationIdToPlaceholderName(row.id);
        if (!resolvedName) return [];
        const transform = placeholderMaps.get(resolvedName);
        if (!transform) return [];
        if (seen.has(resolvedName)) return [];
        seen.add(resolvedName);
        return [{ locationId: row.id, placeholderName: resolvedName, position: transform.position as [number, number, number] }];
      });
  }, [putawayMode, dataSource, liveLokasiData, placeholderMaps]);

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

  const hoveredTransform = useMemo(() => {
    if (!hoveredPallet) return null;
    if (hoveredPallet.objectId === '__mock__') {
      return mockTransforms[hoveredPallet.idx] ?? null;
    }
    const group = liveGroups.find(([oid]) => oid === hoveredPallet.objectId);
    return group?.[1].transforms[hoveredPallet.idx] ?? null;
  }, [hoveredPallet, mockTransforms, liveGroups]);

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
          <WarehouseLayoutScene onPlaceholderMaps={setPlaceholderMaps} layout={warehouseLayout} />

        {/* Live mode: one instanced-mesh component per objectId group */}
        {dataSource === 'live' && liveGroups.map(([objectId, { items, transforms }]) => {
          const Component = OBJECT_COMPONENT_MAP[objectId] ?? CartonOnPallet;
          const dimmed = Boolean(dispatchActivePalletTypeObjectIds && !dispatchActivePalletTypeObjectIds.has(objectId));
          return (
            <DimmableGroup key={objectId} dimmed={dimmed}>
            <Component
              key={`inner-${objectId}`}
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
                setHoveredPallet(idx === null ? null : { objectId, idx });
              }}
            />
            </DimmableGroup>
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
              setHoveredPallet(idx === null ? null : { objectId: '__mock__', idx });
            }}
          />
        )}
          {/* Hovered pallet highlight — amber outline box */}
          {hoveredTransform && (
            <mesh position={hoveredTransform.position} rotation={hoveredTransform.rotation as [number, number, number]}>
              <boxGeometry args={[1.4, 2.0, 1.4]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          )}

          {putawayMode && emptyLocationMarkers.length > 0 && (
            <PutawayLabels markers={emptyLocationMarkers} />
          )}
          {putawayMode && emptyLocationMarkers.length > 0 && (
            <>
              <PutawayLabels markers={emptyLocationMarkers} />
              <PutawayMarkers
                markers={emptyLocationMarkers}
                onEmptyLocationClick={onEmptyLocationClick}
              />
            </>
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
  height = '100%',
  showGrid = true,
  dataSource = 'mock',
  mockFillAllPlaceholders = false,
  warehouseId,
  onDiagnosticsChange,
  onPerformanceUpdate,
  onPalletClick,
  onPalletContextMenu,
  putawayMode,
  onEmptyLocationClick,
  dispatchActivePalletTypeObjectIds,
}: WarehouseSceneProps) {
  return (
    <div style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height }}>
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
            putawayMode={putawayMode}
            onEmptyLocationClick={onEmptyLocationClick}
            dispatchActivePalletTypeObjectIds={dispatchActivePalletTypeObjectIds}
          />
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
