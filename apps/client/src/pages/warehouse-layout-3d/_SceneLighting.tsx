import { Environment } from '@react-three/drei';

export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[10, 15, 10]} intensity={0.7} />
      <directionalLight position={[-10, 5, -10]} intensity={0.25} />
      <Environment preset="warehouse" />
    </>
  );
}
