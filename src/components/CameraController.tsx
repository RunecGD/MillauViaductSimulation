import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const CAMERA_PRESETS: Record<string, { position: [number, number, number]; target: [number, number, number] }> = {
  front:       { position: [0, 4, 20],   target: [0, 1.8, 0] },
  side:        { position: [24, 4, 0],   target: [0, 1.8, 0] },
  top:         { position: [0, 22, 6],   target: [0, 0, 0] },
  close:       { position: [4, 3.8, 5],  target: [4, 2.7, 0] },
  below:       { position: [0, 0.2, 10], target: [0, 2.2, 0] },
  perspective: { position: [14, 7, 14],  target: [0, 1.8, 0] },
};

export default function CameraController({ preset }: { preset: string }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const prev = useRef(preset);

  useEffect(() => {
    if (preset !== prev.current) {
      prev.current = preset;
      const cfg = CAMERA_PRESETS[preset] || CAMERA_PRESETS.perspective;
      const sp = camera.position.clone();
      const ep = new THREE.Vector3(...cfg.position);
      const st = Date.now();
      const dur = 1200;

      const anim = () => {
        const t = Math.min((Date.now() - st) / dur, 1);
        const e = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(sp, ep, e);
        if (controlsRef.current) {
          controlsRef.current.target.lerp(new THREE.Vector3(...cfg.target), e);
          controlsRef.current.update();
        }
        if (t < 1) requestAnimationFrame(anim);
      };
      anim();
    }
  }, [preset, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={2}
      maxDistance={60}
      maxPolarAngle={Math.PI * 0.88}
    />
  );
}
