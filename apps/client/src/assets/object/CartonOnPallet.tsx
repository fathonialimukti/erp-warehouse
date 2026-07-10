import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';

// ─── Module-level reusables ───────────────────────────────────────────────────
const dummy        = new THREE.Object3D();
const _color       = new THREE.Color();
const _palletPos   = new THREE.Vector3();
const _palletQuat  = new THREE.Quaternion();
const _palletScale = new THREE.Vector3(1, 1, 1);
const _palletMat   = new THREE.Matrix4();
const _localOff    = new THREE.Vector3();
const _euler       = new THREE.Euler();

// ─── Pallet spec — yellow, 1.2 × 1.2 × 0.15 m ───────────────────────────────
const PALLET_SIZE      = 1.2;
const PALLET_HEIGHT    = 0.15;
const STRINGER_OFFSETS = [-0.56, 0, 0.56] as const; // 3 longitudinal stringers
const SLAT_COUNT       = 7;
const SLAT_SPACING     = (PALLET_SIZE - 0.12) / (SLAT_COUNT - 1);

// ─── Carton layout — 4 wide × 3 deep × 4 high ────────────────────────────────
// Each carton: 0.3 w × 0.35 h × 0.4 d (fits 4×3 = 12 per layer on 1.2 m pallet)
const CTN_W    = 0.3;
const CTN_H    = 0.35;
const CTN_D    = 0.4;
const CTN_GAP  = 0.004;
const CTN_COLS = 4;   // X — 4 × 0.3 = 1.2 m
const CTN_ROWS = 3;   // Z — 3 × 0.4 = 1.2 m
const CTN_LYRS = 4;   // Y — 4 × 0.35 = 1.4 m above pallet top
const CARTONS_PER_PALLET = CTN_COLS * CTN_ROWS * CTN_LYRS; // 48

// ─── Tape strip on top of each carton ────────────────────────────────────────
// One semi-transparent strip per carton top — same count as cartons
const TAPE_W = 0.06;
const TAPE_H = 0.002;

// ─── Hover ────────────────────────────────────────────────────────────────────
const HOVER_BRIGHTNESS  = 1.25;
const NORMAL_BRIGHTNESS = 1.0;

// ─── Shared geometries (module-level) ────────────────────────────────────────
const stringerGeo = new THREE.BoxGeometry(0.08, 0.12, PALLET_SIZE);
const slatGeo     = new THREE.BoxGeometry(PALLET_SIZE, 0.03, 0.12);
const cartonGeo   = new THREE.BoxGeometry(CTN_W - CTN_GAP, CTN_H - CTN_GAP, CTN_D - CTN_GAP);
const tapeGeo     = new THREE.BoxGeometry(TAPE_W, TAPE_H, CTN_D - 0.01);

// ─── Interface ────────────────────────────────────────────────────────────────
export type PalletTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

