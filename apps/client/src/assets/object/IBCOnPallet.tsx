import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";

// ─── Module-level reusables ───────────────────────────────────────────────────
const dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _palletPos = new THREE.Vector3();
const _palletQuat = new THREE.Quaternion();
const _palletScale = new THREE.Vector3(1, 1, 1);
const _palletMat = new THREE.Matrix4();
const _localOff = new THREE.Vector3();
const _euler = new THREE.Euler();

// ─── Pallet spec — yellow, 1.2 × 1.2 × 0.15 m ───────────────────────────────
const PALLET_SIZE = 1.2;
const PALLET_HEIGHT = 0.15;
const STRINGER_OFFSETS = [-0.56, 0, 0.56] as const;
const SLAT_COUNT = 7;
const SLAT_SPACING = (PALLET_SIZE - 0.12) / (SLAT_COUNT - 1);

// ─── IBC real-world dimensions (1000 L standard) ─────────────────────────────
// Footprint: 1200 × 1000 mm, total height incl. pallet: ~1350 mm
// Inner bottle: sits inside the cage, slightly inset on all sides
const IBC_W = 1.16; // cage outer width  (X)
const IBC_D = 0.96; // cage outer depth  (Z)
const IBC_H = 1.16; // cage height above pallet top (Y)

// Steel cage wire properties
const CAGE_WIRE_R = 0.007; // 14 mm diameter wire → 7 mm radius

// HDPE inner bottle — slightly smaller than cage interior
const BTL_W = IBC_W - 0.045;
const BTL_D = IBC_D - 0.045;
const BTL_H = IBC_H - 0.055;

// Fill port / top cap
const PORT_RADIUS = 0.072;
const PORT_HEIGHT = 0.045;

// Bottom outlet valve
const VALVE_RADIUS = 0.048;
const VALVE_LENGTH = 0.12; // protrudes forward

// Cage corner post (4 vertical posts)
const POST_W = 0.025;
const POST_D = 0.025;

// Horizontal cage rail count (evenly spaced up the cage height)
const H_RAILS = 5; // horizontal rails per face
const V_WIRES_SIDE = 6; // vertical wires per long face
const V_WIRES_FRONT = 5; // vertical wires per short face

// ─── Hover ────────────────────────────────────────────────────────────────────
const HOVER_BRIGHTNESS = 1.25;

// ─── Shared pallet geometries ─────────────────────────────────────────────────
const stringerGeo = new THREE.BoxGeometry(0.08, 0.12, PALLET_SIZE);
const slatGeo = new THREE.BoxGeometry(PALLET_SIZE, 0.03, 0.12);

// ─── IBC cage geometries ──────────────────────────────────────────────────────

// Corner vertical posts (4 per IBC)
const cornerPostGeo = new THREE.BoxGeometry(POST_W, IBC_H, POST_D);

// Horizontal rails — run along X (long rails, 2 per level for front+back)
const hRailLongGeo = new THREE.BoxGeometry(
  IBC_W,
  CAGE_WIRE_R * 2,
  CAGE_WIRE_R * 2,
);
// Horizontal rails — run along Z (short rails, 2 per level for left+right)
const hRailShortGeo = new THREE.BoxGeometry(
  CAGE_WIRE_R * 2,
  CAGE_WIRE_R * 2,
  IBC_D,
);

// Vertical wires — tall thin boxes running up each face
const vWireSideGeo = new THREE.BoxGeometry(
  CAGE_WIRE_R * 2,
  IBC_H,
  CAGE_WIRE_R * 2,
); // along X faces
const vWireFrontGeo = new THREE.BoxGeometry(
  CAGE_WIRE_R * 2,
  IBC_H,
  CAGE_WIRE_R * 2,
); // along Z faces

// HDPE bottle inner container — slightly rounded box
const bottleGeo = new THREE.BoxGeometry(BTL_W, BTL_H, BTL_D);

// Top fill port
const portGeo = new THREE.CylinderGeometry(
  PORT_RADIUS,
  PORT_RADIUS * 0.9,
  PORT_HEIGHT,
  12,
);
// Port cap (slightly wider)
const portCapGeo = new THREE.CylinderGeometry(
  PORT_RADIUS * 1.15,
  PORT_RADIUS * 1.15,
  PORT_HEIGHT * 0.4,
  12,
);

