import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Sphere, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { Mesh } from 'three';

const RotatingBox = () => {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Box ref={meshRef} args={[1, 1, 1]} position={[-1.5, 0, 0]}>
      <meshStandardMaterial color='#3b82f6' />
    </Box>
  );
};

const RotatingSphere = () => {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.3;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.7, 32, 32]} position={[1.5, 0, 0]}>
      <meshStandardMaterial color='#10b981' metalness={0.8} roughness={0.2} />
    </Sphere>
  );
};

export const ThreeDemo = () => (
  <div className='w-full h-100 rounded-lg overflow-hidden bg-gray-900'>
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color='#ff00ff' />

      <RotatingBox />
      <RotatingSphere />

      <Environment preset='sunset' />
      <OrbitControls enableZoom enablePan={false} />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </Canvas>
  </div>
);
