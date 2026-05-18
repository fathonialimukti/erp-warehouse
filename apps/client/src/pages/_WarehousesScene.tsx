// @ts-nocheck
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Html } from '@react-three/drei'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import * as THREE from 'three'
import { Button, Modal } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useGLTF } from '@react-three/drei'
import warehousesUrl from '../assets/glb/Warehouses.glb?url'
import { trpcClient } from '../lib/trpc'

interface AllocationInfo { total: number; used: number; rate: number }

const HOVER_EMISSIVE = new THREE.Color('#4338ca')
const BASE_EMISSIVE = new THREE.Color('#000000')

/** Sets emissive color on all MeshStandardMaterial meshes within a group. */
function applyEmissive(group: THREE.Group, color: THREE.Color, intensity: number) {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial) {
        m.emissive.copy(color)
        m.emissiveIntensity = intensity
        m.needsUpdate = true
      }
    }
  })
}

const PLANE_MATERIALS = [
  'Corrugated_PVC_Grey',
  'Brick',
  'Corrugated Plates',
  'Metal Tiles',
  'Eevee Glass',
  'Black Garage Wndow Frame',
  'Garage_Pole',
  'Flood Lamp 2 Warm lsrc (30;25;20)',
  'Glass',
  'Fire Exit Sign',
  'Vent Blue',
  'Black Box',
] as const

function WarehouseBuilding({ nodes, materials, planePrefix, textNode, position, warehouseId, warehouseName, objectId, allocation, onRightClick }) {
  const groupRef = useRef(null)
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  // Clone materials per building so emissive changes don't bleed into other buildings
  // (shared GLB materials would otherwise cause all 3 warehouses to glow together)
  const myMaterials = useMemo(() => {
    const result: Record<string, THREE.MeshStandardMaterial> = {}
    for (const key of [...PLANE_MATERIALS, 'Warehouse Name.001'] as string[]) {
      const m = (materials as Record<string, THREE.MeshStandardMaterial>)[key]
      if (m) result[key] = m.clone()
    }
    return result
  }, [materials])

  useEffect(() => {
    return () => { Object.values(myMaterials).forEach((m) => m.dispose()) }
  }, [myMaterials])

  useEffect(() => {
    if (!groupRef.current) return
    applyEmissive(groupRef.current, hovered ? HOVER_EMISSIVE : BASE_EMISSIVE, hovered ? 0.5 : 0)
  }, [hovered])

  const meshSuffixes = ['', '_1', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9', '_10', '_11']

  return (
    <group
      ref={groupRef}
      position={position}
      scale={[0.8, 1, 1.132]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
      onClick={(e) => { e.stopPropagation(); if (warehouseId) navigate(`/warehouse/${warehouseId}`) }}
      onContextMenu={(e) => {
        e.stopPropagation()
        if (warehouseId) onRightClick({ id: warehouseId, name: warehouseName ?? objectId, objectId, allocation })
      }}
    >
      {meshSuffixes.map((suffix, i) => {
        const nodeName = `${planePrefix}${suffix}`
        const node = nodes[nodeName]
        const matName = PLANE_MATERIALS[i]
        const mat = myMaterials[matName]
        if (!node || !mat) return null
        return (
          <mesh key={nodeName} castShadow receiveShadow geometry={node.geometry} material={mat} />
        )
      })}

      {/* Warehouse name text */}
      {nodes[textNode] && (
        <mesh
          geometry={nodes[textNode].geometry}
          material={myMaterials['Warehouse Name.001']}
          position={[-3.238, 5.99, 12.464]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[3.031, 0.883, 1.817]}
        />
      )}

      {/* Hover tooltip */}
      {hovered && warehouseId && (
        <Html position={[0, 15, 8]} center distanceFactor={40}>
          <div
            style={{
              background: 'rgba(10,10,16,0.92)',
              border: '1px solid rgba(99,102,241,0.6)',
              borderRadius: 7,
              padding: '5px 14px',
              color: '#e0e0ff',
              fontSize: 11,
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 24px rgba(67,56,202,0.35)',
            }}
          >
            <span style={{ fontWeight: 700 }}>{warehouseName ?? objectId}</span>
            <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 10 }}>click · right-click for info</span>
          </div>
        </Html>
      )}
    </group>
  )
}




