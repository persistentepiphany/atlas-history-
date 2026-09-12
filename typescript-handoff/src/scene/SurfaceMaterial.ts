import { useMemo } from 'react';
import * as THREE from 'three';
import frag from '../shaders/surface.frag?raw';

const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/** The rest grade of a page on the near black ground. Highlights come from the wash and the focus mask, never from raising this. */
export const PAGE_BRIGHTNESS = 0.92;
export const PAGE_CONTRAST = 1.02;

export interface SurfaceParams {
  rect?: [number, number, number, number]; offset?: [number, number]; zoom?: number;
  brightness?: number; contrast?: number; gray?: number; scan?: number; grain?: number; warm?: number;
  opacity?: number; time?: number; sweep?: number; sweepAmp?: number; mix?: number; cell?: number; fill?: THREE.Color;
}

/** One material for pages, ghosts, the living photograph and the world. Every look is a set of uniforms on it. */
export function createSurfaceMaterial(tex: THREE.Texture | null): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, uniforms: {
    uMap: { value: tex }, uHasMap: { value: tex ? 1 : 0 }, uFill: { value: new THREE.Color(0x5a534b) },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) }, uZoom: { value: 1 },
    uBrightness: { value: PAGE_BRIGHTNESS }, uContrast: { value: PAGE_CONTRAST }, uGray: { value: 0 }, uScan: { value: 0 }, uGrain: { value: 0 }, uWarm: { value: 0 },
    uOpacity: { value: 1 }, uTime: { value: 0 }, uSweep: { value: -1 }, uSweepAmp: { value: 0 }, uMix: { value: 1 }, uCell: { value: 0 },
  } });
}

export function setSurface(m: THREE.ShaderMaterial, p: SurfaceParams) {
  const u = m.uniforms;
  if (p.rect) (u.uRect!.value as THREE.Vector4).set(p.rect[0], 1 - p.rect[1] - p.rect[3], p.rect[2], p.rect[3]);
  if (p.offset) (u.uOffset!.value as THREE.Vector2).set(p.offset[0], -p.offset[1]);
  if (p.zoom != null) u.uZoom!.value = p.zoom;
  if (p.brightness != null) u.uBrightness!.value = p.brightness; if (p.contrast != null) u.uContrast!.value = p.contrast;
  if (p.gray != null) u.uGray!.value = p.gray; if (p.scan != null) u.uScan!.value = p.scan; if (p.grain != null) u.uGrain!.value = p.grain; if (p.warm != null) u.uWarm!.value = p.warm;
  if (p.opacity != null) u.uOpacity!.value = p.opacity; if (p.time != null) u.uTime!.value = p.time;
  if (p.sweep != null) u.uSweep!.value = p.sweep; if (p.sweepAmp != null) u.uSweepAmp!.value = p.sweepAmp;
  if (p.mix != null) u.uMix!.value = p.mix; if (p.cell != null) u.uCell!.value = p.cell;
  if (p.fill) (u.uFill!.value as THREE.Color).copy(p.fill);
}

export function useSurfaceMaterial(tex: THREE.Texture | null) {
  const m = useMemo(() => createSurfaceMaterial(tex), [tex]);
  return m;
}
