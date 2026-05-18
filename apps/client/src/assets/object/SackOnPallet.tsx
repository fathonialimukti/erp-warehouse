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

// ─── Sack dimensions (50 kg grain sack) ──────────────────────────────────────
// Real 50 kg rice/grain sack: ~780 × 480 × ~120 mm filled
const SACK_W     = 0.58;   // width  (X)
const SACK_H     = 0.14;   // height when lying flat — bulges in middle (Y)
const SACK_D     = 0.38;   // depth  (Z)
const SACK_BULGE = 0.032;  // how much the sides bow outward when full

// Layout: 2 sacks wide × 3 sacks deep per layer, 4 layers high
// 2 × 0.58 = 1.16 m (fits 1.2 m pallet width)
// 3 × 0.38 = 1.14 m (fits 1.2 m pallet depth)
const SACK_COLS         = 2;
const SACK_ROWS         = 3;
const SACK_LAYERS       = 4;
const SACKS_PER_LAYER   = SACK_COLS * SACK_ROWS;   // 6
const SACKS_PER_PALLET  = SACKS_PER_LAYER * SACK_LAYERS; // 24

// Tie knot at each end of the sack
const KNOT_RADIUS  = 0.030;

// ─── Hover ────────────────────────────────────────────────────────────────────
const HOVER_BRIGHTNESS  = 2.5;
const NORMAL_BRIGHTNESS = 1.0;