const WH_DEFS = [
  { objectId: 'WH01', position: [-23, 0, 0] as [number, number, number], planePrefix: 'Plane005', textNode: 'Text001' },
  { objectId: 'WH02', position: [0,   0, 0] as [number, number, number], planePrefix: 'Plane006', textNode: 'Text002' },
  { objectId: 'WH03', position: [23,  0, 0] as [number, number, number], planePrefix: 'Plane007', textNode: 'Text003' },
]

function Scene({ warehouses, allocations, onRightClick }) {
  const { nodes, materials } = useGLTF(warehousesUrl) as any

  const warehouseByObjectId = useMemo(() => {
    const map = {}
    warehouses.forEach((w) => { if (w.objectId) map[w.objectId] = w })
    return map
  }, [warehouses])

  const allocationById = useMemo(() => {
    const map = {}
    allocations.forEach((a) => { map[a.warehouseId] = a })
    return map
  }, [allocations])

  return (
    <>
      {/* Ground plane */}
      {nodes.Plane && (
        <mesh
          geometry={nodes.Plane.geometry}
          material={materials.Material}
          position={[0, 0, 10]}
          scale={[35, 1, 25]}
        />
      )}

      {WH_DEFS.map(({ objectId, position, planePrefix, textNode }) => {
        const wh = warehouseByObjectId[objectId]
        const alloc = wh ? allocationById[wh.id] : null
        return (
          <WarehouseBuilding
            key={objectId}
            nodes={nodes}
            materials={materials}
            planePrefix={planePrefix}
            textNode={textNode}
            position={position}
            warehouseId={wh?.id}
            warehouseName={wh?.name}
            objectId={objectId}
            allocation={alloc ?? { total: 0, used: 0, rate: 0 }}
            onRightClick={onRightClick}
          />
        )
      })}
    </>
  )
}

export function WarehousesScene() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouse.warehouse.list', 'dashboard'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 60_000,
  })

  const { data: allocationsData } = useQuery({
    queryKey: ['dashboard.warehouseAllocations'],
    queryFn: () => trpcClient.dashboard.warehouseAllocations.query(),
    staleTime: 60_000,
  })

  const warehouses = useMemo(
    () => (warehousesData?.data ?? []).map((w) => ({ id: w.id, objectId: w.objectId, name: w.name })),
    [warehousesData],
  )

  const allocations = useMemo(() => allocationsData ?? [], [allocationsData])

  const handleRightClick = (wh) => {
    setSelected(wh)
    setModalOpen(true)
  }

  return (
    <>
      <Canvas
        camera={{ position: [0, 30, 40], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        shadows={false}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 30, 10]} intensity={1.5} />
        <Suspense fallback={null}>
          <Scene warehouses={warehouses} allocations={allocations} onRightClick={handleRightClick} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={30}
          maxDistance={120}
          target={[0, 0, 10]}
        />
      </Canvas>

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <Icon icon="solar:buildings-2-linear" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>{selected?.name ?? '—'}</Modal.Heading>
                <p className="mt-0.5 text-sm text-muted">{selected?.objectId}</p>
              </Modal.Header>

              <Modal.Body>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Storage Allocation</span>
                    <span className="text-lg font-bold text-primary">{selected?.allocation.rate ?? 0}%</span>
                  </div>
                  <div style={{ background: '#e5e7eb', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                    <div
                      style={{
                        background: '#6366f1',
                        height: '100%',
                        width: `${selected?.allocation.rate ?? 0}%`,
                        borderRadius: 6,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted">
                    {selected?.allocation.used ?? 0} of {selected?.allocation.total ?? 0} locations occupied
                  </p>
                </div>
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" onPress={() => setModalOpen(false)}>Close</Button>
                <Button
                  variant="secondary"
                  onPress={() => { setModalOpen(false); if (selected) navigate(`/warehouse/${selected.id}/layout`) }}
                >
                  <Icon icon="tdesign:map-3d" className="size-4" />
                  3D Layout
                </Button>
                <Button
                  variant="primary"
                  onPress={() => { setModalOpen(false); if (selected) navigate(`/warehouse/${selected.id}`) }}
                >
                  View Detail
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
}

useGLTF.preload(warehousesUrl)
