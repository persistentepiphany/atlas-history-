import { useEffect } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { setSurface, useSurfaceMaterial } from './SurfaceMaterial';

export interface PhotoPlaneProps { src: string; x: number; y: number; w: number; h: number; crop: [number, number, number, number]; age: number; visible: boolean; reducedMotion: boolean }

/** The living photograph. While the door is open the crop drifts by 0.4 percent, scanlines rise over six seconds and a slow light sweeps across. */
export function PhotoPlane({ src, x, y, w, h, crop, age, visible, reducedMotion }: PhotoPlaneProps) {
  const tex = useLoader(THREE.TextureLoader, src);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.needsUpdate = true; }, [tex]);
  const mat = useSurfaceMaterial(tex);
  const k = Math.max(0, age); const drift = reducedMotion ? 0 : 0.004;
  setSurface(mat, {
    rect: crop, offset: [Math.sin(k * 0.21) * drift, Math.cos(k * 0.17) * drift], zoom: 1.02 + (reducedMotion ? 0 : 0.03 * Math.sin(k * 0.13)),
    opacity: Math.min(1, k / 2.5), scan: Math.min(0.7, k / 6), time: k, sweep: reducedMotion ? -1 : ((k * 0.09) % 1.6) - 0.3, sweepAmp: 0.08,
  });
  return (
    <mesh position={[x + w / 2, -(y + h / 2), 0.0012]} scale={[w, h, 1]} visible={visible && k > 0} material={mat}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
