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
const STRINGER_OFFSETS = [-0.56, 0, 0.56] as const;
const SLAT_COUNT       = 7;
const SLAT_SPACING     = (PALLET_SIZE - 0.12) / (SLAT_COUNT - 1);

// ─── 200L steel drum dimensions ──────────────────────────────────────────────
// Real 200L drum: ⌀572 mm × 883 mm tall
const DRUM_RADIUS      = 0.286;   // 572 mm diameter
const DRUM_HEIGHT      = 0.883;   // 883 mm tall
const DRUM_SEGMENTS    = 16;      // cylinder radial segments — good balance
const DRUM_BODY_SEGS   = 3;       // height segments (for rolling ribs)

// Lid disc
const LID_RADIUS       = DRUM_RADIUS - 0.008;
const LID_HEIGHT       = 0.018;

// Chime ring (top & bottom rolled edge)
const CHIME_RADIUS     = DRUM_RADIUS + 0.006;
const CHIME_HEIGHT     = 0.028;

// Rolling rib (2 ribs around the body mid-section)
const RIB_RADIUS       = DRUM_RADIUS + 0.010;
const RIB_HEIGHT       = 0.022;

// Bung plug (small cap on lid)
const BUNG_RADIUS      = 0.028;
const BUNG_HEIGHT      = 0.018;

// ─── Layout: 2 × 2 on a 1.2 × 1.2 pallet ────────────────────────────────────
// Each drum footprint ≈ 0.572 m → 2 × 0.572 = 1.144 m → fits with small margin
const DRUM_COLS          = 2;
const DRUM_ROWS          = 2;
const DRUMS_PER_PALLET   = DRUM_COLS * DRUM_ROWS; // 4
const DRUM_SPACING_X     = PALLET_SIZE / DRUM_COLS;  // 0.6 m centre-to-centre
const DRUM_SPACING_Z     = PALLET_SIZE / DRUM_ROWS;  // 0.6 m centre-to-centre

// ─── Hover ────────────────────────────────────────────────────────────────────
const HOVER_BRIGHTNESS  = 1.25;
const NORMAL_BRIGHTNESS = 1.0;

// ─── Shared geometries (module-level, never recreated) ────────────────────────
const stringerGeo = new THREE.BoxGeometry(0.08, 0.12, PALLET_SIZE);
const slatGeo     = new THREE.BoxGeometry(PALLET_SIZE, 0.03, 0.12);

// Drum body — slightly tapered top (real drums narrow slightly at top)
const drumBodyGeo = new THREE.CylinderGeometry(
  DRUM_RADIUS * 0.97,  // top radius slightly smaller
  DRUM_RADIUS,
  DRUM_HEIGHT,
  DRUM_SEGMENTS,
  DRUM_BODY_SEGS,
);

// Lid — flat disc
const lidGeo = new THREE.CylinderGeometry(LID_RADIUS, LID_RADIUS, LID_HEIGHT, DRUM_SEGMENTS);

// Chime ring (top & bottom rolled edge — same geo, placed at both ends)
const chimeGeo = new THREE.CylinderGeometry(CHIME_RADIUS, CHIME_RADIUS, CHIME_HEIGHT, DRUM_SEGMENTS);

// Rolling rib
const ribGeo = new THREE.CylinderGeometry(RIB_RADIUS, RIB_RADIUS, RIB_HEIGHT, DRUM_SEGMENTS);

// Bung plug
const bungGeo = new THREE.CylinderGeometry(BUNG_RADIUS, BUNG_RADIUS, BUNG_HEIGHT, 8);

// ─── Interface ────────────────────────────────────────────────────────────────
export type PalletTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

