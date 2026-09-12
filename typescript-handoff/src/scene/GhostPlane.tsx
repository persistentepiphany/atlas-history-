import { useEffect } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { setSurface, useSurfaceMaterial } from './SurfaceMaterial';

export interface GhostPlaneProps { src: string; x: number; y: number; w: number; h: number; opacity: number; scale: number; visible: boolean }

/** A still enters at scale 1.05 and opacity 0, rises to 0.32, and leaves by sinking while the scale continues to 0.98. */
export const GHOST_PEAK = 0.32;
export function GhostPlane({ src, x, y, w, h, opacity, scale, visible }: GhostPlaneProps) {
  const tex = useLoader(THREE.TextureLoader, src);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; }, [tex]);
  const mat = useSurfaceMaterial(tex);
  const o = Math.min(GHOST_PEAK, opacity);
  const sink = Math.max(0, 1 - scale) / 0.02;
  setSurface(mat, { opacity: o, gray: 1, contrast: 0.9, brightness: 0.85 });
  return (
    <mesh position={[x + w / 2, -(y + h / 2) - sink * h * 0.03, 0.0015]} scale={[w * scale, h * scale, 1]} visible={visible && o > 0.001} material={mat}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
