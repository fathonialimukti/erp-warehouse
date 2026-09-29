import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const CAMERA_FLOOR_MIN_Y = 0.4;
const MOVE_SPEED = 8;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.05;
const MIN_PITCH = -Math.PI / 2 + 0.05;

export function SceneCameraControls() {
  const gl = useThree((state) => state.gl);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const rightMouseDownRef = useRef(false);
  const isPointerLockedRef = useRef(false);
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDir = useRef(new THREE.Vector3());
  const cameraDir = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  const wasFpsLookModeRef = useRef(false);

  useEffect(() => {
    const element = gl.domElement;
    const preventContextMenu = (e: Event) => e.preventDefault();
    element?.addEventListener("contextmenu", preventContextMenu);

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeysRef.current.add(key);
      if (
        key === " " ||
        key === "spacebar" ||
        key === "pageup" ||
        key === "pagedown"
      ) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    };

    const onPointerDown = (e: MouseEvent) => {
      if (!element || e.button !== 2) {
        return;
      }
      e.preventDefault();
      rightMouseDownRef.current = true;
      if (controlsRef.current) {
        const camera = controlsRef.current.object;
        if (camera.rotation.order !== "YXZ") {
          camera.rotation.reorder("YXZ");
        }
        controlsRef.current.enabled = false;
      }
      element.style.cursor = "none";
      void element.requestPointerLock();
    };

    const onPointerUp = (e: MouseEvent) => {
      if (!element || e.button !== 2) {
        return;
      }
      rightMouseDownRef.current = false;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      element.style.cursor = "";
      if (document.pointerLockElement === element) {
        void document.exitPointerLock();
      }
    };

    const onPointerLockChange = () => {
      isPointerLockedRef.current = document.pointerLockElement === element;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLockedRef.current && !rightMouseDownRef.current) {
        return;
      }

      const controls = controlsRef.current;
      if (!controls) {
        return;
      }

      const camera = controls.object;
      camera.rotation.y -= e.movementX * LOOK_SENSITIVITY;
      camera.rotation.x -= e.movementY * LOOK_SENSITIVITY;
      camera.rotation.x = THREE.MathUtils.clamp(
        camera.rotation.x,
        MIN_PITCH,
        MAX_PITCH,
      );
      camera.updateMatrixWorld();

      camera.getWorldDirection(cameraDir.current);
      lookTarget.current
        .copy(camera.position)
        .add(cameraDir.current.multiplyScalar(10));
      controls.target.copy(lookTarget.current);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    element?.addEventListener("mousedown", onPointerDown);
    document.addEventListener("mouseup", onPointerUp);

    return () => {
      element?.removeEventListener("contextmenu", preventContextMenu);
      element?.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      element.style.cursor = "";
      if (document.pointerLockElement === element) {
        void document.exitPointerLock();
      }
    };
  }, [gl]);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const fpsLookMode = isPointerLockedRef.current || rightMouseDownRef.current;
    controls.enabled = !fpsLookMode;

    const keys = pressedKeysRef.current;
    const forwardKey = keys.has("w") || keys.has("arrowup");
    const backwardKey = keys.has("s") || keys.has("arrowdown");
    const leftKey = keys.has("a") || keys.has("arrowleft");
    const rightKey = keys.has("d") || keys.has("arrowright");
    const upKey = keys.has(" ") || keys.has("spacebar");
    const downKey = keys.has("shift");

    if (forwardKey || backwardKey || leftKey || rightKey || upKey || downKey) {
      moveDir.current.set(0, 0, 0);

      if (forwardKey || backwardKey || leftKey || rightKey) {
        // Move exactly in camera facing direction (includes up/down pitch).
        state.camera.getWorldDirection(forward.current);
        if (forward.current.lengthSq() > 0.0001) {
          forward.current.normalize();
        }

        // Strafe axis relative to camera orientation.
        right.current.crossVectors(forward.current, state.camera.up);
        if (right.current.lengthSq() > 0.0001) {
          right.current.normalize();
        }

        if (forwardKey) moveDir.current.add(forward.current);
        if (backwardKey) moveDir.current.sub(forward.current);
        if (rightKey) moveDir.current.add(right.current);
        if (leftKey) moveDir.current.sub(right.current);
      }

      if (upKey) moveDir.current.y += 1;
      if (downKey) moveDir.current.y -= 1;

      if (moveDir.current.lengthSq() > 0.0001) {
        moveDir.current.normalize().multiplyScalar(MOVE_SPEED * delta);
        state.camera.position.add(moveDir.current);
        state.camera.getWorldDirection(cameraDir.current);
        lookTarget.current
          .copy(state.camera.position)
          .add(cameraDir.current.multiplyScalar(10));
        controls.target.copy(lookTarget.current);
      }
    }

    // Rule: camera cannot go below floor.
    if (state.camera.position.y < CAMERA_FLOOR_MIN_Y) {
      state.camera.position.y = CAMERA_FLOOR_MIN_Y;
    }
    if (controls.target.y < 0) {
      controls.target.y = 0;
    }

    // On FPS-mode exit, force OrbitControls to pick up the latest camera pose
    // so it does not snap back to a stale pre-FPS state.
    if (wasFpsLookModeRef.current && !fpsLookMode) {
      state.camera.getWorldDirection(cameraDir.current);
      lookTarget.current
        .copy(state.camera.position)
        .add(cameraDir.current.multiplyScalar(10));
      controls.target.copy(lookTarget.current);
      controls.update();
    }

    if (!fpsLookMode) {
      controls.update();
    }

    wasFpsLookModeRef.current = fpsLookMode;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        enableRotate={false}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.8}
        minDistance={5}
        maxDistance={60}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </>
  );
}
