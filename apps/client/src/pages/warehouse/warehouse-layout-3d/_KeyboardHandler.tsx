import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useBounds, useKeyboardControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type SceneKeyMap = { resetView: boolean; fitAll: boolean };

/**
 * Handles warehouse scene keyboard shortcuts.
 * Must be rendered inside both a <Bounds> and a <KeyboardControls> context.
 *   R → reset camera to initial position
 *   F → fit camera to all pallet bounds
 */
export function KeyboardHandler() {
  const { controls } = useThree();
  const bounds = useBounds();
  const [subscribe] = useKeyboardControls<keyof SceneKeyMap>();

  useEffect(() => {
    const unsubReset = subscribe(
      (state) => state.resetView,
      (pressed) => {
        if (!pressed) return;
        const oc = controls as unknown as OrbitControlsImpl;
        if (oc && typeof oc.reset === "function") {
          oc.reset();
        }
      },
    );

    const unsubFit = subscribe(
      (state) => state.fitAll,
      (pressed) => {
        if (!pressed) return;
        bounds.refresh().fit();
      },
    );

    return () => {
      unsubReset();
      unsubFit();
    };
  }, [subscribe, controls, bounds]);

  return null;
}
