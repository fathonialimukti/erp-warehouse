import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PalletInteractionInfo, preloadWarehouseModels, agingCategoryColor } from './_WarehouseModel';
import { KeyboardHandler } from './_KeyboardHandler';
import { SceneCameraControls } from './_SceneCameraControls';
import { SceneGizmo } from './_SceneGizmo';
import { SceneLighting } from './_SceneLighting';
import { SackOnPallet } from '../../../assets/object/SackOnPallet';
import { CartonOnPallet } from '../../../assets/object/CartonOnPallet';
import { CrateOnPallet } from '../../../assets/object/CrateOnPallet';
import { DrumOnPallet } from '../../../assets/object/DrumOnPallet';
import { IBCOnPallet } from '../../../assets/object/IBCOnPallet';
import { BrickOnPallet } from '../../../assets/object/BrickOnPallet';
import { resolvePalletObjectId } from '../../../components/PalletObjectViewer';
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

/** BrickOnPallet takes flat positions instead of the transforms API — adapter for instanced groups. */
function BrickOnPalletGroup({ transforms }: { transforms?: { position: [number, number, number]; rotation?: [number, number, number] }[] }) {
  return <BrickOnPallet positions={transforms?.map((t) => t.position)} />;
}

const OBJECT_COMPONENT_MAP: Record<string, React.ComponentType<{
  transforms?: { position: [number, number, number]; rotation?: [number, number, number] }[];
  onClick?: (idx: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onContextMenu?: (idx: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onHover?: (idx: number | null) => void;
  palletColors?: (string | null)[];
}>> = {
  CartonOnPallet,
  CrateOnPallet,
  DrumOnPallet,
  IBCOnPallet,
  SackOnPallet,
  BrickOnPallet: BrickOnPalletGroup,
};

preloadWarehouseModels();
preloadAllWarehouseLayouts();

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
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
  onPerformanceUpdate?: (stats: WarehousePerformanceStats) => void;
  onPalletClick?: (info: PalletInteractionInfo) => void;
  onPalletContextMenu?: (info: PalletInteractionInfo) => void;
  /** When true, renders clickable markers on empty storage locations. */
  putawayMode?: boolean;
  /** The currently selected pallet id in putaway mode — markers pulse more prominently. */
  selectedPalletId?: string | null;
  /** When set, the matching empty location marker is highlighted (AI-recommended location). */
  highlightedLocationId?: string | null;
  /** Staged putaway assignments (palletId → storageLocationId). Locations with
   * a staged pallet are shown with a green "placed" marker so the user sees a
   * live preview of their pending assignments before clicking Save. */
  stagedAssignments?: Map<string, string> | null;
  /** Called when an empty location marker is clicked in putaway mode. */
  onEmptyLocationClick?: (locationId: string) => void;
  /**
   * In dispatch mode: the set of pallet-type `objectId` values (e.g. `'CartonOnPallet'`)
   * that the active dispatch item requires. Groups not in this set are dimmed.
   * Pass `null` or `undefined` to disable dispatch dimming.
   */
  dispatchActivePalletTypeObjectIds?: Set<string> | null;
  /** When true, pallets are colored by inventory aging category. */
  agingMode?: boolean;
  /** Called whenever the per-pallet aging map is (re)computed from scene data. */
  onAgingMapChange?: (map: Record<string, { daysSinceMovement: number | null; agingCategory: string }>) => void;
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
    palletNumber?: string | null;
    inboundTransactionItemId?: string | null;
    inboundTransactionItem?: { inboundTransactionId: string } | null;
    sku: { id: string; name: string; objectId: string | null; packageName: string; sku?: { name: string } } | null;
    sourceType?: string | null;
    sourceItemId?: string | null;
  } | null;
};

