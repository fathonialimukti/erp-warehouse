import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';

// ─── Module-level reusables ───────────────────────────────────────────────────
const dummy        = new THREE.Object3D();
const _color       = new THREE.Color();
const _palletPos   = new THREE.Vector3();
const _palletQuat  = new THREE.Quaternion();
const _palletScale = new THREE.Vector3(1, 1, 1);
const _palletMat   = new THREE.Matrix4();
const _localOff    = new THREE.Vector3();
const _euler       = new THREE.Euler();

// ─── Pallet constants — IDENTICAL to CartonOnPallet ──────────────────────────
const PALLET_SIZE      = 1.2;
const PALLET_HEIGHT    = 0.15;
const STRINGER_OFFSETS = [-0.56, 0, 0.56] as const;
const SLAT_COUNT       = 7;
const SLAT_SPACING     = (PALLET_SIZE - 0.12) / (SLAT_COUNT - 1);

// ─── Crate layout ─────────────────────────────────────────────────────────────
const CRATE_W   = 0.3;
const CRATE_H   = 0.42;
const CRATE_D   = 0.4;
const CRATE_GAP = 0.005;
const COLS      = 4;
const ROWS      = 2;
const LAYERS    = 3;
const CRATES_PER_PALLET = COLS * ROWS * LAYERS; // 24

// ─── Bottles — top layer only ─────────────────────────────────────────────────
const BTL_COLS       = 6;
const BTL_ROWS       = 4;
const BTL_PER_CRATE  = BTL_COLS * BTL_ROWS;       // 24
const VISIBLE_CRATES = COLS * ROWS;                // 8
const BTL_PER_PALLET = VISIBLE_CRATES * BTL_PER_CRATE; // 192
const BTL_SPACING    = 0.044;
const BTL_RADIUS     = 0.034;
const BTL_HEIGHT     = 0.32;

// ─── Merged neck+cap ──────────────────────────────────────────────────────────
const NECK_R    = 0.018;
const NECK_H    = 0.048;
const CAP_R     = 0.020;
const CAP_H     = 0.011;
const NECKCAP_H = NECK_H + CAP_H;

// ─── Hover brightness — white instanceColor multiplies material color.
//     1.0 = no change, 1.35 = subtle but clearly visible brightening.
const HOVER_BRIGHTNESS = 1.35;
const NORMAL_BRIGHTNESS = 1.0;

// ─── Shared geometries ────────────────────────────────────────────────────────
const crateGeo    = new THREE.BoxGeometry(CRATE_W - CRATE_GAP, CRATE_H - CRATE_GAP, CRATE_D - CRATE_GAP);
const stringerGeo = new THREE.BoxGeometry(0.08, 0.12, PALLET_SIZE);
const slatGeo     = new THREE.BoxGeometry(PALLET_SIZE, 0.03, 0.12);

const _bottleProfile: THREE.Vector2[] = [];
for (let i = 0; i <= 10; i++) {
  const t = i / 10;
  const y = t * BTL_HEIGHT;
  let r = BTL_RADIUS;
  if (t > 0.75) r = BTL_RADIUS * (1 - ((t - 0.75) / 0.25) * 0.45);
  if (t < 0.05)  r = BTL_RADIUS * (0.70 + (t / 0.05) * 0.30);
  _bottleProfile.push(new THREE.Vector2(r, y));
}
const bottleGeo  = new THREE.LatheGeometry(_bottleProfile, 6);
const neckCapGeo = new THREE.CylinderGeometry(CAP_R, NECK_R * 1.1, NECKCAP_H, 6);

// ─── Interface ────────────────────────────────────────────────────────────────
export type PalletTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