export interface CartonOnPalletProps {
  transforms?:    PalletTransform[];
  onClick?:       (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onContextMenu?: (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onHover?:       (palletIndex: number | null) => void;
  /** Optional per-pallet base colors aligned to `transforms`. When provided, these colors are multiplied onto the carton material via instanceColor. */
  palletColors?:   (string | null)[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CartonOnPallet({
  transforms  = [{ position: [0, 0, 0] }],
  onClick,
  onContextMenu,
  onHover,
  palletColors,
}: CartonOnPalletProps) {

  const totalPallets = transforms.length;
  const totalCartons = totalPallets * CARTONS_PER_PALLET;

  // ── Refs ─────────────────────────────────────────────────────────────────
  const stringerRef = useRef<THREE.InstancedMesh>(null);
  const slatRef     = useRef<THREE.InstancedMesh>(null);
  const cartonRef   = useRef<THREE.InstancedMesh>(null);
  const tapeRef     = useRef<THREE.InstancedMesh>(null);

  const hoverPalletRef = useRef<number | null>(null);
  const prevHoverRef   = useRef<number | null>(null);
  const baseColorsRef  = useRef<Map<number, string>>(new Map());

  // ── Canvas texture — cardboard label ────────────────────────────────────
  const cartonTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Cardboard base
    ctx.fillStyle = '#d2b48c';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle corrugation lines
    ctx.strokeStyle = '#b8956a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 32; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 8 + 2);
      ctx.lineTo(256, i * 8 + 2);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 232, 232);

    // Inner border
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 216, 216);

    // Label text
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('FRAGILE', 58, 78);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#4e342e';
    ctx.fillText('SKU: 8842-ASSET', 38, 120);
    ctx.fillText('QTY: 24 PCS', 55, 148);
    ctx.fillText('NET: 12.5 KG', 52, 174);

    // Arrow up symbol
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('↑ THIS SIDE UP ↑', 18, 218);

    // Barcode
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 20; i++) {
      const bw = Math.random() * 4 + 2;
      ctx.fillRect(48 + i * 8, 228, bw, 22);
    }

    return new THREE.CanvasTexture(canvas);
  }, []);

  // ── Build instance matrices ──────────────────────────────────────────────
  useEffect(() => {
    if (!stringerRef.current || !slatRef.current ||
        !cartonRef.current   || !tapeRef.current) return;

    let stIdx = 0, slIdx = 0, cIdx = 0, tIdx = 0;

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

      // ── YELLOW PALLET ────────────────────────────────────────────────────
      STRINGER_OFFSETS.forEach((offsetX) => {
        place(offsetX, 0.06, 0);
        stringerRef.current!.setMatrixAt(stIdx++, dummy.matrix);
      });

      for (let i = 0; i < SLAT_COUNT; i++) {
        place(0, 0.12 + 0.015, -0.54 + i * SLAT_SPACING);
        slatRef.current!.setMatrixAt(slIdx++, dummy.matrix);
      }

      // ── CARTONS ──────────────────────────────────────────────────────────
      // Centre the 4×3 footprint exactly on the 1.2×1.2 pallet
      const localStartX = -(CTN_COLS * CTN_W) / 2 + CTN_W / 2;
      const localStartZ = -(CTN_ROWS * CTN_D) / 2 + CTN_D / 2;

      for (let layer = 0; layer < CTN_LYRS; layer++) {
        const localY = PALLET_HEIGHT + CTN_H / 2 + layer * CTN_H;

        for (let col = 0; col < CTN_COLS; col++) {
          for (let row = 0; row < CTN_ROWS; row++) {
            const lcx = localStartX + col * CTN_W;
            const lcz = localStartZ + row * CTN_D;

            // Carton body
            place(lcx, localY, lcz);
            cartonRef.current!.setMatrixAt(cIdx++, dummy.matrix);

            // Tape strip — sits flush on top surface of carton
            place(lcx, localY + CTN_H / 2 + TAPE_H / 2, lcz);
            tapeRef.current!.setMatrixAt(tIdx++, dummy.matrix);
          }
        }
      }
    });

    [stringerRef, slatRef, cartonRef, tapeRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        r.current.computeBoundingSphere();
      }
    });
  }, [transforms]);

  // ── Base aging colors ───────────────────────────────────────────────────
  useEffect(() => {
    if (!cartonRef.current) return;
    if (!palletColors?.length) {
      // Aging mode off — reset all instances to white (neutral) so the
      // material's own color shows through unchanged.
      for (let i = 0; i < totalPallets * CARTONS_PER_PALLET; i++) {
        cartonRef.current.setColorAt(i, _color.set('#ffffff'));
      }
      if (cartonRef.current.instanceColor) cartonRef.current.instanceColor.needsUpdate = true;
      baseColorsRef.current = new Map();
      return;
    }
    const next = new Map<number, string>();
    palletColors.forEach((color, idx) => {
      if (color) next.set(idx, color);
    });
    baseColorsRef.current = next;
    for (let i = 0; i < totalPallets; i++) {
      const base = next.get(i);
      const first = i * CARTONS_PER_PALLET;
      for (let j = first; j < first + CARTONS_PER_PALLET; j++) {
        cartonRef.current!.setColorAt(j, _color.set(base ? base : '#ffffff'));
      }
    }
    if (cartonRef.current.instanceColor) cartonRef.current.instanceColor.needsUpdate = true;
  }, [palletColors, totalPallets]);

  // ── Hover: white brightening, written once on enter/leave ────────────────
  const applyHoverColor = (palletIdx: number | null) => {
    if (!cartonRef.current) return;

    if (prevHoverRef.current !== null && prevHoverRef.current !== palletIdx) {
      const prev = prevHoverRef.current * CARTONS_PER_PALLET;
      const prevBase = baseColorsRef.current.get(prevHoverRef.current);
      for (let i = prev; i < prev + CARTONS_PER_PALLET; i++) {
        cartonRef.current.setColorAt(i, _color.set(prevBase ? prevBase : '#ffffff'));
      }
    }

    if (palletIdx !== null) {
      const first = palletIdx * CARTONS_PER_PALLET;
      const base = baseColorsRef.current.get(palletIdx);
      for (let i = first; i < first + CARTONS_PER_PALLET; i++) {
        cartonRef.current.setColorAt(i, _color.set(base ? base : '#ffffff').multiplyScalar(HOVER_BRIGHTNESS));
      }
    }

    if (cartonRef.current.instanceColor) cartonRef.current.instanceColor.needsUpdate = true;
    prevHoverRef.current = palletIdx;
  };

  // ── Pointer events ────────────────────────────────────────────────────────
  const getPallet = (id: number) => Math.floor(id / CARTONS_PER_PALLET);

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
      <instancedMesh
        ref={stringerRef}
        args={[stringerGeo, undefined, totalPallets * 3]}
        receiveShadow castShadow
      >
        <meshStandardMaterial color="#fcd303" roughness={0.6} />
      </instancedMesh>

      {/* YELLOW PALLET SLATS */}
      <instancedMesh
        ref={slatRef}
        args={[slatGeo, undefined, totalPallets * SLAT_COUNT]}
        receiveShadow castShadow
      >
        <meshStandardMaterial color="#fcd303" roughness={0.6} />
      </instancedMesh>

      {/* CARTON BOXES */}
      <instancedMesh
        ref={cartonRef}
        args={[cartonGeo, undefined, totalCartons]}
        castShadow receiveShadow
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial map={cartonTexture} roughness={0.85} metalness={0.0} />
      </instancedMesh>

      {/* TAPE STRIPS — semi-transparent, no shadow needed */}
      <instancedMesh ref={tapeRef} args={[tapeGeo, undefined, totalCartons]}>
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.45}
          roughness={0.1}
          metalness={0.1}
        />
      </instancedMesh>

    </group>
  );
}