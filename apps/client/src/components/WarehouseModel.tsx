import { useGLTF } from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLB_ASSET_URLS } from '../lib/glb-assets';

interface WarehouseModelProps {
  modelUrl: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  autoRotate?: boolean;
}

export function WarehouseModel({
  modelUrl,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  autoRotate = false,
}: WarehouseModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useRef(scene.clone());

  useFrame((_, delta) => {
    if (!autoRotate || !groupRef.current) {
      return;
    }
    groupRef.current.rotation.y += delta * 0.5;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      rotation={rotation}
      dispose={null}
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
