import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import type { Surface } from '../data/types';
import { createSurfaceMaterial, setSurface } from './SurfaceMaterial';

const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export interface WorldPlaneProps { video: HTMLVideoElement | null; seedUrl: string | null; mix: number; cell: number; surface: Surface; stopAge: number; stopLength: number; visible: boolean; reducedMotion: boolean }

/** The look of each surface. Television is grayscale with scanlines. Film is warm grain without them. A still pushes from 1.0 to 1.08 across its stop. */
export const SURFACES: Record<Surface, { gray: number; scan: number; brightness: number; grain: number; warm: number; contrast: number }> = {
  tv: { gray: 1, scan: 0.6, brightness: 0.55, grain: 0.08, warm: 0, contrast: 1.35 },
  film: { gray: 0, scan: 0, brightness: 0.7, grain: 0.25, warm: 1.0, contrast: 1.1 },
  still: { gray: 0.9, scan: 0, brightness: 0.6, grain: 0.12, warm: 0.3, contrast: 1.3 },
};

/**
 * A screen filling quad held a little in front of the camera. The dot dissolve runs in screen
 * space with a cell size handed in from the camera distance, so the printed dots open into the picture
 * as one continuous push. With no video the seed still carries the same treatment.
 */
export function WorldPlane({ video, seedUrl, mix, cell, surface, stopAge, stopLength, visible, reducedMotion }: WorldPlaneProps) {
  const { camera, viewport, gl } = useThree(); const mesh = useRef<THREE.Mesh>(null);
  const seedTex = useLoader(THREE.TextureLoader, seedUrl ?? BLANK);
  useEffect(() => { seedTex.colorSpace = THREE.SRGBColorSpace; seedTex.needsUpdate = true; }, [seedTex]);
  const seed = seedUrl ? seedTex : null;
  const videoTex = useMemo(() => (video ? new THREE.VideoTexture(video) : null), [video]);
  useEffect(() => { if (videoTex) videoTex.colorSpace = THREE.SRGBColorSpace; return () => videoTex?.dispose(); }, [videoTex]);
  const tex = videoTex ?? seed;
  const mat = useMemo(() => createSurfaceMaterial(tex), [tex]);
  const look = SURFACES[surface];
  const progress = stopLength > 0 ? Math.min(1, stopAge / stopLength) : 0;
  const push = surface === 'still' || !video ? 1 + (reducedMotion ? 0 : 0.08 * progress) : 1;
  const drift = reducedMotion || !video ? 0 : 0.004;
  setSurface(mat, { ...look, grain: reducedMotion ? 0 : look.grain, opacity: 1, mix, cell: cell * gl.getPixelRatio(), zoom: push, offset: [Math.sin(stopAge * 0.23) * drift, Math.cos(stopAge * 0.19) * drift], time: stopAge, rect: [0.05, 0.05, 0.9, 0.9] });
  useFrame(() => {
    if (!mesh.current) return; const d = 0.05; const v = viewport.getCurrentViewport(camera, new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z - d));
    mesh.current.position.set(camera.position.x, camera.position.y, camera.position.z - d); mesh.current.scale.set(v.width, v.height, 1);
  });
  return (
    <mesh ref={mesh} visible={visible && mix > 0.001} material={mat} renderOrder={10}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
