import { GizmoHelper, GizmoViewport } from "@react-three/drei";

/** Bottom-right viewport gizmo that shows world-axis orientation. */
export function SceneGizmo() {
  return (
    <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
      <GizmoViewport
        axisColors={["#f87171", "#4ade80", "#60a5fa"]}
        labelColor="white"
      />
    </GizmoHelper>
  );
}