export interface DrumOnPalletProps {
  transforms?:    PalletTransform[];
  onClick?:       (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onContextMenu?: (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onHover?:       (palletIndex: number | null) => void;
  /** Optional per-pallet base colors aligned to `transforms`. */
  palletColors?:   (string | null)[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DrumOnPallet({
  transforms  = [{ position: [0, 0, 0] }],
  onClick,
  onContextMenu,
  onHover,
  palletColors,
}: DrumOnPalletProps) {

  const totalPallets    = transforms.length;
  const totalDrums      = totalPallets * DRUMS_PER_PALLET;
  // Each drum has: 1 body + 1 lid + 2 chimes (top+bottom) + 2 ribs + 1 bung
  // Chimes and ribs share instanced meshes — total instances = totalDrums each
  const totalChimes     = totalDrums * 2;  // top + bottom chime per drum
  const totalRibs       = totalDrums * 2;  // upper + lower rib per drum

  // ── Refs ─────────────────────────────────────────────────────────────────
  const stringerRef  = useRef<THREE.InstancedMesh>(null);
  const slatRef      = useRef<THREE.InstancedMesh>(null);
  const drumBodyRef  = useRef<THREE.InstancedMesh>(null);
  const lidRef       = useRef<THREE.InstancedMesh>(null);
  const chimeRef     = useRef<THREE.InstancedMesh>(null);
  const ribRef       = useRef<THREE.InstancedMesh>(null);
  const bungRef      = useRef<THREE.InstancedMesh>(null);

  const hoverPalletRef = useRef<number | null>(null);
  const prevHoverRef   = useRef<number | null>(null);
  const baseColorsRef  = useRef<Map<number, string>>(new Map());

  // ── Canvas texture — steel drum label wrap ───────────────────────────────
  const drumTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Steel base — dark gunmetal gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0,  '#4a4a4a');
    grad.addColorStop(0.15, '#6e6e6e');
    grad.addColorStop(0.5,  '#555555');
    grad.addColorStop(0.85, '#6e6e6e');
    grad.addColorStop(1.0,  '#4a4a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Subtle vertical brushed-steel streaks
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
    }

    // White label panel
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(96, 30, 320, 196);

    // Label border
    ctx.strokeStyle = '#cc2200';
    ctx.lineWidth = 4;
    ctx.strokeRect(96, 30, 320, 196);

    // Red hazard stripe top of label
    ctx.fillStyle = '#cc2200';
    ctx.fillRect(96, 30, 320, 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚠  FLAMMABLE  ⚠', 256, 50);

    // Product name
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('INDUSTRIAL', 256, 108);
    ctx.fillText('OIL', 256, 145);

    // Sub info
    ctx.font = '13px monospace';
    ctx.fillStyle = '#333';
    ctx.fillText('200 L / NET 180 KG', 256, 172);
    ctx.fillText('UN3082  PGIII', 256, 190);

    // Barcode area
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 22; i++) {
      const bw = Math.random() * 3 + 2;
      ctx.fillRect(130 + i * 10, 200, bw, 20);
    }

    ctx.textAlign = 'left'; // reset
    return new THREE.CanvasTexture(canvas);
  }, []);

  // ── Build instance matrices ──────────────────────────────────────────────
  useEffect(() => {
    if (!stringerRef.current  || !slatRef.current    ||
        !drumBodyRef.current  || !lidRef.current      ||
        !chimeRef.current     || !ribRef.current      ||
        !bungRef.current) return;

    let stIdx = 0, slIdx = 0;
    let bdIdx = 0, ldIdx = 0, chIdx = 0, rbIdx = 0, bgIdx = 0;

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

      // ── 4 DRUMS (2 × 2) ──────────────────────────────────────────────────
      // Centre the 2×2 grid on the pallet
      const startX = -(DRUM_COLS - 1) * DRUM_SPACING_X / 2;
      const startZ = -(DRUM_ROWS - 1) * DRUM_SPACING_Z / 2;
      const drumBaseY = PALLET_HEIGHT; // drums sit on pallet top

      for (let col = 0; col < DRUM_COLS; col++) {
        for (let row = 0; row < DRUM_ROWS; row++) {
          const lx = startX + col * DRUM_SPACING_X;
          const lz = startZ + row * DRUM_SPACING_Z;

          // ── Body ──────────────────────────────────────────────────────
          const bodyCentreY = drumBaseY + DRUM_HEIGHT / 2;
          place(lx, bodyCentreY, lz);
          drumBodyRef.current!.setMatrixAt(bdIdx++, dummy.matrix);

          // ── Lid (top) ─────────────────────────────────────────────────
          const lidY = drumBaseY + DRUM_HEIGHT + LID_HEIGHT / 2;
          place(lx, lidY, lz);
          lidRef.current!.setMatrixAt(ldIdx++, dummy.matrix);

          // ── Bottom chime ──────────────────────────────────────────────
          place(lx, drumBaseY + CHIME_HEIGHT / 2, lz);
          chimeRef.current!.setMatrixAt(chIdx++, dummy.matrix);

          // ── Top chime (just below lid) ────────────────────────────────
          place(lx, drumBaseY + DRUM_HEIGHT - CHIME_HEIGHT / 2, lz);
          chimeRef.current!.setMatrixAt(chIdx++, dummy.matrix);

          // ── Lower rolling rib (1/3 up) ────────────────────────────────
          place(lx, drumBaseY + DRUM_HEIGHT * 0.33, lz);
          ribRef.current!.setMatrixAt(rbIdx++, dummy.matrix);

          // ── Upper rolling rib (2/3 up) ────────────────────────────────
          place(lx, drumBaseY + DRUM_HEIGHT * 0.66, lz);
          ribRef.current!.setMatrixAt(rbIdx++, dummy.matrix);

          // ── Bung plug (offset on lid surface) ─────────────────────────
          const bungY = drumBaseY + DRUM_HEIGHT + LID_HEIGHT + BUNG_HEIGHT / 2;
          place(lx + DRUM_RADIUS * 0.45, bungY, lz + DRUM_RADIUS * 0.10);
          bungRef.current!.setMatrixAt(bgIdx++, dummy.matrix);
        }
      }
    });

    [stringerRef, slatRef, drumBodyRef, lidRef, chimeRef, ribRef, bungRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        r.current.computeBoundingSphere();
      }
    });
  }, [transforms]);

  // ── Base aging colors ───────────────────────────────────────────────────
  useEffect(() => {
    if (!drumBodyRef.current) return;
    if (!palletColors?.length) {
      // Aging mode off — reset all instances to white (neutral) so the
      // material's own color shows through unchanged.
      for (let i = 0; i < totalPallets * DRUMS_PER_PALLET; i++) {
        drumBodyRef.current.setColorAt(i, _color.set('#ffffff'));
      }
      if (drumBodyRef.current.instanceColor) drumBodyRef.current.instanceColor.needsUpdate = true;
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
      const first = i * DRUMS_PER_PALLET;
      for (let j = first; j < first + DRUMS_PER_PALLET; j++) {
        drumBodyRef.current!.setColorAt(j, _color.set(base ? base : '#ffffff'));
      }
    }
    if (drumBodyRef.current.instanceColor) drumBodyRef.current.instanceColor.needsUpdate = true;
  }, [palletColors, totalPallets]);

  // ── Hover: white brightening, written once on enter/leave ────────────────
  const applyHoverColor = (palletIdx: number | null) => {
    if (!drumBodyRef.current) return;

    if (prevHoverRef.current !== null && prevHoverRef.current !== palletIdx) {
      const prev = prevHoverRef.current * DRUMS_PER_PALLET;
      const prevBase = baseColorsRef.current.get(prevHoverRef.current);
      for (let i = prev; i < prev + DRUMS_PER_PALLET; i++) {
        drumBodyRef.current.setColorAt(i, _color.set(prevBase ? prevBase : '#ffffff'));
      }
    }

    if (palletIdx !== null) {
      const first = palletIdx * DRUMS_PER_PALLET;
      const base = baseColorsRef.current.get(palletIdx);
      for (let i = first; i < first + DRUMS_PER_PALLET; i++) {
        drumBodyRef.current.setColorAt(i, _color.set(base ? base : '#ffffff').multiplyScalar(HOVER_BRIGHTNESS));
      }
    }

    if (drumBodyRef.current.instanceColor) drumBodyRef.current.instanceColor.needsUpdate = true;
    prevHoverRef.current = palletIdx;
  };

  // ── Pointer events ────────────────────────────────────────────────────────
  const getPallet = (id: number) => Math.floor(id / DRUMS_PER_PALLET);

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

      {/* DRUM BODIES — steel with label texture */}
      <instancedMesh
        ref={drumBodyRef}
        args={[drumBodyGeo, undefined, totalDrums]}
        castShadow receiveShadow
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial
          map={drumTexture}
          roughness={0.35}
          metalness={0.75}
        />
      </instancedMesh>

      {/* DRUM LIDS — brushed steel top */}
      <instancedMesh ref={lidRef} args={[lidGeo, undefined, totalDrums]} castShadow>
        <meshStandardMaterial color="#7a7a7a" roughness={0.25} metalness={0.90} />
      </instancedMesh>

      {/* CHIME RINGS — top & bottom rolled edges */}
      <instancedMesh ref={chimeRef} args={[chimeGeo, undefined, totalChimes]} castShadow>
        <meshStandardMaterial color="#5a5a5a" roughness={0.20} metalness={0.95} />
      </instancedMesh>

      {/* ROLLING RIBS */}
      <instancedMesh ref={ribRef} args={[ribGeo, undefined, totalRibs]} castShadow>
        <meshStandardMaterial color="#5a5a5a" roughness={0.20} metalness={0.95} />
      </instancedMesh>

      {/* BUNG PLUGS */}
      <instancedMesh ref={bungRef} args={[bungGeo, undefined, totalDrums]}>
        <meshStandardMaterial color="#222222" roughness={0.6} metalness={0.3} />
      </instancedMesh>

    </group>
  );
}