type RenderPlacementItem = {
  palletId: string;
  palletNumber: string | null;
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
 *
 * DB IDs follow the format `WH01/<TYPE>/<NNNN>`, e.g. `WH01/FLOOR/0001` or `WH01/RACK/0062`.
 * GLB node names use `<type>_placeholder.<NNN>`, e.g. `floor_placeholder.001`.
 * Both are mapped to a canonical `<prefix>_placeholder.<NNN>` key.
 */
function locationIdToPlaceholderName(locationId: string): string | null {
  // First try the GLB node name format: `prefix_placeholder<number>`
  const fromGLB = extractAnyPlaceholderName(locationId);
  if (fromGLB) return fromGLB;

  // Handle DB format: `WH01/FLOOR/0001` → `floor_placeholder.001`
  // Regex captures: warehouse prefix (ignored), type (floor/rack/etc.), zero-padded number
  const dbMatch = locationId.match(/^[^/]+\/([^/]+)\/(\d+)$/i);
  if (!dbMatch) return null;

  const rawType = dbMatch[1].toLowerCase(); // FLOOR → floor, RACK → rack

  // Map DB type to GLB placeholder prefix.
  // GLB models use `pallet_placeholder` for rack positions (there is no `rack_placeholder` in any model).
  const TYPE_TO_PLACEHOLDER: Record<string, string> = {
    rack: 'pallet',
    floor: 'floor',
  };
  const prefix = TYPE_TO_PLACEHOLDER[rawType] ?? rawType;

  const num = parseInt(dbMatch[2], 10);
  const paddedNum = String(num).padStart(3, '0');

  return `${prefix}_placeholder.${paddedNum}`;
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

  // Re-collect whenever the layout identity changes. WarehouseContent renders
  // the WH01 fallback layout while the scene query loads, so the first collect
  // may capture WH01 transforms. Without `layout` in deps the stale map was
  // kept after swapping to the real WH02/WH03 layout — pallets rendered at
  // WH01 coordinates on first open (and looked "fixed" on revisit only because
  // cached scene data + cached GLB made the real layout commit first).
  useEffect(() => {
    // Drop the previous layout's map immediately so pallets never render one
    // frame at stale coordinates while the new layout mounts.
    onPlaceholderMaps(new Map());

    let cancelled = false;
    let attempts = 0;
    // Generous budget: covers cold GLB fetch + Suspense commit + Merged flush.
    const maxAttempts = 180;

    const collect = () => {
      if (cancelled) return;
      if (!groupRef.current) {
        // Still suspended (GLB resolving) — keep polling instead of bailing.
        if (attempts++ < maxAttempts) requestAnimationFrame(collect);
        return;
      }
      const map = collectAllPlaceholders(groupRef.current);
      const hasPlaceholders = Array.from(map.keys()).some(
        (k) => k.startsWith('pallet_placeholder') || k.startsWith('floor_placeholder'),
      );
      if (hasPlaceholders || attempts >= maxAttempts) {
        onPlaceholderMaps(map);
      } else {
        attempts++;
        requestAnimationFrame(collect);
      }
    };

    const raf = requestAnimationFrame(collect);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [layout, onPlaceholderMaps]);

  return (
    <group key={url} ref={groupRef} position={[0, 0, 0]} scale={[1.2, 1.2, 1.2]}>
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
  highlightedLocationId,
  stagedLocationIds,
}: {
  markers: Array<{ locationId: string; placeholderName: string; position: [number, number, number] }>;
  onEmptyLocationClick?: (locationId: string) => void;
  highlightedLocationId?: string | null;
  stagedLocationIds?: Set<string> | null;
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
      {markers.filter((m) => visibleIds.has(m.locationId)).map(({ locationId, position }) => {
        const isHighlighted = Boolean(highlightedLocationId) && locationId === highlightedLocationId;
        const isStaged = Boolean(stagedLocationIds?.has(locationId));
        return (
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
                style={
                  isHighlighted
                    ? {
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '3px solid rgba(34,197,94,0.95)',
                        background: 'rgba(34,197,94,0.22)',
                        boxShadow: '0 0 16px rgba(34,197,94,0.55)',
                        animation: 'putaway-highlight-pulse 1.2s ease-in-out infinite',
                      }
                    : isStaged
                      ? {
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: '3px solid rgba(34,197,94,0.85)',
                          background: 'rgba(34,197,94,0.30)',
                          boxShadow: '0 0 12px rgba(34,197,94,0.40)',
                        }
                      : {
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '2px solid rgba(59,130,246,0.75)',
                        background: 'rgba(59,130,246,0.14)',
                        boxShadow: '0 0 10px rgba(59,130,246,0.18)',
                      }
                }
              />
            </button>
          </Html>
        );
      })}
    </>
  );
}

function PutawayLabels({ markers, highlightedLocationId }: { markers: Array<{ locationId: string; placeholderName: string; position: [number, number, number] }>; highlightedLocationId?: string | null }) {
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
      {markers.filter((m) => visibleIds.has(m.locationId)).map(({ locationId, placeholderName, position }) => {
        const isHighlighted = Boolean(highlightedLocationId) && locationId === highlightedLocationId;
        return (
          <Html
            key={`label-${locationId}`}
            position={[position[0], position[1] + 0.2, position[2]]}
            center
            distanceFactor={6}
            zIndexRange={[100, 200]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={
                isHighlighted
                  ? {
                      fontSize: 11,
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: 800,
                      color: '#ffffff',
                      background: 'rgba(22,101,52,0.95)',
                      border: '2px solid rgba(34,197,94,0.95)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.02em',
                      lineHeight: 1.4,
                      backdropFilter: 'blur(6px)',
                      boxShadow: '0 0 12px rgba(34,197,94,0.5)',
                    }
                  : {
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
                    }
              }
            >
              {placeholderName}
            </div>
          </Html>
        );
      })}
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
  warehouseId,
  onDiagnosticsChange,
  onPerformanceUpdate,
  onPalletClick,
  onPalletContextMenu,
  putawayMode,
  highlightedLocationId,
  stagedAssignments,
  onEmptyLocationClick,
  dispatchActivePalletTypeObjectIds,
  agingMode,
  onAgingMapChange,
}: {
  showGrid: boolean;
  warehouseId?: string;
  onDiagnosticsChange?: (diagnostics: WarehouseSceneDiagnostics) => void;
  onPerformanceUpdate?: (stats: WarehousePerformanceStats) => void;
  putawayMode?: boolean;
  selectedPalletId?: string | null;
  highlightedLocationId?: string | null;
  stagedAssignments?: Map<string, string> | null;
  onEmptyLocationClick?: (locationId: string) => void;
  onPalletClick?: (info: PalletInteractionInfo) => void;
  onPalletContextMenu?: (info: PalletInteractionInfo) => void;
  dispatchActivePalletTypeObjectIds?: Set<string> | null;
  agingMode?: boolean;
  onAgingMapChange?: (map: Record<string, { daysSinceMovement: number | null; agingCategory: string }>) => void;
}) {
  const [placeholderMaps, setPlaceholderMaps] = useState<PlaceholderMap>(new Map());
  const [, setHoveredPallet] = useState<{ objectId: string; idx: number } | null>(null);
  const [displayHoveredPallet, setDisplayHoveredPallet] = useState<{ objectId: string; idx: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HOVER_DELAY = 150; // ms

  /** Debounced hover enter — delays setting the display state by HOVER_DELAY ms. */
  const handleHoverEnter = useCallback((objectId: string, idx: number) => {
    // Clear any pending leave
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setDisplayHoveredPallet({ objectId, idx });
    }, HOVER_DELAY);
  }, []);

  /** Hover leave — clears immediately so label disappears fast. */
  const handleHoverLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setDisplayHoveredPallet(null);
  }, []);

  const handleLeftClick = (info: PalletInteractionInfo) => {
    onPalletClick?.(info);
  };
  const handleRightClick = (info: PalletInteractionInfo) => {
    onPalletContextMenu?.(info);
  };

  const { data: liveSceneData } = useQuery({
    queryKey: ['warehouseLayoutScene', warehouseId],
    enabled: Boolean(warehouseId),
    queryFn: () =>
      trpcClient.warehouse.layout.getScene.query({
        warehouseId: warehouseId ?? '',
      }),
    staleTime: 30_000,
  });

  const liveLokasiData = liveSceneData?.locations;

  // Build the per-pallet aging map from scene data and report it upward so the
  // page can render the legend. This is the single source of truth for aging
  // data — the page no longer queries getScene independently.
  useEffect(() => {
    if (!agingMode || !liveLokasiData) {
      onAgingMapChange?.({});
      return;
    }
    const map: Record<string, { daysSinceMovement: number | null; agingCategory: string }> = {};
    for (const location of liveLokasiData) {
      if (location.pallet) {
        map[location.pallet.id] = {
          daysSinceMovement: location.pallet.daysSinceMovement ?? null,
          agingCategory: location.pallet.agingCategory ?? 'no_data',
        };
      }
    }
    onAgingMapChange?.(map);
  }, [agingMode, liveLokasiData, onAgingMapChange]);

  // Resolve the correct layout entry (Instances + Model + url) for this warehouse.
  const warehouseLayout = useMemo(
    () => resolveWarehouseLayout(liveSceneData?.warehouseObjectId),
    [liveSceneData?.warehouseObjectId],
  );

  const sourceRows = useMemo<SourceLokasiRow[]>(() => {
    return liveLokasiData ?? [];
  }, [liveLokasiData]);

  const placementItems = useMemo<RenderPlacementItem[]>(() => {
    return sourceRows
      .filter((row): row is SourceLokasiRow & { pallet: NonNullable<SourceLokasiRow['pallet']> } => row.pallet !== null)
      .flatMap((row) => {
        const placeholderName = locationIdToPlaceholderName(row.id);
        if (!placeholderName) return [];
        const objectId = resolvePalletObjectId(row.pallet.sku?.objectId, row.pallet.sku?.packageName);
        return [{
          palletId: row.pallet.id,
          palletNumber: row.pallet.palletNumber ?? null,
          lokasiId: row.id,
          storageLocationId: row.id,
          inboundTransactionItemId: row.pallet.sourceItemId ?? row.pallet.inboundTransactionItemId ?? null,
          inboundTransactionId: row.pallet.inboundTransactionItem?.inboundTransactionId ?? null,
          placeholderName,
          objectId,
          palletTypeName: row.pallet.sku?.name ?? null,
          skuName: row.pallet.sku?.sku?.name ?? null,
          assetKey: resolveAssetKey(objectId),
        }];
      });
  }, [sourceRows]);

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
        (item) => item.placeholder && Boolean(item.modelUrl),
      )
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
    () => resolvedPalletInstances.filter((item) => !item.placeholder),
    [resolvedPalletInstances],
  );

  /**
   * Empty location markers — only computed when putaway mode is active.
   * Maps each unoccupied storage location to its 3D placeholder transform.
   */
  const emptyLocationMarkers = useMemo(() => {
    if (!putawayMode) return [];
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
  }, [putawayMode, liveLokasiData, placeholderMaps]);

  /**
   * Live items grouped by objectId — one instanced-mesh component per pallet type.
   */
  const liveGroups = useMemo(() => {
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
  }, [resolvedPalletInstances]);

  /**
   * Per-group aging color arrays, computed once at the component level (not inside
   * the render-loop .map) so React hooks rules are respected. Keyed by objectId.
   */
  const liveGroupColors = useMemo(() => {
    const map = new Map<string, (string | null)[]>();
    if (!agingMode || !liveLokasiData) return map;
    const agingById = new Map<string, { daysSinceMovement: number | null; agingCategory: string }>();
    for (const loc of liveLokasiData) {
      if (loc.pallet) {
        agingById.set(loc.pallet.id, {
          daysSinceMovement: loc.pallet.daysSinceMovement ?? null,
          agingCategory: loc.pallet.agingCategory ?? 'no_data',
        });
      }
    }
    for (const [objectId, { items }] of liveGroups) {
      map.set(
        objectId,
        items.map((item) => {
          const data = agingById.get(item.palletId);
          if (!data) return null;
          return agingCategoryColor(data.agingCategory);
        }),
      );
    }
    return map;
  }, [agingMode, liveLokasiData, liveGroups]);

  /** Flat palletId → aging data map, used by click handlers to attach aging info. */
  const scenePalletAgingMap = useMemo(() => {
    const map: Record<string, { daysSinceMovement: number | null; agingCategory: string }> = {};
    if (!liveLokasiData) return map;
    for (const loc of liveLokasiData) {
      if (loc.pallet) {
        map[loc.pallet.id] = {
          daysSinceMovement: loc.pallet.daysSinceMovement ?? null,
          agingCategory: loc.pallet.agingCategory ?? 'no_data',
        };
      }
    }
    return map;
  }, [liveLokasiData]);

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

        {/* One instanced-mesh component per objectId group */}
        {liveGroups.map(([objectId, { items, transforms }]) => {
          const Component = OBJECT_COMPONENT_MAP[objectId] ?? CartonOnPallet;
          const dimmed = Boolean(dispatchActivePalletTypeObjectIds && !dispatchActivePalletTypeObjectIds.has(objectId));
          const groupPalletColors = liveGroupColors.get(objectId);
          return (
            <DimmableGroup key={objectId} dimmed={dimmed}>
            <Component
              key={`inner-${objectId}`}
              transforms={transforms}
              palletColors={groupPalletColors}
              onClick={(idx, point, screenX, screenY) => {
                const item = items[idx];
                if (!item) return;
                const aging = scenePalletAgingMap[item.palletId];
                handleLeftClick({ palletId: item.palletId, palletNumber: item.palletNumber, lokasiId: item.lokasiId, storageLocationId: item.storageLocationId, inboundTransactionItemId: item.inboundTransactionItemId, inboundTransactionId: item.inboundTransactionId, palletTypeName: item.palletTypeName, skuName: item.skuName, assetKey: item.assetKey, point, screenX, screenY, daysSinceMovement: aging?.daysSinceMovement ?? null, agingCategory: aging?.agingCategory });
              }}
              onContextMenu={(idx, point, screenX, screenY) => {
                const item = items[idx];
                if (!item) return;
                const aging = scenePalletAgingMap[item.palletId];
                handleRightClick({ palletId: item.palletId, palletNumber: item.palletNumber, lokasiId: item.lokasiId, storageLocationId: item.storageLocationId, inboundTransactionItemId: item.inboundTransactionItemId, inboundTransactionId: item.inboundTransactionId, palletTypeName: item.palletTypeName, skuName: item.skuName, assetKey: item.assetKey, point, screenX, screenY, daysSinceMovement: aging?.daysSinceMovement ?? null, agingCategory: aging?.agingCategory });
              }}
              onHover={(idx) => {
                if (idx === null) {
                  setHoveredPallet(null);
                  handleHoverLeave();
                } else {
                  setHoveredPallet({ objectId, idx });
                  handleHoverEnter(objectId, idx);
                }
              }}
            />
            </DimmableGroup>
          );
        })}

          {/* Hover label — SKU name + Pallet ID, debounced 150ms, positioned above pallet */}
          {displayHoveredPallet && (() => {
            const item = liveGroups.find(([oid]) => oid === displayHoveredPallet.objectId)?.[1].items[displayHoveredPallet.idx];
            if (!item?.placeholder) return null;
            const labelY = item.placeholder.position[1] + 2.1;
            return (
              <Html
                position={[item.placeholder.position[0], labelY, item.placeholder.position[2]]}
                center
                distanceFactor={10}
                zIndexRange={[200, 300]}
                style={{ pointerEvents: 'none' }}
              >
                <div className="pointer-events-none min-w-40 rounded-lg bg-background/95 p-3 text-xs shadow-lg ring-1 ring-default-200">
                  {item.skuName && (
                    <p className="text-sm font-semibold text-foreground leading-tight">{item.skuName}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-muted">
                    <span className="font-mono text-[11px] tracking-tight truncate max-w-35" title={item.palletNumber ?? item.palletId}>
                      {item.palletNumber ?? item.palletId}
                    </span>
                  </div>
                </div>
              </Html>
            );
          })()}

          {putawayMode && emptyLocationMarkers.length > 0 && (
            <>
              <PutawayLabels markers={emptyLocationMarkers} highlightedLocationId={highlightedLocationId ?? null} />
              <PutawayMarkers
                markers={emptyLocationMarkers}
                onEmptyLocationClick={onEmptyLocationClick}
                highlightedLocationId={highlightedLocationId ?? null}
                stagedLocationIds={stagedAssignments ? new Set(stagedAssignments.values()) : null}
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
  warehouseId,
  onDiagnosticsChange,
  onPerformanceUpdate,
  onPalletClick,
  onPalletContextMenu,
  putawayMode,
  selectedPalletId,
  highlightedLocationId,
  stagedAssignments,
  onEmptyLocationClick,
  dispatchActivePalletTypeObjectIds,
  agingMode,
  onAgingMapChange,
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
            warehouseId={warehouseId}
            onDiagnosticsChange={onDiagnosticsChange}
            onPerformanceUpdate={onPerformanceUpdate}
            onPalletClick={onPalletClick}
            onPalletContextMenu={onPalletContextMenu}
            putawayMode={putawayMode}
            selectedPalletId={selectedPalletId}
            highlightedLocationId={highlightedLocationId}
            stagedAssignments={stagedAssignments}
            onEmptyLocationClick={onEmptyLocationClick}
            dispatchActivePalletTypeObjectIds={dispatchActivePalletTypeObjectIds}
            agingMode={agingMode}
            onAgingMapChange={onAgingMapChange}
          />
        </Canvas>
      </KeyboardControls>
    </div>
  );
}
