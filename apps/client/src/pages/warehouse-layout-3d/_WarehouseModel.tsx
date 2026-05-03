import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLB_ASSET_URLS } from '../../lib/glb-assets';

export type PalletInteractionInfo = {
  palletId: string;
  lokasiId: string;
  storageLocationId: string | null;
  inboundTransactionItemId: string | null;
  inboundTransactionId: string | null;
  assetKey: string;
  point: THREE.Vector3;
  screenX: number;
  screenY: number;
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
  storageLocationId?: string | null;
  inboundTransactionItemId?: string | null;
  inboundTransactionId?: string | null;
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
  storageLocationId = null,
  inboundTransactionItemId = null,
  inboundTransactionId = null,
  assetKey = '',
  onLeftClick,
  onRightClick,
  onHoverEnter,
  onHoverLeave,
}: WarehouseModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    // Clone materials per instance so emissive highlight only affects this pallet.
    clone.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }

      const material = obj.material;
      if (Array.isArray(material)) {
        obj.material = material.map((item) => item.clone());
        return;
      }

      obj.material = material.clone();
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.traverse((obj: THREE.Object3D) => {
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

  const buildInfo = (point: THREE.Vector3, screenX = 0, screenY = 0): PalletInteractionInfo => ({
    palletId,
    lokasiId,
    storageLocationId,
    inboundTransactionItemId,
    inboundTransactionId,
    assetKey,
    point,
    screenX,
    screenY,
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
        onLeftClick(buildInfo(e.point, e.nativeEvent.clientX, e.nativeEvent.clientY));
      } : undefined}
      onContextMenu={onRightClick ? (e) => {
        e.stopPropagation();
        onRightClick(buildInfo(e.point, e.nativeEvent.clientX, e.nativeEvent.clientY));
      } : undefined}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

// Preload models for instant loading
export const preloadWarehouseModels = () => {
  Object.values(GLB_ASSET_URLS).forEach((url) => {
    useGLTF.preload(url);
  });
};
