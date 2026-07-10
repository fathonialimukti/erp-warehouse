import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useQuery } from '@tanstack/react-query';
import { Instances, WH01 } from '../../assets/object/WH01';
import { CartonOnPallet } from '../../assets/object/CartonOnPallet';
import { CrateOnPallet } from '../../assets/object/CrateOnPallet';
import { DrumOnPallet } from '../../assets/object/DrumOnPallet';
import { IBCOnPallet } from '../../assets/object/IBCOnPallet';
import { SackOnPallet } from '../../assets/object/SackOnPallet';
import { trpcClient } from '../../lib/trpc';
import wh01Url from '../../assets/glb/WH01.glb?url';

const OBJECT_COMPONENT_MAP: Record<string, React.ComponentType<{
  transforms?: { position: [number, number, number]; rotation?: [number, number, number] }[];
}>> = {
  CartonOnPallet,
  CrateOnPallet,
  DrumOnPallet,
  IBCOnPallet,
  SackOnPallet,
  BrickOnPallet: CartonOnPallet,
};

const FALLBACK_OBJECT_ID = 'CartonOnPallet';

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[\s-]+/g, '_');
}

/** Extracts canonical placeholder name, e.g. pallet_placeholder001 → pallet_placeholder.001 */
function extractAnyPlaceholderName(rawName: string): string | null {
  const normalized = normalizeName(rawName);
  const match = normalized.match(/^(.+_placeholder).*?(\d{1,3})(?!.*\d)/);
  if (!match) return null;
  return `${match[1]}.${match[2].padStart(3, '0')}`;
}

/** DB ID WH01/RACK/0062 → pallet_placeholder.062 */
const TYPE_TO_PLACEHOLDER: Record<string, string> = { rack: 'pallet', floor: 'floor' };

function locationIdToPlaceholderName(locationId: string): string | null {
  const fromGLB = extractAnyPlaceholderName(locationId);
  if (fromGLB) return fromGLB;
  const dbMatch = locationId.match(/^[^/]+\/([^/]+)\/(\d+)$/i);
  if (!dbMatch) return null;
  const rawType = dbMatch[1].toLowerCase();
  const prefix = TYPE_TO_PLACEHOLDER[rawType] ?? rawType;
  const num = parseInt(dbMatch[2], 10);
  return `${prefix}_placeholder.${String(num).padStart(3, '0')}`;
}

const LANDING_SCALE = 1.2;

export function LandingHeroScene() {
  // Fetch live WH01 data from the server (public endpoint, no auth required)
  const { data: sceneData } = useQuery({
    queryKey: ['landingScene'],
    queryFn: () => trpcClient.landing.getScene.query(),
    staleTime: 60_000,
  });

  // Collect all placeholder transforms from the WH01 GLB model.
  // Positions are pre-scaled by LANDING_SCALE so pallets can be rendered
  // as siblings of the scaled warehouse group (not inside it), matching
  // the warehouse layout page where only the model is scaled.
  const { scene } = useGLTF(wh01Url) as any;
  const placeholderMap = useMemo(() => {
    const map = new Map<string, { position: [number, number, number]; rotation: [number, number, number] }>();
    if (!scene) return map;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    scene.traverse((obj: THREE.Object3D) => {
      const canonical = extractAnyPlaceholderName(obj.name);
      if (!canonical || map.has(canonical)) return;
      obj.updateWorldMatrix(true, false);
      obj.matrixWorld.decompose(pos, quat, scale);
      euler.setFromQuaternion(quat, 'XYZ');
      map.set(canonical, {
        position: [pos.x * LANDING_SCALE, pos.y * LANDING_SCALE, pos.z * LANDING_SCALE],
        rotation: [euler.x, euler.y, euler.z],
      });
    });
    return map;
  }, [scene]);

  // Build per-objectId groups of transforms for instanced rendering
  const palletGroups = useMemo(() => {
    const map = new Map<string, { position: [number, number, number]; rotation: [number, number, number] }[]>();
    const sourceRows = sceneData?.locations ?? [];
    for (const row of sourceRows) {
      if (!row.pallet) continue;
      const placeholderName = locationIdToPlaceholderName(row.id);
      if (!placeholderName) continue;
      const transform = placeholderMap.get(placeholderName);
      if (!transform) continue;
      const objectId = row.pallet.sku?.objectId ?? FALLBACK_OBJECT_ID;
      if (!map.has(objectId)) map.set(objectId, []);
      map.get(objectId)!.push(transform);
    }
    return Array.from(map.entries());
  }, [sceneData?.locations, placeholderMap]);

  return (
    <Canvas
      camera={{ position: [20, 14, 20], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 20, 10]} intensity={1.0} />
      <directionalLight position={[-8, 8, -12]} intensity={0.4} color="#93c5fd" />
      <Suspense fallback={null}>
        <group scale={[LANDING_SCALE, LANDING_SCALE, LANDING_SCALE]}>
          <Instances>
            <WH01 />
          </Instances>
        </group>
        {/* Live pallets: one instanced-mesh per pallet type, as siblings of scaled group */}
        {palletGroups.map(([objectId, transforms]) => {
          const Component = OBJECT_COMPONENT_MAP[objectId] ?? CartonOnPallet;
          return <Component key={objectId} transforms={transforms} />;
        })}
      </Suspense>
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.6}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.4}
      />
    </Canvas>
  );
}
