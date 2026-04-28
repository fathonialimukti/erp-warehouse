import { useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLB_ASSET_URLS } from '../lib/glb-assets';

export type PalletInteractionInfo = {
  palletId: string;
  lokasiId: string;
  assetKey: string;
  point: THREE.Vector3;
};

interface WarehouseModelProps {
  modelUrl: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  autoRotate?: boolean;
  highlighted?: boolean;
  palletId?: string;
  lokasiId?: string;
  assetKey?: string;
  onLeftClick?: (info: PalletInteractionInfo) => void;
  onRightClick?: (info: PalletInteractionInfo) => void;
  onHoverEnter?: (info: PalletInteractionInfo) => void;
  onHoverLeave?: (info: PalletInteractionInfo) => void;
}

export function WarehouseModel({
  modelUrl,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  autoRotate = false,
  highlighted = false,
  palletId = '',
  lokasiId = '',
  assetKey = '',
  onLeftClick,
  onRightClick,
  onHoverEnter,
  onHoverLeave,
}: WarehouseModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useRef(scene.clone());

  useEffect(() => {
    clonedScene.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material;
        const materials = Array.isArray(mat) ? mat : [mat];
        materials.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.emissive.set(highlighted ? '#4f9eff' : '#000000');
            m.emissiveIntensity = highlighted ? 0.4 : 0;
          }
        });
      }
    });
  }, [highlighted]);

  useFrame((_, delta) => {
    if (!autoRotate || !groupRef.current) {
      return;
    }
    groupRef.current.rotation.y += delta * 0.5;
  });

  const buildInfo = (point: THREE.Vector3): PalletInteractionInfo => ({
    palletId,
    lokasiId,
    assetKey,
    point,
  });

  const isHovered = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasInteraction = Boolean(onLeftClick ?? onRightClick ?? onHoverEnter ?? onHoverLeave);

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      rotation={rotation}
      dispose={null}
      onPointerOver={hasInteraction ? (e) => {
        e.stopPropagation();
        // Cancel any pending leave — pointer is still inside the pallet
        if (leaveTimer.current !== null) {
          clearTimeout(leaveTimer.current);
          leaveTimer.current = null;
        }
        if (!isHovered.current) {
          isHovered.current = true;
          document.body.style.cursor = 'pointer';
          onHoverEnter?.(buildInfo(e.point));
        }
      } : undefined}
      onPointerOut={hasInteraction ? (e) => {
        // Delay the leave so sub-mesh boundary crossings don't trigger it
        if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => {
          leaveTimer.current = null;
          if (isHovered.current) {
            isHovered.current = false;
            document.body.style.cursor = 'default';
            onHoverLeave?.(buildInfo(e.point));
          }
        }, 60);
      } : undefined}
      onClick={onLeftClick ? (e) => {
        e.stopPropagation();
        onLeftClick(buildInfo(e.point));
      } : undefined}
      onContextMenu={onRightClick ? (e) => {
        e.stopPropagation();
        onRightClick(buildInfo(e.point));
      } : undefined}
    >
      <primitive object={clonedScene.current} />
    </group>
  );
}

// Preload models for instant loading
export const preloadWarehouseModels = () => {
  Object.values(GLB_ASSET_URLS).forEach((url) => {
    useGLTF.preload(url);
  });
};