export interface CrateOnPalletProps {
  transforms?:    PalletTransform[];
  onClick?:       (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onContextMenu?: (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onHover?:       (palletIndex: number | null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CrateOnPallet({
  transforms  = [{ position: [0, 0, 0] }],
  onClick,
  onContextMenu,
  onHover,
}: CrateOnPalletProps) {

  const totalPallets = transforms.length;
  const totalCrates  = totalPallets * CRATES_PER_PALLET;
  const totalBottles = totalPallets * BTL_PER_PALLET;

  const stringerRef = useRef<THREE.InstancedMesh>(null);
  const slatRef     = useRef<THREE.InstancedMesh>(null);
  const crateRef    = useRef<THREE.InstancedMesh>(null);
  const bottleRef   = useRef<THREE.InstancedMesh>(null);
  const neckCapRef  = useRef<THREE.InstancedMesh>(null);

  const hoverPalletRef = useRef<number | null>(null);
  const prevHoverRef   = useRef<number | null>(null); // track changes to avoid redundant writes

  // ── Canvas texture ──────────────────────────────────────────────────────
  const crateTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#b22222';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#8b1111';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(0, 50 * i + 5); ctx.lineTo(256, 50 * i + 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(50 * i + 5, 0); ctx.lineTo(50 * i + 5, 256); ctx.stroke();
    }

    ctx.strokeStyle = '#6a0f0f';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 236, 236);

    ctx.fillStyle = '#fff8f0';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BEER', 85, 90);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#ffe0b2';
    ctx.fillText('24 × 330ml', 62, 130);
    ctx.fillText('SKU: BR-330-R', 45, 158);

    ctx.fillStyle = '#fff';
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(52 + i * 9, 178, Math.random() * 5 + 2, 40);
    }

    return new THREE.CanvasTexture(canvas);
  }, []);

  // ── Build instance matrices ──────────────────────────────────────────────
  useEffect(() => {
    if (!stringerRef.current || !slatRef.current || !crateRef.current ||
        !bottleRef.current   || !neckCapRef.current) return;

    let stIdx = 0, slIdx = 0, cIdx = 0, bIdx = 0, ncIdx = 0;

    const place = (lx: number, ly: number, lz: number) => {
      _localOff.set(lx, ly, lz).applyMatrix4(_palletMat);
      dummy.position.copy(_localOff);
      dummy.quaternion.copy(_palletQuat);
      dummy.updateMatrix();
    };

    transforms.forEach(({ position: [px, py, pz], rotation: rot }) => {
      const [rx, ry, rz] = rot ?? [0, 0, 0];
      _euler.set(rx, ry, rz, 'XYZ');
      _palletQuat.setFromEuler(_euler);
      _palletPos.set(px, py, pz);
      _palletMat.compose(_palletPos, _palletQuat, _palletScale);

      STRINGER_OFFSETS.forEach((offsetX) => {
        place(offsetX, 0.06, 0);
        stringerRef.current!.setMatrixAt(stIdx++, dummy.matrix);
      });

      for (let i = 0; i < SLAT_COUNT; i++) {
        place(0, 0.12 + 0.015, -0.54 + i * SLAT_SPACING);
        slatRef.current!.setMatrixAt(slIdx++, dummy.matrix);
      }

      const localStartX = -(COLS * CRATE_W) / 2 + CRATE_W / 2;
      const localStartZ = -(ROWS * CRATE_D) / 2 + CRATE_D / 2;

      for (let layer = 0; layer < LAYERS; layer++) {
        const isTopLayer  = layer === LAYERS - 1;
        const localCrateY = PALLET_HEIGHT + CRATE_H / 2 + layer * CRATE_H;

        for (let col = 0; col < COLS; col++) {
          for (let row = 0; row < ROWS; row++) {
            const lcx = localStartX + col * CRATE_W;
            const lcz = localStartZ + row * CRATE_D;

            place(lcx, localCrateY, lcz);
            crateRef.current!.setMatrixAt(cIdx++, dummy.matrix);

            if (!isTopLayer) continue;

            const btlBaseY = PALLET_HEIGHT + layer * CRATE_H + 0.02;
            const bStartX  = lcx - (BTL_COLS - 1) * BTL_SPACING / 2;
            const bStartZ  = lcz - (BTL_ROWS - 1) * BTL_SPACING / 2;

            for (let bxi = 0; bxi < BTL_COLS; bxi++) {
              for (let bzi = 0; bzi < BTL_ROWS; bzi++) {
                const lbx = bStartX + bxi * BTL_SPACING;
                const lbz = bStartZ + bzi * BTL_SPACING;

                place(lbx, btlBaseY + BTL_HEIGHT / 2, lbz);
                bottleRef.current!.setMatrixAt(bIdx++, dummy.matrix);

                place(lbx, btlBaseY + BTL_HEIGHT + NECKCAP_H / 2, lbz);
                neckCapRef.current!.setMatrixAt(ncIdx++, dummy.matrix);
              }
            }
          }
        }
      }
    });

    [stringerRef, slatRef, crateRef, bottleRef, neckCapRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        r.current.computeBoundingSphere();
      }
    });
  }, [transforms]);

  // ── Hover: subtle white brightening, no animation needed ─────────────────
  // instanceColor multiplies material.color, so:
  //   white (1,1,1)  → neutral, shows base red   (normal)
  //   (1.35,1.35,1.35) → uniformly brighter red  (hovered)
  // No pulse / no frame loop needed — just write once on enter/leave.
  const applyHoverColor = (palletIdx: number | null) => {
    if (!crateRef.current) return;

    // Reset previously hovered pallet back to neutral
    if (prevHoverRef.current !== null && prevHoverRef.current !== palletIdx) {
      const prev = prevHoverRef.current * CRATES_PER_PALLET;
      for (let i = prev; i < prev + CRATES_PER_PALLET; i++) {
        crateRef.current.setColorAt(i, _color.setScalar(NORMAL_BRIGHTNESS));
      }
    }

    // Brighten newly hovered pallet
    if (palletIdx !== null) {
      const first = palletIdx * CRATES_PER_PALLET;
      for (let i = first; i < first + CRATES_PER_PALLET; i++) {
        crateRef.current.setColorAt(i, _color.setScalar(HOVER_BRIGHTNESS));
      }
    }

    if (crateRef.current.instanceColor) crateRef.current.instanceColor.needsUpdate = true;
    prevHoverRef.current = palletIdx;
  };

  // useFrame only needed if there's an animation — removed entirely for static hover
  useFrame(() => {}); // kept as no-op so R3F doesn't warn on removal; safe to delete

  // ── Pointer events ────────────────────────────────────────────────────────
  const getPallet = (id: number) => Math.floor(id / CRATES_PER_PALLET);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined)
      onClick?.(getPallet(e.instanceId), e.point, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined)
      onContextMenu?.(getPallet(e.instanceId), e.point, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const pi = getPallet(e.instanceId);
    hoverPalletRef.current = pi;
    document.body.style.cursor = 'pointer';
    applyHoverColor(pi);
    onHover?.(pi);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverPalletRef.current = null;
    document.body.style.cursor = 'default';
    applyHoverColor(null);
    onHover?.(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <group>

      {/* YELLOW PALLET STRINGERS */}
      <instancedMesh ref={stringerRef} args={[stringerGeo, undefined, totalPallets * 3]} receiveShadow castShadow>
        <meshStandardMaterial color="#fcd303" roughness={0.6} />
      </instancedMesh>

      {/* YELLOW PALLET SLATS */}
      <instancedMesh ref={slatRef} args={[slatGeo, undefined, totalPallets * SLAT_COUNT]} receiveShadow castShadow>
        <meshStandardMaterial color="#fcd303" roughness={0.6} />
      </instancedMesh>

      {/* CRATE SHELLS */}
      <instancedMesh
        ref={crateRef}
        args={[crateGeo, undefined, totalCrates]}
        castShadow receiveShadow
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial map={crateTexture} roughness={0.65} metalness={0.05} />
      </instancedMesh>

      {/* BOTTLE BODIES — top layer only */}
      <instancedMesh ref={bottleRef} args={[bottleGeo, undefined, totalBottles]}>
        <meshStandardMaterial color="#2e4d2e" roughness={0.08} transparent opacity={0.82} />
      </instancedMesh>

      {/* MERGED NECK + CAP */}
      <instancedMesh ref={neckCapRef} args={[neckCapGeo, undefined, totalBottles]}>
        <meshStandardMaterial color="#aaaaaa" roughness={0.3} metalness={0.80} />
      </instancedMesh>

    </group>
  );
}