uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uFill;
uniform vec4 uRect; uniform vec2 uOffset; uniform float uZoom;
uniform float uBrightness; uniform float uContrast; uniform float uGray; uniform float uScan; uniform float uGrain; uniform float uWarm;
uniform float uOpacity; uniform float uTime; uniform float uSweep; uniform float uSweepAmp;
uniform float uMix; uniform float uCell;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 centre = uRect.xy + uRect.zw * 0.5;
  vec2 uv = centre + (vUv - 0.5) * uRect.zw / uZoom + uOffset * uRect.zw;
  vec3 c = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : uFill;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(lum), uGray);
  c = (c - 0.5) * uContrast + 0.5;
  c *= uBrightness;
  float line = step(1.5, mod(gl_FragCoord.y + uTime * 18.0, 3.0));
  c *= 1.0 - uScan * 0.35 * line;
  float g = hash(floor(gl_FragCoord.xy * 0.5) + vec2(fract(uTime) * 97.0)) - 0.5;
  c += g * uGrain * 0.5;
  c = mix(c, c * vec3(1.0, 0.86, 0.68), uWarm * 0.55);
  float sweep = exp(-pow((vUv.x - uSweep) * 7.0, 2.0)) * uSweepAmp;
  c += sweep;
  float a = uOpacity;
  if (uCell > 0.0) {
    vec2 cell = fract(gl_FragCoord.xy / uCell) - 0.5;
    float d = length(cell) * 2.0;
    float radius = uMix * 1.7;
    a *= 1.0 - smoothstep(radius - 0.12, radius, d);
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), a);
}
