import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from '@react-three/drei';
import type { Group } from 'three';

interface GlbCanvasViewerProps {
  modelUrl?: string;
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

function PlaceholderBox() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color="#4f46e5" />
    </mesh>
  );
}

function GLBModel({ modelUrl }: { modelUrl: string }) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => gltf.scene.clone() as Group, [gltf.scene]);

  return <primitive object={scene} />;
}

function GlbCanvasViewer({ modelUrl, className }: GlbCanvasViewerProps) {

  return (
    <div className={className}>
      <Canvas camera={{ position: [5, 4, 7], fov: 42 }} shadows>
        <color attach="background" args={["#f3f4f6"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[8, 10, 6]} intensity={1.1} castShadow />

        <Suspense fallback={<LoadingFallback />}>
          {modelUrl ? <GLBModel modelUrl={modelUrl} /> : <PlaceholderBox />}
          <Environment preset="warehouse" />
          <ContactShadows position={[0, -1.2, 0]} opacity={0.35} scale={18} blur={2} far={10} />
        </Suspense>

        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}

export { GlbCanvasViewer };