// ─── Build sack geometry with vertex-level bulge ──────────────────────────────
// Start from a BoxGeometry with enough segments to look organic,
// then push each vertex outward based on a smooth falloff from edges.
function buildSackGeometry(
  w: number, h: number, d: number, bulge: number,
  segsW = 8, segsH = 4, segsD = 6,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, segsW, segsH, segsD);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Normalised position within the sack face (-1 → +1)
    const nx = x / (w / 2);
    const ny = y / (h / 2);
    const nz = z / (d / 2);

    // Smooth bell-curve falloff: 1 at centre, 0 at edges
    // Uses (1 - t²)² — C¹ smooth, zero at boundary
    const falloffX = Math.max(0, 1 - nx * nx);
    const falloffZ = Math.max(0, 1 - nz * nz);
    const falloffY = Math.max(0, 1 - ny * ny);

    // The bulge pushes the top/bottom faces up/down and the side faces outward
    const isTopBottom = Math.abs(ny) > 0.85;
    const isSide      = Math.abs(nx) > 0.85 || Math.abs(nz) > 0.85;

    if (isTopBottom) {
      // Top/bottom: belly outward along Y
      const belly = bulge * falloffX * falloffZ;
      pos.setY(i, y + Math.sign(ny) * belly);
    } else if (isSide) {
      // Side faces: bow outward along their normal
      if (Math.abs(nx) > 0.85) {
        const bow = bulge * 0.55 * falloffZ * falloffY;
        pos.setX(i, x + Math.sign(nx) * bow);
      }
      if (Math.abs(nz) > 0.85) {
        const bow = bulge * 0.55 * falloffX * falloffY;
        pos.setZ(i, z + Math.sign(nz) * bow);
      }
    } else {
      // Interior edge loop: smooth pull
      const pull = bulge * 0.18 * falloffX * falloffZ * falloffY;
      pos.setY(i, y + Math.sign(ny || 1) * pull);
    }
  }

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// ─── Build woven burlap-style canvas texture ──────────────────────────────────
function buildSackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width  = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base burlap colour — warm tan
  ctx.fillStyle = '#c8a96e';
  ctx.fillRect(0, 0, 512, 512);

  // Woven grid pattern — horizontal threads
  ctx.strokeStyle = '#b8954e';
  ctx.lineWidth = 3;
  for (let y = 0; y < 512; y += 8) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }
  // Vertical threads
  ctx.strokeStyle = '#a07840';
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 8) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }

  // Cross-hatch weave over-under illusion
  ctx.strokeStyle = 'rgba(80,50,10,0.18)';
  ctx.lineWidth = 1.5;
  for (let y = 4; y < 512; y += 16) {
    for (let x = 0; x < 512; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y); ctx.stroke();
    }
  }
  for (let x = 4; x < 512; x += 16) {
    for (let y = 0; y < 512; y += 16) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke();
    }
  }

  // Subtle grain-fill bulge shadow at sides
  const vignette = ctx.createRadialGradient(256, 256, 80, 256, 256, 310);
  vignette.addColorStop(0,   'rgba(0,0,0,0)');
  vignette.addColorStop(1,   'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 512, 512);

  // ── Label panel ──────────────────────────────────────────────────────────
  // White label rectangle in the centre
  ctx.fillStyle = 'rgba(255,252,240,0.92)';
  ctx.fillRect(110, 140, 292, 232);

  ctx.strokeStyle = '#5c7a2e';
  ctx.lineWidth = 4;
  ctx.strokeRect(110, 140, 292, 232);

  // Green header bar
  ctx.fillStyle = '#5c7a2e';
  ctx.fillRect(110, 140, 292, 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PREMIUM GRAIN', 256, 167);

  // Product name
  ctx.fillStyle = '#2e4a10';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RICE', 256, 222);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#3a3a2a';
  ctx.fillText('Long Grain · Grade A', 256, 248);
  ctx.fillText('NET WT: 50 KG', 256, 270);
  ctx.fillText('KEEP DRY · KEEP COOL', 256, 292);

  // Small wheat icon (hand-drawn)
  ctx.strokeStyle = '#8a6c20';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(256, 308); ctx.lineTo(256, 340); ctx.stroke();
  [-12, -6, 0, 6, 12].forEach((dx, i) => {
    const baseY = 308 + i * 0 - (i % 2 === 0 ? 6 : 0);
    ctx.beginPath();
    ctx.ellipse(256 + dx, baseY, 5, 9, dx < 0 ? -0.4 : 0.4, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Barcode
  ctx.fillStyle = '#111';
  for (let i = 0; i < 22; i++) {
    const bw = Math.random() * 3 + 2;
    ctx.fillRect(132 + i * 9, 346, bw, 20);
  }
  ctx.font = '10px monospace';
  ctx.fillStyle = '#333';
  ctx.fillText('8901234567890', 256, 372);

  ctx.textAlign = 'left';
  return new THREE.CanvasTexture(canvas);
}

// ─── Shared geometries (module-level, created once) ───────────────────────────
const stringerGeo = new THREE.BoxGeometry(0.08, 0.12, PALLET_SIZE);
const slatGeo     = new THREE.BoxGeometry(PALLET_SIZE, 0.03, 0.12);

// Organic sack body — bulged box
const sackGeo = buildSackGeometry(SACK_W, SACK_H, SACK_D, SACK_BULGE);

// Tie knot at each end — small flattened sphere
const knotGeo = new THREE.SphereGeometry(KNOT_RADIUS, 8, 6);
knotGeo.scale(1, 0.65, 0.65); // flatten it slightly

// ─── Interface ────────────────────────────────────────────────────────────────
export type PalletTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

export interface SackOnPalletProps {
  transforms?:    PalletTransform[];
  onClick?:       (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onContextMenu?: (palletIndex: number, point: THREE.Vector3, screenX: number, screenY: number) => void;
  onHover?:       (palletIndex: number | null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SackOnPallet({
  transforms  = [{ position: [0, 0, 0] }],
  onClick,
  onContextMenu,
  onHover,
}: SackOnPalletProps) {

  const totalPallets = transforms.length;
  const totalSacks   = totalPallets * SACKS_PER_PALLET;
  // 2 knots per sack on top layer only — SACKS_PER_LAYER is always 6 (2×3 or 3×2)
  const totalKnots   = totalPallets * SACKS_PER_LAYER * 2;

  // ── Refs ─────────────────────────────────────────────────────────────────
  const stringerRef = useRef<THREE.InstancedMesh>(null);
  const slatRef     = useRef<THREE.InstancedMesh>(null);
  const sackRef     = useRef<THREE.InstancedMesh>(null);
  const knotRef     = useRef<THREE.InstancedMesh>(null);

  const hoverPalletRef = useRef<number | null>(null);
  const prevHoverRef   = useRef<number | null>(null);

  // ── Woven sack texture ────────────────────────────────────────────────────
  const sackTexture = useMemo(() => buildSackTexture(), []);

  // ── Build instance matrices ──────────────────────────────────────────────
  useEffect(() => {
    if (!stringerRef.current || !slatRef.current ||
        !sackRef.current     || !knotRef.current) return;

    let stIdx = 0, slIdx = 0, skIdx = 0, knIdx = 0;

    const place = (lx: number, ly: number, lz: number, rotY = 0) => {
      _localOff.set(lx, ly, lz).applyMatrix4(_palletMat);
      dummy.position.copy(_localOff);
      const localQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
      dummy.quaternion.copy(_palletQuat).multiply(localQ);
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

      // ── SACK STACK ────────────────────────────────────────────────────────
      for (let layer = 0; layer < SACK_LAYERS; layer++) {
        const isTopLayer = layer === SACK_LAYERS - 1;

        // Alternate orientation each layer for structural stability.
        // Even layers: sacks lie along X axis (W=0.58 along X, D=0.38 along Z) → 2 cols × 3 rows
        // Odd  layers: sacks rotated 90° so they lie along Z axis (W=0.58 along Z, D=0.38 along X) → 3 cols × 2 rows
        // Crucially the grid count must ALSO swap so the footprint stays within the pallet.
        const isRotated = layer % 2 !== 0;
        const rotY      = isRotated ? Math.PI / 2 : 0;

        // Grid dimensions in world space for this layer
        const cols    = isRotated ? SACK_ROWS  : SACK_COLS;  // 3 or 2
        const rows    = isRotated ? SACK_COLS  : SACK_ROWS;  // 2 or 3
        const spacingX = isRotated ? SACK_D    : SACK_W;     // footprint along X
        const spacingZ = isRotated ? SACK_W    : SACK_D;     // footprint along Z

        const lStartX = -(cols * spacingX) / 2 + spacingX / 2;
        const lStartZ = -(rows * spacingZ) / 2 + spacingZ / 2;

        // Sacks settle slightly under weight — each layer compresses a little
        const compression = layer * 0.008;
        const sackY = PALLET_HEIGHT + SACK_H / 2 + layer * (SACK_H - compression);

        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < rows; row++) {
            const lx = lStartX + col * spacingX;
            const lz = lStartZ + row * spacingZ;

            // Deterministic jitter — stable across renders, looks hand-placed
            const jitterX = (((col * 3 + row * 7 + layer * 11) % 7) - 3) * 0.004;
            const jitterZ = (((col * 5 + row * 3 + layer * 7) % 7) - 3) * 0.004;

            place(lx + jitterX, sackY, lz + jitterZ, rotY);
            sackRef.current!.setMatrixAt(skIdx++, dummy.matrix);

            // Knots only on top layer (hidden under sacks above on lower layers)
            if (isTopLayer) {
              // Knot sits at each end along the sack's long axis.
              // After rotation the long axis is always spacingX (the larger dimension).
              const knotOff = spacingX / 2 - 0.02;
              const knotOffX = isRotated ? 0       : knotOff;
              const knotOffZ = isRotated ? knotOff : 0;

              place(lx + jitterX - knotOffX, sackY + SACK_H * 0.28, lz + jitterZ - knotOffZ, rotY);
              knotRef.current!.setMatrixAt(knIdx++, dummy.matrix);

              place(lx + jitterX + knotOffX, sackY + SACK_H * 0.28, lz + jitterZ + knotOffZ, rotY);
              knotRef.current!.setMatrixAt(knIdx++, dummy.matrix);
            }
          }
        }
      }
    });

    [stringerRef, slatRef, sackRef, knotRef].forEach(r => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        r.current.computeBoundingSphere();
      }
    });
  }, [transforms]);

  // ── Hover: white brightening, written once on enter/leave ────────────────
  const applyHoverColor = (palletIdx: number | null) => {
    if (!sackRef.current) return;

    if (prevHoverRef.current !== null && prevHoverRef.current !== palletIdx) {
      const prev = prevHoverRef.current * SACKS_PER_PALLET;
      for (let i = prev; i < prev + SACKS_PER_PALLET; i++) {
        sackRef.current.setColorAt(i, _color.setScalar(NORMAL_BRIGHTNESS));
      }
    }
    if (palletIdx !== null) {
      const first = palletIdx * SACKS_PER_PALLET;
      for (let i = first; i < first + SACKS_PER_PALLET; i++) {
        sackRef.current.setColorAt(i, _color.setScalar(HOVER_BRIGHTNESS));
      }
    }
    if (sackRef.current.instanceColor) sackRef.current.instanceColor.needsUpdate = true;
    prevHoverRef.current = palletIdx;
  };

  // ── Pointer events ────────────────────────────────────────────────────────
  const getPallet = (id: number) => Math.floor(id / SACKS_PER_PALLET);

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

      {/* GRAIN SACK BODIES */}
      <instancedMesh
        ref={sackRef}
        args={[sackGeo, undefined, totalSacks]}
        castShadow receiveShadow
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial
          map={sackTexture}
          roughness={0.92}
          metalness={0.0}
        />
      </instancedMesh>

      {/* TIE KNOTS — top layer only, darker burlap twist */}
      <instancedMesh ref={knotRef} args={[knotGeo, undefined, totalKnots]} castShadow>
        <meshStandardMaterial color="#7a5c28" roughness={0.95} metalness={0.0} />
      </instancedMesh>

    </group>
  );
}