// Bottom outlet valve body
const valveBodyGeo = new THREE.CylinderGeometry(
  VALVE_RADIUS,
  VALVE_RADIUS,
  VALVE_LENGTH,
  10,
);
// Valve handle
const valveHandleGeo = new THREE.BoxGeometry(0.12, 0.018, 0.018);

// Top cage frame (flat frame sitting on top of bottle)
const topFrameLongGeo = new THREE.BoxGeometry(
  IBC_W,
  CAGE_WIRE_R * 2.5,
  CAGE_WIRE_R * 2.5,
);
const topFrameShortGeo = new THREE.BoxGeometry(
  CAGE_WIRE_R * 2.5,
  CAGE_WIRE_R * 2.5,
  IBC_D,
);

// Bottom base frame rails (heavier gauge steel under the bottle)
const baseRailLongGeo = new THREE.BoxGeometry(IBC_W, 0.022, 0.022);
const baseRailShortGeo = new THREE.BoxGeometry(0.022, 0.022, IBC_D);

// ─── Interface ────────────────────────────────────────────────────────────────
export type PalletTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

export interface IBCOnPalletProps {
  transforms?: PalletTransform[];
  onClick?: (
    palletIndex: number,
    point: THREE.Vector3,
    screenX: number,
    screenY: number,
  ) => void;
  onContextMenu?: (
    palletIndex: number,
    point: THREE.Vector3,
    screenX: number,
    screenY: number,
  ) => void;
  onHover?: (palletIndex: number | null) => void;
  /** Optional per-pallet base colors aligned to `transforms`. */
  palletColors?: (string | null)[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function IBCOnPallet({
  transforms = [{ position: [0, 0, 0] }],
  onClick,
  onContextMenu,
  onHover,
  palletColors,
}: IBCOnPalletProps) {
  const totalPallets = transforms.length;

  // Instance counts
  const N = totalPallets; // 1 IBC per pallet

  // Cage parts
  const nCornerPosts = N * 4;
  const nHRailsLong = N * H_RAILS * 2; // front + back × H_RAILS levels
  const nHRailsShort = N * H_RAILS * 2; // left  + right × H_RAILS levels
  const nVWiresSide = N * V_WIRES_SIDE * 2; // 2 long faces
  const nVWiresFront = N * V_WIRES_FRONT * 2; // 2 short faces
  const nTopFrameLong = N * 2;
  const nTopFrameShort = N * 2;
  const nBaseRailLong = N * 2;
  const nBaseRailShort = N * 2;

  // ── Refs ─────────────────────────────────────────────────────────────────
  const stringerRef = useRef<THREE.InstancedMesh>(null);
  const slatRef = useRef<THREE.InstancedMesh>(null);
  const bottleRef = useRef<THREE.InstancedMesh>(null);
  const cornerPostRef = useRef<THREE.InstancedMesh>(null);
  const hRailLongRef = useRef<THREE.InstancedMesh>(null);
  const hRailShortRef = useRef<THREE.InstancedMesh>(null);
  const vWireSideRef = useRef<THREE.InstancedMesh>(null);
  const vWireFrontRef = useRef<THREE.InstancedMesh>(null);
  const topFrameLongRef = useRef<THREE.InstancedMesh>(null);
  const topFrameShortRef = useRef<THREE.InstancedMesh>(null);
  const baseRailLongRef = useRef<THREE.InstancedMesh>(null);
  const baseRailShortRef = useRef<THREE.InstancedMesh>(null);
  const portRef = useRef<THREE.InstancedMesh>(null);
  const portCapRef = useRef<THREE.InstancedMesh>(null);
  const valveBodyRef = useRef<THREE.InstancedMesh>(null);
  const valveHandleRef = useRef<THREE.InstancedMesh>(null);

  const hoverPalletRef = useRef<number | null>(null);
  const prevHoverRef = useRef<number | null>(null);
  const baseColorsRef = useRef<Map<number, string>>(new Map());

  // ── HDPE bottle label texture ────────────────────────────────────────────
  const bottleTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // HDPE white-ish translucent base
    ctx.fillStyle = "#c8dce8";
    ctx.fillRect(0, 0, 512, 512);

    // Subtle plastic surface variation
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(0, i * 64, 512, 30);
    }

    // Large label panel
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(60, 80, 392, 340);

    // Label border — orange (chemical/industrial)
    ctx.strokeStyle = "#e65c00";
    ctx.lineWidth = 6;
    ctx.strokeRect(60, 80, 392, 340);

    // Orange header bar
    ctx.fillStyle = "#e65c00";
    ctx.fillRect(60, 80, 392, 44);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("INTERMEDIATE BULK CONTAINER", 256, 110);

    // GHS hazard diamond outline
    ctx.save();
    ctx.translate(256, 195);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#cc0000";
    ctx.lineWidth = 4;
    ctx.strokeRect(-38, -38, 76, 76);
    ctx.restore();
    ctx.fillStyle = "#cc0000";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText("!", 256, 207);

    // Product info
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 20px Arial";
    ctx.fillText("CHEMICAL GRADE", 256, 258);
    ctx.font = "15px monospace";
    ctx.fillStyle = "#333";
    ctx.fillText("1000 L  /  UN1263", 256, 284);
    ctx.fillText("GROSS: 1080 KG", 256, 306);
    ctx.fillText("MAX STACK: 2", 256, 328);

    // Barcode
    ctx.fillStyle = "#111";
    for (let i = 0; i < 28; i++) {
      const bw = Math.random() * 3 + 2;
      ctx.fillRect(110 + i * 10, 342, bw, 28);
    }
    ctx.font = "11px monospace";
    ctx.fillStyle = "#222";
    ctx.fillText("4006381333931", 256, 384);

    ctx.textAlign = "left";
    return new THREE.CanvasTexture(canvas);
  }, []);

  // ── Build instance matrices ──────────────────────────────────────────────
  useEffect(() => {
    const allRefs = [
      stringerRef,
      slatRef,
      bottleRef,
      cornerPostRef,
      hRailLongRef,
      hRailShortRef,
      vWireSideRef,
      vWireFrontRef,
      topFrameLongRef,
      topFrameShortRef,
      baseRailLongRef,
      baseRailShortRef,
      portRef,
      portCapRef,
      valveBodyRef,
      valveHandleRef,
    ];
    if (allRefs.some((r) => !r.current)) return;

    let stIdx = 0,
      slIdx = 0;
    let btIdx = 0,
      cpIdx = 0;
    let hrlIdx = 0,
      hrsIdx = 0;
    let vwsIdx = 0,
      vwfIdx = 0;
    let tflIdx = 0,
      tfsIdx = 0;
    let brlIdx = 0,
      brsIdx = 0;
    let ptIdx = 0,
      pcIdx = 0;
    let vbIdx = 0,
      vhIdx = 0;

    const place = (lx: number, ly: number, lz: number, rotY = 0) => {
      _localOff.set(lx, ly, lz).applyMatrix4(_palletMat);
      dummy.position.copy(_localOff);
      // Combine pallet rotation with local rotY
      const localQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, rotY, 0),
      );
      dummy.quaternion.copy(_palletQuat).multiply(localQ);
      dummy.updateMatrix();
    };

    transforms.forEach(({ position: [px, py, pz], rotation: rot }) => {
      const [rx, ry, rz] = rot ?? [0, 0, 0];
      _euler.set(rx, ry, rz, "XYZ");
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

      // IBC base Y — sits on pallet top
      const base = PALLET_HEIGHT;
      const cageHalfH = IBC_H / 2;
      const cageCY = base + cageHalfH; // cage vertical centre

      // ── HDPE INNER BOTTLE ────────────────────────────────────────────────
      place(0, base + BTL_H / 2 + 0.01, 0);
      bottleRef.current!.setMatrixAt(btIdx++, dummy.matrix);

      // ── BASE FRAME RAILS (heavier steel under bottle) ────────────────────
      // 2 long rails (along X)
      place(0, base + 0.011, -IBC_D / 2 + 0.011);
      baseRailLongRef.current!.setMatrixAt(brlIdx++, dummy.matrix);
      place(0, base + 0.011, IBC_D / 2 - 0.011);
      baseRailLongRef.current!.setMatrixAt(brlIdx++, dummy.matrix);

      // 2 short rails (along Z)
      place(-IBC_W / 2 + 0.011, base + 0.011, 0);
      baseRailShortRef.current!.setMatrixAt(brsIdx++, dummy.matrix);
      place(IBC_W / 2 - 0.011, base + 0.011, 0);
      baseRailShortRef.current!.setMatrixAt(brsIdx++, dummy.matrix);

      // ── 4 CORNER VERTICAL POSTS ──────────────────────────────────────────
      const cx = IBC_W / 2 - POST_W / 2;
      const cz = IBC_D / 2 - POST_D / 2;
      [
        [-cx, -cz],
        [cx, -cz],
        [cx, cz],
        [-cx, cz],
      ].forEach(([px2, pz2]) => {
        place(px2, cageCY, pz2);
        cornerPostRef.current!.setMatrixAt(cpIdx++, dummy.matrix);
      });

      // ── HORIZONTAL RAILS ─────────────────────────────────────────────────
      for (let r = 0; r < H_RAILS; r++) {
        const ry = base + (r + 1) * (IBC_H / (H_RAILS + 1));

        // Front & back long rails (along X)
        place(0, ry, -IBC_D / 2);
        hRailLongRef.current!.setMatrixAt(hrlIdx++, dummy.matrix);
        place(0, ry, IBC_D / 2);
        hRailLongRef.current!.setMatrixAt(hrlIdx++, dummy.matrix);

        // Left & right short rails (along Z)
        place(-IBC_W / 2, ry, 0);
        hRailShortRef.current!.setMatrixAt(hrsIdx++, dummy.matrix);
        place(IBC_W / 2, ry, 0);
        hRailShortRef.current!.setMatrixAt(hrsIdx++, dummy.matrix);
      }

      // ── VERTICAL WIRES — long faces (front & back, along X) ──────────────
      for (let v = 0; v < V_WIRES_SIDE; v++) {
        const vx = -IBC_W / 2 + (v + 1) * (IBC_W / (V_WIRES_SIDE + 1));
        place(vx, cageCY, -IBC_D / 2);
        vWireSideRef.current!.setMatrixAt(vwsIdx++, dummy.matrix);
        place(vx, cageCY, IBC_D / 2);
        vWireSideRef.current!.setMatrixAt(vwsIdx++, dummy.matrix);
      }

      // ── VERTICAL WIRES — short faces (left & right, along Z) ─────────────
      for (let v = 0; v < V_WIRES_FRONT; v++) {
        const vz = -IBC_D / 2 + (v + 1) * (IBC_D / (V_WIRES_FRONT + 1));
        place(-IBC_W / 2, cageCY, vz);
        vWireFrontRef.current!.setMatrixAt(vwfIdx++, dummy.matrix);
        place(IBC_W / 2, cageCY, vz);
        vWireFrontRef.current!.setMatrixAt(vwfIdx++, dummy.matrix);
      }

      // ── TOP FRAME ────────────────────────────────────────────────────────
      const topY = base + IBC_H;
      // 2 long members
      place(0, topY, -IBC_D / 2);
      topFrameLongRef.current!.setMatrixAt(tflIdx++, dummy.matrix);
      place(0, topY, IBC_D / 2);
      topFrameLongRef.current!.setMatrixAt(tflIdx++, dummy.matrix);
      // 2 short members
      place(-IBC_W / 2, topY, 0);
      topFrameShortRef.current!.setMatrixAt(tfsIdx++, dummy.matrix);
      place(IBC_W / 2, topY, 0);
      topFrameShortRef.current!.setMatrixAt(tfsIdx++, dummy.matrix);

      // ── FILL PORT (top, offset toward back-centre) ────────────────────────
      const portY = topY + PORT_HEIGHT / 2;
      place(IBC_W * 0.18, portY, -IBC_D * 0.18);
      portRef.current!.setMatrixAt(ptIdx++, dummy.matrix);

      // Port cap (sits on top of port)
      place(IBC_W * 0.18, topY + PORT_HEIGHT + 0.005, -IBC_D * 0.18);
      portCapRef.current!.setMatrixAt(pcIdx++, dummy.matrix);

      // ── BOTTOM OUTLET VALVE (protrudes from front-centre bottom) ─────────
      // Rotated 90° so it points forward (along -Z)
      place(0, base + 0.12, -IBC_D / 2 - VALVE_LENGTH / 2, Math.PI / 2);
      valveBodyRef.current!.setMatrixAt(vbIdx++, dummy.matrix);

      // Valve handle (lever — perpendicular to valve body)
      place(0, base + 0.12, -IBC_D / 2 - VALVE_LENGTH * 0.6);
      valveHandleRef.current!.setMatrixAt(vhIdx++, dummy.matrix);
    });

    allRefs.forEach((r) => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        r.current.computeBoundingSphere();
      }
    });
  }, [transforms]);

  // ── Base aging colors ───────────────────────────────────────────────────
  useEffect(() => {
    if (!bottleRef.current) return;
    if (!palletColors?.length) {
      // Aging mode off — reset all instances to white (neutral) so the
      // material's own color shows through unchanged.
      for (let i = 0; i < totalPallets; i++) {
        bottleRef.current.setColorAt(i, _color.set("#ffffff"));
      }
      if (bottleRef.current.instanceColor)
        bottleRef.current.instanceColor.needsUpdate = true;
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
      bottleRef.current!.setColorAt(i, _color.set(base ? base : "#ffffff"));
    }
    if (bottleRef.current.instanceColor)
      bottleRef.current.instanceColor.needsUpdate = true;
  }, [palletColors, totalPallets]);

  // ── Hover: white brightening on bottle ───────────────────────────────────
  const applyHoverColor = (palletIdx: number | null) => {
    if (!bottleRef.current) return;

    if (prevHoverRef.current !== null && prevHoverRef.current !== palletIdx) {
      const prevBase = baseColorsRef.current.get(prevHoverRef.current);
      bottleRef.current.setColorAt(
        prevHoverRef.current,
        _color.set(prevBase ? prevBase : "#ffffff"),
      );
    }
    if (palletIdx !== null) {
      const base = baseColorsRef.current.get(palletIdx);
      bottleRef.current.setColorAt(
        palletIdx,
        _color.set(base ? base : "#ffffff").multiplyScalar(HOVER_BRIGHTNESS),
      );
    }
    if (bottleRef.current.instanceColor)
      bottleRef.current.instanceColor.needsUpdate = true;
    prevHoverRef.current = palletIdx;
  };

  // ── Pointer events ────────────────────────────────────────────────────────
  // 1 IBC per pallet, so instanceId === palletIndex directly
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined)
      onClick?.(
        e.instanceId,
        e.point,
        e.nativeEvent.clientX,
        e.nativeEvent.clientY,
      );
  };

  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined)
      onContextMenu?.(
        e.instanceId,
        e.point,
        e.nativeEvent.clientX,
        e.nativeEvent.clientY,
      );
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    hoverPalletRef.current = e.instanceId;
    document.body.style.cursor = "pointer";
    applyHoverColor(e.instanceId);
    onHover?.(e.instanceId);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverPalletRef.current = null;
    document.body.style.cursor = "default";
    applyHoverColor(null);
    onHover?.(null);
  };

  // Shared steel cage material props (used on several meshes)
  const cageMat = {
    color: "#6b7280",
    roughness: 0.3,
    metalness: 0.92,
  } as const;
  const heavyCageMat = {
    color: "#4b5563",
    roughness: 0.25,
    metalness: 0.95,
  } as const;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <group>
      {/* ── YELLOW PALLET ─────────────────────────────────────────────── */}
      <instancedMesh
        ref={stringerRef}
        args={[stringerGeo, undefined, totalPallets * 3]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#fcd303" roughness={0.6} />
      </instancedMesh>
      <instancedMesh
        ref={slatRef}
        args={[slatGeo, undefined, totalPallets * SLAT_COUNT]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#fcd303" roughness={0.6} />
      </instancedMesh>

      {/* ── HDPE INNER BOTTLE — semi-transparent blue-white plastic ────── */}
      <instancedMesh
        ref={bottleRef}
        args={[bottleGeo, undefined, N]}
        castShadow
        receiveShadow
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial
          map={bottleTexture}
          color="#b8d4e8"
          roughness={0.15}
          metalness={0.0}
          transparent
          opacity={0.78}
        />
      </instancedMesh>

      {/* ── BASE FRAME RAILS ──────────────────────────────────────────── */}
      <instancedMesh
        ref={baseRailLongRef}
        args={[baseRailLongGeo, undefined, nBaseRailLong]}
        castShadow
      >
        <meshStandardMaterial {...heavyCageMat} />
      </instancedMesh>
      <instancedMesh
        ref={baseRailShortRef}
        args={[baseRailShortGeo, undefined, nBaseRailShort]}
        castShadow
      >
        <meshStandardMaterial {...heavyCageMat} />
      </instancedMesh>

      {/* ── CORNER POSTS ──────────────────────────────────────────────── */}
      <instancedMesh
        ref={cornerPostRef}
        args={[cornerPostGeo, undefined, nCornerPosts]}
        castShadow
      >
        <meshStandardMaterial {...heavyCageMat} />
      </instancedMesh>

      {/* ── HORIZONTAL CAGE RAILS ─────────────────────────────────────── */}
      <instancedMesh
        ref={hRailLongRef}
        args={[hRailLongGeo, undefined, nHRailsLong]}
        castShadow
      >
        <meshStandardMaterial {...cageMat} />
      </instancedMesh>
      <instancedMesh
        ref={hRailShortRef}
        args={[hRailShortGeo, undefined, nHRailsShort]}
        castShadow
      >
        <meshStandardMaterial {...cageMat} />
      </instancedMesh>

      {/* ── VERTICAL CAGE WIRES ───────────────────────────────────────── */}
      <instancedMesh
        ref={vWireSideRef}
        args={[vWireSideGeo, undefined, nVWiresSide]}
        castShadow
      >
        <meshStandardMaterial {...cageMat} />
      </instancedMesh>
      <instancedMesh
        ref={vWireFrontRef}
        args={[vWireFrontGeo, undefined, nVWiresFront]}
        castShadow
      >
        <meshStandardMaterial {...cageMat} />
      </instancedMesh>

      {/* ── TOP FRAME ─────────────────────────────────────────────────── */}
      <instancedMesh
        ref={topFrameLongRef}
        args={[topFrameLongGeo, undefined, nTopFrameLong]}
        castShadow
      >
        <meshStandardMaterial {...heavyCageMat} />
      </instancedMesh>
      <instancedMesh
        ref={topFrameShortRef}
        args={[topFrameShortGeo, undefined, nTopFrameShort]}
        castShadow
      >
        <meshStandardMaterial {...heavyCageMat} />
      </instancedMesh>

      {/* ── FILL PORT ─────────────────────────────────────────────────── */}
      <instancedMesh ref={portRef} args={[portGeo, undefined, N]} castShadow>
        <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.8} />
      </instancedMesh>
      <instancedMesh ref={portCapRef} args={[portCapGeo, undefined, N]}>
        <meshStandardMaterial color="#dc2626" roughness={0.5} metalness={0.3} />
      </instancedMesh>

      {/* ── OUTLET VALVE ──────────────────────────────────────────────── */}
      <instancedMesh
        ref={valveBodyRef}
        args={[valveBodyGeo, undefined, N]}
        castShadow
      >
        <meshStandardMaterial
          color="#1f2937"
          roughness={0.35}
          metalness={0.88}
        />
      </instancedMesh>
      <instancedMesh ref={valveHandleRef} args={[valveHandleGeo, undefined, N]}>
        <meshStandardMaterial
          color="#dc2626"
          roughness={0.45}
          metalness={0.4}
        />
      </instancedMesh>
    </group>
  );
}
