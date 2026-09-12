import { useEffect } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { PAGE_BRIGHTNESS, PAGE_CONTRAST, setSurface, useSurfaceMaterial } from './SurfaceMaterial';

export interface PagePlaneProps { src: string; x: number; y: number; w: number; h: number; opacity: number; visible?: boolean; brightness?: number; contrast?: number; gray?: number }

/** A page is a 1 by 1.4 plane scaled to the scenario box. It rests at brightness 0.92 and contrast 1.02 on the near black ground. */
export function PagePlane({ src, x, y, w, h, opacity, visible = true, brightness = PAGE_BRIGHTNESS, contrast = PAGE_CONTRAST, gray = 0 }: PagePlaneProps) {
  const tex = useLoader(THREE.TextureLoader, src);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.needsUpdate = true; }, [tex]);
  const mat = useSurfaceMaterial(tex);
  setSurface(mat, { opacity, brightness, contrast, gray });
  return (
    <mesh position={[x + w / 2, -(y + h / 2), 0]} scale={[w, h / 1.4, 1]} visible={visible && opacity > 0.001} material={mat}>
      <planeGeometry args={[1, 1.4]} />
    </mesh>
  );
}
