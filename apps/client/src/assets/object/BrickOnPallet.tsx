import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

const dummy = new THREE.Object3D();

interface BrickOnPalletProps {
  positions?: [number, number, number][];
}

export function BrickOnPallet({ positions = [[0, 0, 0]] }: BrickOnPalletProps) {
  const blockRef = useRef<THREE.InstancedMesh>(null);
  const stringerRef = useRef<THREE.InstancedMesh>(null);
  const slatRef = useRef<THREE.InstancedMesh>(null);

  // Configuration
  // A standard Cinder Block is roughly 40cm x 20cm x 20cm
  // On a 1.2m pallet:
  // 3 blocks wide (1.2m)
  // 6 blocks deep (1.2m)
  // 5 layers high
  const totalPallets = positions.length;
  const blocksPerLayer = 18; // 3x6
  const layers = 5;
  const totalBlocks = totalPallets * blocksPerLayer * layers;

  const blockDim = { w: 0.39, h: 0.19, d: 0.19 }; // Slightly smaller for mortar gaps
  const palletHeight = 0.15;

  // 1. Create a Concrete Noise Texture
  const concreteTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base Grey
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, 256, 256);

    // Add "Salt and Pepper" noise for concrete grit
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const gray = Math.random() * 50 + 100;
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, 1, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  useEffect(() => {
    if (!blockRef.current) return;

    let bIdx = 0,
      stIdx = 0,
      slIdx = 0;

    positions.forEach(([px, py, pz]) => {
      // --- PALLET LOGIC (Yellow) ---
      [-0.56, 0, 0.56].forEach((offsetX) => {
        dummy.position.set(px + offsetX, py + 0.06, pz);
        dummy.updateMatrix();
        stringerRef.current!.setMatrixAt(stIdx++, dummy.matrix);
      });
      for (let i = 0; i < 7; i++) {
        dummy.position.set(px, py + 0.135, pz + (-0.54 + i * 0.18));
        dummy.updateMatrix();
        slatRef.current!.setMatrixAt(slIdx++, dummy.matrix);
      }

      // --- BRICK LOGIC (Running Bond Pattern) ---
      for (let y = 0; y < layers; y++) {
        const isEvenLayer = y % 2 === 0;

        for (let x = 0; x < 3; x++) {
          for (let z = 0; z < 6; z++) {
            const bx = px - 0.4 + x * 0.4;
            const bz = pz - 0.5 + z * 0.2;
            const by = py + palletHeight + y * 0.2 + 0.1;

            // Offset every other layer for a "Running Bond" (staggered) look
            const staggeredX = isEvenLayer ? bx : bx + 0.05;

            dummy.position.set(staggeredX, by, bz);
            // Randomly flip blocks 180 degrees so textures don't repeat perfectly
            dummy.rotation.set(0, Math.random() > 0.5 ? Math.PI : 0, 0);
            dummy.updateMatrix();
            blockRef.current!.setMatrixAt(bIdx++, dummy.matrix);
          }
        }
      }
    });

    blockRef.current.instanceMatrix.needsUpdate = true;
    stringerRef.current!.instanceMatrix.needsUpdate = true;
    slatRef.current!.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <group>
      {/* Pallet Refs */}
      <instancedMesh
        ref={stringerRef}
        args={[undefined, undefined, totalPallets * 3]}
      >
        <boxGeometry args={[0.08, 0.12, 1.2]} />
        <meshStandardMaterial color="#fcd303" />
      </instancedMesh>
      <instancedMesh
        ref={slatRef}
        args={[undefined, undefined, totalPallets * 7]}
      >
        <boxGeometry args={[1.2, 0.03, 0.12]} />
        <meshStandardMaterial color="#fcd303" />
      </instancedMesh>

      {/* Cinder Blocks */}
      <instancedMesh ref={blockRef} args={[undefined, undefined, totalBlocks]}>
        {/* We use a Shape or a custom geometry to get the 'Holes' look, 
            but for a high-performance detail, a Box with a Normal Map 
            or a subtle scale-down works best. */}
        <boxGeometry args={[blockDim.w, blockDim.h, blockDim.d]} />
        <meshStandardMaterial
          map={concreteTexture}
          color="#999"
          roughness={0.9}
        />
      </instancedMesh>
    </group>
  );
}
