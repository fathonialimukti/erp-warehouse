import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
} from '@react-three/drei';
import { CartonOnPallet } from '../assets/object/CartonOnPallet';
import { SackOnPallet } from '../assets/object/SackOnPallet';
import { CrateOnPallet } from '../assets/object/CrateOnPallet';
import { DrumOnPallet } from '../assets/object/DrumOnPallet';
import { IBCOnPallet } from '../assets/object/IBCOnPallet';

export type PalletObjectId =
  | 'CartonOnPallet'
  | 'SackOnPallet'
  | 'CrateOnPallet'
  | 'DrumOnPallet'
  | 'IBCOnPallet'
  | 'BrickOnPallet';

const KNOWN_OBJECT_IDS: PalletObjectId[] = [
  'CartonOnPallet',
  'SackOnPallet',
  'CrateOnPallet',
  'DrumOnPallet',
  'IBCOnPallet',
  'BrickOnPallet',
];

const PACKAGE_NAME_MAP: Record<string, PalletObjectId> = {
  carton: 'CartonOnPallet',
  sack: 'SackOnPallet',
  bag: 'SackOnPallet',
  crate: 'CrateOnPallet',
  drum: 'DrumOnPallet',
  barrel: 'DrumOnPallet',
  ibc: 'IBCOnPallet',
  tote: 'IBCOnPallet',
  brick: 'BrickOnPallet',
  block: 'BrickOnPallet',
};

const OBJECT_LABEL: Record<PalletObjectId, string> = {
  CartonOnPallet: 'Carton',
  SackOnPallet: 'Sack',
  CrateOnPallet: 'Crate',
  DrumOnPallet: 'Drum',
  IBCOnPallet: 'IBC Tote',
  BrickOnPallet: 'Brick',
};

/**
 * Resolves which 3D object component represents a pallet's contents.
 * Prefers the explicit `sku.objectId`; falls back to the SKU package name;
 * defaults to Carton (matches the warehouse scene fallback).
 */
export function resolvePalletObjectId(
  objectId?: string | null,
  packageName?: string | null,
): PalletObjectId {
  if (objectId && (KNOWN_OBJECT_IDS as string[]).includes(objectId)) {
    return objectId as PalletObjectId;
  }
  if (packageName) {
    const key = packageName.toLowerCase();
    const match = Object.keys(PACKAGE_NAME_MAP).find((k) => key.includes(k));
    if (match) return PACKAGE_NAME_MAP[match];
  }
  return 'CartonOnPallet';
}

export function palletObjectLabel(objectId: PalletObjectId): string {
  return OBJECT_LABEL[objectId];
}

interface PalletObjectViewerProps {
  objectId?: string | null;
  packageName?: string | null;
  palletNumber?: string | null;
  className?: string;
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="rounded-md bg-black/65 px-3 py-2 text-xs text-white">
        Loading 3D model...
      </div>
    </Html>
  );
}

function PalletObject({ objectId }: { objectId: PalletObjectId }) {
  // BrickOnPallet uses a different prop API (positions) — all others use transforms.
  if (objectId === 'BrickOnPallet') {
    // Lazy import avoided: Brick falls back to Carton visually per scene convention.
    return <CartonOnPallet transforms={[{ position: [0, 0, 0] }]} />;
  }
  const transform = { position: [0, 0, 0] as [number, number, number] };
  switch (objectId) {
    case 'SackOnPallet':
      return <SackOnPallet transforms={[transform]} />;
    case 'CrateOnPallet':
      return <CrateOnPallet transforms={[transform]} />;
    case 'DrumOnPallet':
      return <DrumOnPallet transforms={[transform]} />;
    case 'IBCOnPallet':
      return <IBCOnPallet transforms={[transform]} />;
    case 'CartonOnPallet':
    default:
      return <CartonOnPallet transforms={[transform]} />;
  }
}

function PalletObjectViewer({
  objectId,
  packageName,
  palletNumber,
  className,
}: PalletObjectViewerProps) {
  const resolved = useMemo(
    () => resolvePalletObjectId(objectId, packageName),
    [objectId, packageName],
  );

  return (
    <div
      className={className}
      data-ai-context={JSON.stringify({
        section: 'pallet-3d-viewer',
        objectId: resolved,
        palletNumber,
      })}
    >
      <Canvas camera={{ position: [3, 2.2, 3.6], fov: 42 }} shadows>
        <color attach="background" args={['#0c4a6e']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 9, 5]} intensity={1.15} castShadow />
        <directionalLight position={[-5, 4, -6]} intensity={0.35} color="#67e8f9" />
        <Suspense fallback={<LoadingFallback />}>
          {/* Center the ~1.5m-tall stack around the orbit target */}
          <group position={[0, -0.75, 0]}>
            <PalletObject objectId={resolved} />
          </group>
          <Environment preset="warehouse" />
          <ContactShadows
            position={[0, -0.78, 0]}
            opacity={0.4}
            scale={6}
            blur={2.4}
            far={4}
          />
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={0.7}
          enablePan={false}
          minDistance={2.2}
          maxDistance={7}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

export { PalletObjectViewer };
