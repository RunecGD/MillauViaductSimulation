import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ─── helpers ─────────────────────────────────── */
function terrainH(x: number, z: number): number {
  const d = Math.abs(z);
  let h = d < 200 ? -180 * (1 - (d / 200) ** 2) : Math.min((d - 200) * 0.05, 30);
  h += Math.sin(x * .01) * Math.cos(z * .01) * 12;
  h += Math.sin(x * .03 + 1) * Math.cos(z * .02 + 2) * 6;
  h += Math.sin(x * .005) * Math.cos(z * .007) * 15;
  return h;
}
const HL = 600;
function deckYAt(x: number, deckBase: number) { const t = x / HL; return deckBase + (-t * t * 8 + 8); }

/* ─── structure config ────────────────────────── */
export interface StructureConfig {
  pylonHeight: number;
  deckHeight: number;
  cableCount: number;
  pierCount: number;
  deckWidth: number;
  showCables: boolean;
  showPylons: boolean;
}

export const DEFAULT_STRUCTURE: StructureConfig = {
  pylonHeight: 87,
  deckHeight: 170,
  cableCount: 11,
  pierCount: 7,
  deckWidth: 32,
  showCables: true,
  showPylons: true,
};

/* ─── types ───────────────────────────────────── */
interface Vehicle {
  root: THREE.Group;
  mesh: THREE.Group;
  x: number;
  speed: number;
  lane: number;
  dir: 1 | -1;
  isTruck: boolean;
  spotL: THREE.SpotLight | null;
  spotR: THREE.SpotLight | null;
  tailPL: THREE.PointLight | null;
  spotTargetL: THREE.Object3D | null;
  spotTargetR: THREE.Object3D | null;
}

interface Engine {
  scene: THREE.Scene;
  vehicles: Vehicle[];
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  nightObjs: THREE.Object3D[];
  skyDay: THREE.CanvasTexture;
  skyNight: THREE.CanvasTexture;
  renderer: THREE.WebGLRenderer;
  night: boolean;
  clock: THREE.Clock;
  maxSpotVehicles: number;
  bridgeGroup: THREE.Group;
  config: StructureConfig;
  stressMode: boolean;
  vehicleCount: number;
}

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  nightMode: boolean;
  vehicleCount: number;
  structure: StructureConfig;
  showStress: boolean;
  cameraPreset: string;
}

export default function MillauViaduct({ containerRef, nightMode, vehicleCount, structure, showStress, cameraPreset }: Props) {
  const frame = useRef(0);
  const eng = useRef<Engine | null>(null);
  const camCtrl = useRef<{ th: number; ph: number; dist: number; uc: () => void } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const clock = new THREE.Clock();
    const skyDay = makeSky('day');
    const skyNight = makeSky('night');
    scene.background = skyDay;
    scene.fog = new THREE.FogExp2(0x9ec0d8, 0.00012);

    const cam = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8090b0, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
    sun.position.set(300, 400, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 2000;
    sun.shadow.camera.left = -800; sun.shadow.camera.right = 800;
    sun.shadow.camera.top = 400; sun.shadow.camera.bottom = -200;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6688bb, 0.4);
    fill.position.set(-200, 100, -100);
    scene.add(fill);
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.5);
    scene.add(hemi);

    buildTerrain(scene);
    buildRiver(scene);

    const bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);

    const cfg = { ...DEFAULT_STRUCTURE };
    buildBridge(bridgeGroup, cfg);
    const nightObjs = buildNightLighting(scene, cfg);

    const engine: Engine = {
      scene, vehicles: [],
      ambient, sun, fill, hemi,
      nightObjs, skyDay, skyNight,
      renderer, night: false, clock,
      maxSpotVehicles: 8,
      bridgeGroup, config: cfg,
      stressMode: false, vehicleCount: 24,
    };
    eng.current = engine;

    let drag = false, pm = { x: 0, y: 0 };
    const cc = { th: 0.55, ph: 0.35, dist: 750, uc: () => {} };
    const tgt = new THREE.Vector3(0, 80, 0);
    cc.uc = () => {
      cam.position.set(
        tgt.x + cc.dist * Math.sin(cc.th) * Math.cos(cc.ph),
        tgt.y + cc.dist * Math.sin(cc.ph),
        tgt.z + cc.dist * Math.cos(cc.th) * Math.cos(cc.ph));
      cam.lookAt(tgt);
    };
    camCtrl.current = cc;
    cc.uc();

    const md = (e: MouseEvent) => { drag = true; pm = { x: e.clientX, y: e.clientY }; };
    const mm = (e: MouseEvent) => { if (!drag) return; cc.th -= (e.clientX - pm.x) * .005; cc.ph = Math.max(.05, Math.min(1.52, cc.ph + (e.clientY - pm.y) * .005)); pm = { x: e.clientX, y: e.clientY }; cc.uc(); };
    const mu = () => { drag = false; };
    const mw = (e: WheelEvent) => { cc.dist = Math.max(200, Math.min(2000, cc.dist + e.deltaY * .5)); cc.uc(); };
    const ts2 = (e: TouchEvent) => { if (e.touches.length === 1) { drag = true; pm = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } };
    const tmv = (e: TouchEvent) => { if (!drag || e.touches.length !== 1) return; cc.th -= (e.touches[0].clientX - pm.x) * .005; cc.ph = Math.max(.05, Math.min(1.52, cc.ph + (e.touches[0].clientY - pm.y) * .005)); pm = { x: e.touches[0].clientX, y: e.touches[0].clientY }; cc.uc(); };
    const te2 = () => { drag = false; };

    el.addEventListener('mousedown', md); el.addEventListener('mousemove', mm);
    el.addEventListener('mouseup', mu); el.addEventListener('mouseleave', mu);
    el.addEventListener('wheel', mw);
    el.addEventListener('touchstart', ts2); el.addEventListener('touchmove', tmv);
    el.addEventListener('touchend', te2);

    const animate = () => {
      frame.current = requestAnimationFrame(animate);
      const e2 = eng.current;
      if (e2) {
        tickVehicles(e2);
        tickDeformations(e2);
        if (e2.night) tickBeacons(e2);
      }
      renderer.render(scene, cam);
    };
    animate();

    const onR = () => { cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); };
    window.addEventListener('resize', onR);

    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener('resize', onR);
      el.removeEventListener('mousedown', md); el.removeEventListener('mousemove', mm);
      el.removeEventListener('mouseup', mu); el.removeEventListener('mouseleave', mu);
      el.removeEventListener('wheel', mw);
      el.removeEventListener('touchstart', ts2); el.removeEventListener('touchmove', tmv);
      el.removeEventListener('touchend', te2);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      eng.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // night
  useEffect(() => { const e = eng.current; if (!e) return; nightMode && !e.night ? goNight(e) : !nightMode && e.night ? goDay(e) : 0; }, [nightMode]);
  // vehicles
  useEffect(() => { const e = eng.current; if (e) { syncCount(e, vehicleCount); e.vehicleCount = vehicleCount; } }, [vehicleCount]);
  // structure
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    const c = e.config;
    if (c.pylonHeight === structure.pylonHeight &&
        c.deckHeight === structure.deckHeight &&
        c.cableCount === structure.cableCount &&
        c.pierCount === structure.pierCount &&
        c.deckWidth === structure.deckWidth &&
        c.showCables === structure.showCables &&
        c.showPylons === structure.showPylons) return;

    Object.assign(e.config, structure);
    // Clean up any fallen parts from previous collapse
    for (const f of fallenParts) {
      if (f.obj.parent === e.scene) e.scene.remove(f.obj);
    }
    fallenParts = [];
    collapseActive = false;
    collapseFrame = 0;
    disposeGroup(e.bridgeGroup);
    e.nightObjs.forEach(o => {
      e.scene.remove(o);
      if (o instanceof THREE.SpotLight) { if (o.target) e.scene.remove(o.target); o.dispose(); }
      if (o instanceof THREE.PointLight) o.dispose();
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material; if (Array.isArray(m)) m.forEach(mm => mm.dispose()); else if (m instanceof THREE.Material) m.dispose(); }
    });
    buildBridge(e.bridgeGroup, e.config);
    e.nightObjs = buildNightLighting(e.scene, e.config);
    if (e.night) e.nightObjs.forEach(o => { o.visible = true; });
    if (e.stressMode) applyStressMap(e);
    e.vehicles.forEach(v => {
      const y = deckYAt(v.x, e.config.deckHeight) + 2.8;
      v.root.position.y = y;
      posLights(v, e.config.deckHeight);
    });
  }, [structure]);

  // stress map
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    if (showStress && !e.stressMode) {
      e.stressMode = true;
      applyStressMap(e);
    } else if (!showStress && e.stressMode) {
      e.stressMode = false;
      removeStressMap(e);
    }
  }, [showStress]);

  // camera preset
  useEffect(() => {
    const c = camCtrl.current;
    if (!c || cameraPreset === 'free') return;
    const presets: Record<string, [number, number, number]> = {
      front: [0, 0.2, 800],
      side: [Math.PI / 2, 0.15, 800],
      top: [0, 1.5, 900],
      close: [0.3, 0.15, 300],
      below: [0.2, -0.1, 500],
      perspective: [0.55, 0.35, 750],
    };
    const p = presets[cameraPreset];
    if (p) { c.th = p[0]; c.ph = p[1]; c.dist = p[2]; c.uc(); }
  }, [cameraPreset]);

  return null;
}

/* ═══════════════════════════════════════════════
   STRESS MAP — physically-based stress model
   ═══════════════════════════════════════════════

   Stress physics:
   - Deck: bending moment is MAXIMUM at mid-span between piers (parabolic).
           Near piers → shear stress peaks but bending drops. We combine both.
           Wider deck → heavier self-weight → more bending.
           Without cables → deck carries everything → extreme stress.
   - Piers: axial compression from deck weight above. Taller pier → buckling risk.
           Base of pier → maximum compressive stress (supports everything above).
           Top of pier → lower stress (only local load transfer).
           Fewer piers → each carries more dead load.
   - Pylons: they carry cable tension forces. Base → max stress (cantilever bending).
            Taller pylon → more self-weight + wind moment.
            Top → tension from cables, moderate stress.
   - Cables: tension = deck_weight_per_cable / sin(angle).
            Steeper angle (tall pylon) → less tension → less stress.
            Fewer cables → each one carries more.
            Outer cables (shallow angle) → more tension than inner ones.
*/

function stressToColor(t: number): THREE.Color {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const s = t * 2;
    return new THREE.Color(s, 1, 0);        // green → yellow
  }
  const s = (t - 0.5) * 2;
  return new THREE.Color(1, 1 - s, 0);      // yellow → red
}

/* global penalty for missing structural systems */
function globalPenalty(cfg: StructureConfig): number {
  let p = 0;
  if (!cfg.showPylons) p += 0.55;                           // no cable-stay at all
  if (cfg.showPylons && !cfg.showCables) p += 0.45;         // pylons without cables
  if (cfg.pierCount <= 3) p += 0.25;                        // extreme span
  if (cfg.cableCount < 5 && cfg.showCables) p += 0.15;
  return p;
}

function computeDeckStressAtX(worldX: number, cfg: StructureConfig): number {
  const d = DEFAULT_STRUCTURE;
  const piers = getPierPositions(cfg.pierCount);

  // Find which span this X falls in + distance to nearest support
  const sortedPiers = [...piers].sort((a, b) => a - b);
  const supports = [-HL, ...sortedPiers, HL];

  // Find the span this point is in
  let spanLen = 0;
  let distInSpan = 0;
  for (let i = 0; i < supports.length - 1; i++) {
    const a = supports[i], b = supports[i + 1];
    if (worldX >= a && worldX <= b) {
      spanLen = b - a;
      const mid = (a + b) / 2;
      distInSpan = Math.abs(worldX - mid); // 0 at mid-span, spanLen/2 at support
      break;
    }
  }
  if (spanLen === 0) spanLen = 200; // fallback

  // Bending moment is parabolic: max at mid-span, 0 at supports
  // normalized: 0 at support, 1 at mid-span
  const midSpanRatio = 1 - (distInSpan / (spanLen / 2));
  const bendingStress = midSpanRatio * midSpanRatio;

  // Longer spans → more bending moment (∝ span²)
  const defaultSpan = 1200 / (d.pierCount + 1);
  const spanRatio = spanLen / defaultSpan;
  const spanAmplifier = spanRatio * spanRatio; // quadratic: double span = 4x moment

  // Weight factor
  const weightFactor = cfg.deckWidth / d.deckWidth;

  // Cable relief — only effective near cable attachment (near piers with pylons)
  let cableRelief = 0;
  if (cfg.showPylons && cfg.showCables) {
    const reliefBase = Math.min(cfg.cableCount / d.cableCount, 1.5) *
                       Math.min(cfg.pylonHeight / d.pylonHeight, 1.3);
    // cables help more near piers, less at mid-span
    cableRelief = reliefBase * 0.35 * (1 - midSpanRatio * 0.5);
  }

  const raw = bendingStress * spanAmplifier * weightFactor * 0.65 - cableRelief + 0.08;
  return Math.max(0, Math.min(1, raw + globalPenalty(cfg)));
}

function computePierStress(pierHeight: number, cfg: StructureConfig): number {
  const d = DEFAULT_STRUCTURE;

  // Buckling risk ∝ (H/H_max)² — Euler column formula
  const hNorm = pierHeight / 350; // 350 = theoretical max pier
  const bucklingRisk = hNorm * hNorm;

  // Each pier carries deck weight / nPiers → fewer piers = more per pier
  const loadShare = d.pierCount / cfg.pierCount;

  // Wider/heavier deck
  const weightFactor = cfg.deckWidth / d.deckWidth;

  // Higher deck means taller pier = more compression at base
  const heightBonus = Math.max(0, (cfg.deckHeight - 120) / 150);

  const raw = bucklingRisk * 0.5 + (loadShare - 1) * 0.35 + (weightFactor - 1) * 0.2 + heightBonus * 0.2 + 0.1;
  return Math.max(0, Math.min(1, raw + globalPenalty(cfg) * 0.4));
}

function computePylonStress(localY: number, cfg: StructureConfig): number {
  const d = DEFAULT_STRUCTURE;
  // localY: 0 = base (max stress), 1 = top (less stress)

  // Vertical distribution: base carries everything above
  const verticalGrad = (1 - localY);

  // Taller pylon → more bending from wind, heavier self weight
  const hRatio = cfg.pylonHeight / d.pylonHeight;
  const heightStress = hRatio * hRatio; // quadratic — wind moment ∝ H²

  // Cable count affects force on pylon: more cables = more total pull
  // but spread better; fewer cables = less total but each bigger
  const cableStress = cfg.showCables ? Math.max(cfg.cableCount / d.cableCount, 0.5) : 0.2;

  // Wider deck → heavier → more force through cables to pylon
  const weightFactor = cfg.deckWidth / d.deckWidth;

  const raw = verticalGrad * heightStress * 0.55 + cableStress * weightFactor * 0.25 + 0.08;
  return Math.max(0, Math.min(1, raw + globalPenalty(cfg) * 0.3));
}

function computeCableStress(cableLength: number, cfg: StructureConfig): number {
  const d = DEFAULT_STRUCTURE;

  // T = W / (n * sin θ), where θ = atan(pylonH / horizDist)
  // longer cable → bigger horizDist → smaller θ → much bigger T

  // Estimate horizontal distance from cable length and pylon height
  const horizDist = Math.sqrt(Math.max(0, cableLength * cableLength - cfg.pylonHeight * cfg.pylonHeight));
  const angle = Math.atan2(cfg.pylonHeight, Math.max(horizDist, 1));
  const sinAngle = Math.sin(angle);

  // Tension ∝ 1/sin(angle) — normalized vs default config shortest cable
  const defaultAngle = Math.atan2(d.pylonHeight, 15); // shortest cable
  const defaultSin = Math.sin(defaultAngle);
  const tensionRatio = (defaultSin / Math.max(sinAngle, 0.05));

  // Fewer cables → each one carries more
  const loadShare = d.cableCount / Math.max(cfg.cableCount, 1);

  // Wider deck → more weight per cable
  const weightFactor = cfg.deckWidth / d.deckWidth;

  // Combine: baseline at default config shortest cable ≈ 0.15
  const raw = (tensionRatio * loadShare * weightFactor - 1) * 0.45 + 0.15;
  return Math.max(0, Math.min(1, raw + globalPenalty(cfg) * 0.4));
}

/* ── Apply vertex colors on deck, uniform color on others ── */
function applyStressMap(e: Engine) {
  e.bridgeGroup.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const type: string = child.userData.stressType;
    if (!type) return;
    const mat = child.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    // Save originals once
    if (child.userData.origColor === undefined) {
      child.userData.origColor = mat.color.getHex();
      child.userData.origEmissive = mat.emissive.getHex();
      child.userData.origEmissiveIntensity = mat.emissiveIntensity;
      child.userData.origVertexColors = mat.vertexColors;
    }

    if (type === 'deck') {
      // Per-vertex stress coloring for smooth gradient along bridge
      const geo = child.geometry;
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);

      // Need world transform to get actual X of each vertex
      child.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();

      for (let i = 0; i < pos.count; i++) {
        worldPos.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        worldPos.applyMatrix4(child.matrixWorld);

        const stress = computeDeckStressAtX(worldPos.x, e.config);
        const col = stressToColor(stress);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      mat.vertexColors = true;
      mat.color.set(0xffffff); // vertex colors replace base color
      mat.emissive.set(0x333333);
      mat.emissiveIntensity = 0.4;
      mat.needsUpdate = true;

    } else {
      // Uniform stress per element
      let stress = 0.3;
      switch (type) {
        case 'pier':
          stress = computePierStress(child.userData.pierHeight || 100, e.config);
          break;
        case 'pylon':
          stress = computePylonStress(child.userData.localY ?? 0.5, e.config);
          break;
        case 'cable':
          stress = computeCableStress(child.userData.cableLength || 50, e.config);
          break;
      }

      const col = stressToColor(stress);
      mat.color.copy(col);
      mat.emissive.copy(col);
      mat.emissiveIntensity = 0.2 + stress * 0.4;
      mat.needsUpdate = true;
    }
  });
}

function removeStressMap(e: Engine) {
  e.bridgeGroup.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const mat = child.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;
    if (child.userData.origColor === undefined) return;

    mat.color.setHex(child.userData.origColor);
    mat.emissive.setHex(child.userData.origEmissive);
    mat.emissiveIntensity = child.userData.origEmissiveIntensity;
    mat.vertexColors = child.userData.origVertexColors;
    mat.needsUpdate = true;

    // Remove vertex color attribute if we added it
    if (child.userData.stressType === 'deck' && child.geometry.attributes.color) {
      child.geometry.deleteAttribute('color');
    }
  });
}

/* ═══════════════════════════════════════════════════════
   STRUCTURAL MECHANICS ENGINE
   ═══════════════════════════════════════════════════════
   Real engineering formulas:

   1. BEAM DEFLECTION (Euler-Bernoulli):
      δ = (5 × q × L⁴) / (384 × E × I)
      We normalise E×I as "stiffness" that cables provide.
      Without cables, stiffness drops → δ explodes.

   2. CABLE TENSION:
      T = W_span / (2n × sinθ), θ = atan(H_pylon / L_span/2)
      If T > T_yield  →  cable snaps.

   3. EULER BUCKLING (piers):
      P_cr = π²EI / (KL)²
      Taller pier → lower P_cr → buckling.

   4. OVERTURNING (pylons):
      Wind moment M_wind = ½ρv²·A·H/2
      If M_wind > M_restoring → pylon topples.

   All values are normalised to the real Millau defaults = safety factor 1.0.
   We compute per-element "demand/capacity" ratios.
   Ratio < 1 → safe.  1..1.5 → visible distress.  >1.5 → failure.
   ═══════════════════════════════════════════════════════ */

// --- Per-span bending analysis ---
interface SpanAnalysis { a: number; b: number; L: number; midX: number; maxDeflection: number; failed: boolean; }

export function analyzeSpans(cfg: StructureConfig, numVehicles: number = 24): SpanAnalysis[] {
  const piers = getPierPositions(cfg.pierCount);
  const supports = [-HL, ...piers.sort((a, b) => a - b), HL];
  const spans: SpanAnalysis[] = [];

  // EI proxy: cables add stiffness
  let stiffness = 1.0;
  if (cfg.showPylons && cfg.showCables) {
    const angle = Math.atan2(cfg.pylonHeight, 70);
    stiffness += cfg.cableCount * Math.sin(angle) * Math.sin(angle) * 0.4;
  }

  // Total load = deck self-weight + vehicle load
  // Deck weight ∝ width. Vehicle load ∝ numVehicles (24 = baseline)
  const deckWeight = cfg.deckWidth / DEFAULT_STRUCTURE.deckWidth;
  const trafficLoad = 1 + (numVehicles / 24) * 0.3; // 24 cars = +30% load, 80 cars = +100%
  const qRatio = deckWeight * trafficLoad;

  for (let i = 0; i < supports.length - 1; i++) {
    const a = supports[i], b = supports[i + 1];
    const L = b - a;
    const Ldef = 1200 / (DEFAULT_STRUCTURE.pierCount + 1);
    const deflRatio = (qRatio * Math.pow(L / Ldef, 4)) / stiffness;
    const maxDeflection = deflRatio * 2.5;
    const failed = maxDeflection > L * 0.15;
    spans.push({ a, b, L, midX: (a + b) / 2, maxDeflection, failed });
  }
  return spans;
}

// --- Stability score for UI (0-100) ---
export function computeStability(cfg: StructureConfig, numVehicles: number = 24): number {
  const spans = analyzeSpans(cfg, numVehicles);
  const cR = cableTensionRatio(cfg, numVehicles);
  const d = DEFAULT_STRUCTURE;
  const pierLoad = (cfg.deckWidth / d.deckWidth) * (d.pierCount / cfg.pierCount);

  let score = 100;

  // Span deflection penalty
  const maxDefl = Math.max(...spans.map(s => s.maxDeflection));
  const maxL = Math.max(...spans.map(s => s.L));
  const deflLimit = maxL * 0.15;
  if (maxDefl > 0) score -= Math.min(40, (maxDefl / deflLimit) * 40);

  // Cable tension penalty
  if (cR > 999) score -= 35; // no cables
  else if (cR > 1) score -= Math.min(30, (cR - 1) * 20);

  // Pier overload penalty
  if (pierLoad > 1) score -= Math.min(20, (pierLoad - 1) * 15);

  // No pylons / no cables
  if (!cfg.showPylons) score -= 25;
  if (cfg.showPylons && !cfg.showCables) score -= 20;

  return Math.max(0, Math.round(score));
}

// --- Cable tension analysis ---
export function cableTensionRatio(cfg: StructureConfig, numVehicles: number = 24): number {
  if (!cfg.showPylons || !cfg.showCables) return 999;
  const d = DEFAULT_STRUCTURE;
  const angle = Math.atan2(cfg.pylonHeight, 70);
  const sinA = Math.sin(angle);
  const defAngle = Math.atan2(d.pylonHeight, 70);
  const defSinA = Math.sin(defAngle);
  // Load = deck weight + traffic
  const totalLoad = (cfg.deckWidth / d.deckWidth) * (1 + (numVehicles / 24) * 0.3);
  const tensionRatio = (totalLoad / (cfg.cableCount * sinA)) / (1.0 / (d.cableCount * defSinA));
  return tensionRatio;
}

// --- Pier buckling analysis ---
// Each pier is designed FOR its own height. Buckling only if load exceeds design.
// At default config every pier has ratio ≈ 1.0 (safe).
// Overload comes from fewer piers (more load each) or wider deck.
function pierBucklingRatio(_pierHeight: number, cfg: StructureConfig): number {
  const d = DEFAULT_STRUCTURE;
  // Load per pier: total weight / nPiers.  At default = 1.0
  const loadPerPier = (cfg.deckWidth / d.deckWidth) * (d.pierCount / cfg.pierCount);
  // Design capacity is always 1.0 at default — pier was designed for its height.
  // Only overload matters, height is already accounted for in design.
  return loadPerPier; // >1 = overloaded, >2 = critical
}

// Deck deflection at localX for vehicles
function getDeckDeflection(localX: number, spans: SpanAnalysis[]): number {
  for (const sp of spans) {
    if (localX >= sp.a && localX <= sp.b) {
      const mid = (sp.a + sp.b) / 2;
      const halfL = sp.L / 2;
      const distFromMid = Math.abs(localX - mid);
      // Parabolic: max at center, zero at supports
      const t = 1 - distFromMid / halfL;
      return t * t * Math.min(sp.maxDeflection, 80);
    }
  }
  return 0;
}

interface FallenPart { obj: THREE.Object3D; vy: number; vx: number; vz: number; rz: number; rx: number; groundY: number; done: boolean; }
let fallenParts: FallenPart[] = [];
let collapseFrame = 0; // tracks how many frames since collapse started
let collapseActive = false;

function tickDeformations(e: Engine) {
  const cfg = e.config;
  const nv = e.vehicleCount;
  const t = e.clock.getElapsedTime();

  const spans = analyzeSpans(cfg, nv);
  const cableRatio = cableTensionRatio(cfg, nv);
  const anySpanFailed = spans.some(sp => sp.failed);
  const cablesOverloaded = cableRatio > 1.5;
  const cablesSnapped = cableRatio > 2.5;
  const noCableSupport = !cfg.showPylons || !cfg.showCables;

  // Collapse = deck fails OR cables snap OR no structural support with excessive load
  const fullCollapse = anySpanFailed || cablesSnapped || (noCableSupport && spans.some(sp => sp.maxDeflection > 20));

  // ── 1. Deck deformation — per-vertex ──
  if (!fullCollapse) {
    e.bridgeGroup.traverse(ch => {
      if (!(ch instanceof THREE.Mesh) || ch.userData.stressType !== 'deck') return;
      const geo = ch.geometry;
      const pos = geo.attributes.position;
      if (!ch.userData._origPos) {
        ch.userData._origPos = new Float32Array(pos.array.length);
        (ch.userData._origPos as Float32Array).set(pos.array as Float32Array);
      }
      const orig = ch.userData._origPos as Float32Array;

      for (let i = 0; i < pos.count; i++) {
        const ox = orig[i * 3], oy = orig[i * 3 + 1];
        const defl = getDeckDeflection(ox, spans);
        pos.setY(i, oy - defl);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    });
  }

  // ── 2. Cable visual stress ──
  if (!fullCollapse) {
    e.bridgeGroup.children.forEach(ch => {
      if (!(ch instanceof THREE.Mesh) || ch.userData.stressType !== 'cable') return;
      if (!(ch.material instanceof THREE.MeshStandardMaterial)) return;
      if (cablesOverloaded) {
        const flicker = 0.5 + 0.5 * Math.sin(t * 10 + ch.position.x * 0.1);
        ch.material.color.setRGB(1, 0.2 * flicker, 0);
        ch.material.emissive.setRGB(0.6, 0, 0);
        ch.material.emissiveIntensity = 0.4;
      } else {
        // reset to normal cable color
        ch.material.color.setHex(0xe0e0e0);
        ch.material.emissive.setHex(0x000000);
        ch.material.emissiveIntensity = 0;
      }
    });
  }

  // ── 3. Pylon lean — only when significantly overloaded ──
  e.bridgeGroup.children.forEach(ch => {
    if (!(ch instanceof THREE.Group) || ch.userData.partType !== 'pylon') return;
    if (ch.userData._fallen) return;

    // At default config: zero lean, zero sway
    let lean = 0;

    // Only lean if pylons are >20% taller than default (wind moment ∝ H²)
    const hRatio = cfg.pylonHeight / DEFAULT_STRUCTURE.pylonHeight;
    if (hRatio > 1.2) lean = (hRatio - 1.2) * 0.05;

    // If no cable support — gravity pulls pylon, no restoring tension
    if (noCableSupport && fullCollapse) lean += 0.08;

    if (lean > 0.001) {
      const dir = ch.position.x > 0 ? 1 : -1;
      const sway = Math.sin(t * 0.3 + ch.position.x * 0.006) * lean * 0.2;
      ch.rotation.z = dir * lean + sway;
    } else {
      ch.rotation.z = 0;
    }
  });

  // ── 4. Pier vibration — only when load > 2× design capacity ──
  e.bridgeGroup.children.forEach(ch => {
    if (!(ch instanceof THREE.Group) || ch.userData.partType !== 'pier') return;
    if (ch.userData._fallen) return;
    let pH = 100;
    ch.traverse(m => { if (m instanceof THREE.Mesh && m.userData.pierHeight) pH = m.userData.pierHeight; });
    const bRatio = pierBucklingRatio(pH, cfg);
    // Only vibrate when seriously overloaded: ratio > 2.0 (double design load)
    if (bRatio > 2.0) {
      const intensity = Math.min((bRatio - 2.0) * 0.015, 0.04);
      ch.rotation.z = Math.sin(t * 1.5 + ch.position.x * 0.03) * intensity;
      ch.rotation.x = Math.sin(t * 1.1 + ch.position.x * 0.04) * intensity * 0.3;
    } else {
      ch.rotation.z = 0; ch.rotation.x = 0;
    }
  });

  // ── 5. COLLAPSE ──
  if (fullCollapse) {
    if (!collapseActive) { collapseActive = true; collapseFrame = 0; }
    collapseFrame++;
    const F = collapseFrame;

    // Remove vehicles
    while (e.vehicles.length > 0) removeVehicle(e);

    // Collect remaining parts each frame (safe against mutation)
    const collect = (type: string) => {
      const r: THREE.Object3D[] = [];
      [...e.bridgeGroup.children].forEach(ch => {
        if (ch instanceof THREE.Mesh && ch.userData.stressType === type) r.push(ch);
        if (ch instanceof THREE.Group && ch.userData.partType === type && !ch.userData._fallen) r.push(ch);
      });
      return r;
    };

    const detach = (obj: THREE.Object3D, vy: number, vx: number, vz: number, rz: number, rx: number, gY: number) => {
      if (obj instanceof THREE.Group) obj.userData._fallen = true;
      const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
      obj.removeFromParent(); e.scene.add(obj); obj.position.copy(wp);
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.color.set(0x555555); obj.material.emissive.set(0x000000); obj.material.emissiveIntensity = 0;
      }
      fallenParts.push({ obj, vy, vx, vz, rz, rx, groundY: gY, done: false });
    };

    // Phase 1 (F=1+): snap cables, 3 per frame
    const cables = collect('cable');
    if (cables.length > 0 && F <= 200) {
      for (let i = 0; i < Math.min(3, cables.length); i++) {
        const c2 = cables[i];
        const wp = new THREE.Vector3(); c2.getWorldPosition(wp);
        detach(c2,
          0.2 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          terrainH(wp.x, wp.z) - 5
        );
      }
    }

    // Phase 2 (F=60+): deck falls
    if (F >= 60) {
      const decks = collect('deck');
      decks.forEach(d2 => {
        const wp = new THREE.Vector3(); d2.getWorldPosition(wp);
        detach(d2, -0.5, 0, 0,
          (Math.random() - 0.5) * 0.004,
          (Math.random() - 0.5) * 0.003,
          -175);
      });
    }

    // Phase 3 (F=90+): pylons topple, 1 every 6 frames
    if (F >= 90) {
      const pyls = collect('pylon');
      if (pyls.length > 0 && (F - 90) % 6 === 0) {
        const pg = pyls[0];
        const wp = new THREE.Vector3(); pg.getWorldPosition(wp);
        const dir = wp.x > 0 ? 1 : -1;
        detach(pg, 0.1, dir * 0.4, (Math.random() - 0.5) * 0.2, dir * 0.015, 0, terrainH(wp.x, 0) - 20);
      }
    }

    // Phase 4 (F=140+): piers crumble, 1 every 10 frames
    if (F >= 140) {
      const prs = collect('pier');
      if (prs.length > 0 && (F - 140) % 10 === 0) {
        const pg = prs[0];
        detach(pg, 0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.009, (Math.random() - 0.5) * 0.005, pg.position.y - 15);
      }
    }
  } else {
    if (collapseActive) collapseActive = false;
    collapseFrame = 0;
  }

  // ── 7. Physics for fallen debris ──
  for (const f of fallenParts) {
    if (f.done) continue;
    f.vy -= 0.14; // gravity
    f.obj.position.x += f.vx;
    f.obj.position.y += f.vy;
    f.obj.position.z += f.vz;
    f.obj.rotation.z += f.rz;
    f.obj.rotation.x += f.rx;
    if (f.obj.position.y <= f.groundY) {
      f.obj.position.y = f.groundY;
      f.vy = -f.vy * 0.1;
      f.vx *= 0.3; f.vz *= 0.3;
      f.rz *= 0.15; f.rx *= 0.15;
      if (Math.abs(f.vy) < 0.03) { f.done = true; f.vy = 0; f.vx = 0; f.vz = 0; f.rz = 0; f.rx = 0; }
    }
  }
}

/* ═══════════════════════════════════════════════ */

function disposeGroup(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Group) disposeGroup(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const m = child.material;
      if (Array.isArray(m)) m.forEach(mm => mm.dispose());
      else if (m instanceof THREE.Material) m.dispose();
    }
  }
}

function getPierPositions(count: number): number[] {
  const positions: number[] = [];
  const span = HL * 2 - 200;
  for (let i = 0; i < count; i++) positions.push(-HL + 100 + (span * i) / (count - 1 || 1));
  return positions;
}

function buildBridge(group: THREE.Group, cfg: StructureConfig) {
  const cMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d8, roughness: 0.8, metalness: 0.05 });
  const cDMat = new THREE.MeshStandardMaterial({ color: 0xd0c8c0, roughness: 0.85, metalness: 0.05 });
  const sMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.3, metalness: 0.7 });
  const cbMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.4, metalness: 0.6 });
  const rMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
  const bMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.5, metalness: 0.3 });

  const piers = getPierPositions(cfg.pierCount);
  piers.forEach(px => {
    const dy = deckYAt(px, cfg.deckHeight);
    const gy = terrainH(px, 0);
    const pg = mkPier(group, px, gy, dy - gy, cMat, cDMat);
    pg.userData.partType = 'pier';
  });
  const dg = mkDeck(group, sMat, rMat, bMat, cfg.deckHeight, cfg.deckWidth);
  dg.userData.partType = 'deck';
  if (cfg.showPylons) {
    piers.forEach(px => {
      const dy = deckYAt(px, cfg.deckHeight);
      const pyg = mkPylon(group, px, dy, cfg.pylonHeight, cMat);
      pyg.userData.partType = 'pylon';
    });
  }
  if (cfg.showCables && cfg.showPylons) {
    piers.forEach(px => {
      const dy = deckYAt(px, cfg.deckHeight);
      mkCables(group, px, dy, cfg.pylonHeight, cbMat, cfg.cableCount, cfg.deckHeight, cfg.deckWidth);
    });
  }
}

/* ═══════════════════════════════════════════════
   NIGHT / DAY
   ═══════════════════════════════════════════════ */
function goNight(e: Engine) {
  e.night = true;
  e.scene.background = e.skyNight;
  e.scene.fog = new THREE.FogExp2(0x020408, 0.00005);
  e.ambient.color.set(0x050810); e.ambient.intensity = 0.06;
  e.sun.color.set(0x223355); e.sun.intensity = 0.05;
  e.fill.intensity = 0;
  e.hemi.color.set(0x060a14); e.hemi.groundColor.set(0x020304); e.hemi.intensity = 0.04;
  e.renderer.toneMappingExposure = 1.0;
  e.nightObjs.forEach(o => { o.visible = true; });
  e.vehicles.forEach(v => toggleVehicleNight(v, true));
}

function goDay(e: Engine) {
  e.night = false;
  e.scene.background = e.skyDay;
  e.scene.fog = new THREE.FogExp2(0x9ec0d8, 0.00012);
  e.ambient.color.set(0x8090b0); e.ambient.intensity = 0.6;
  e.sun.color.set(0xffeedd); e.sun.intensity = 1.8;
  e.fill.color.set(0x6688bb); e.fill.intensity = 0.4;
  e.hemi.color.set(0x87ceeb); e.hemi.groundColor.set(0x556b2f); e.hemi.intensity = 0.5;
  e.renderer.toneMappingExposure = 1.2;
  e.nightObjs.forEach(o => { o.visible = false; });
  e.vehicles.forEach(v => toggleVehicleNight(v, false));
}

function toggleVehicleNight(v: Vehicle, night: boolean) {
  if (v.spotL) v.spotL.visible = night;
  if (v.spotR) v.spotR.visible = night;
  if (v.tailPL) v.tailPL.visible = night;
  v.mesh.traverse(ch => {
    if (!(ch instanceof THREE.Mesh) || !(ch.material instanceof THREE.MeshStandardMaterial)) return;
    if (ch.material.userData.isHL) ch.material.emissiveIntensity = night ? 20 : 0.5;
    if (ch.material.userData.isTL) ch.material.emissiveIntensity = night ? 12 : 0.4;
  });
}

function tickBeacons(e: Engine) {
  const t = e.clock.getElapsedTime();
  const p = 0.3 + 0.7 * Math.sin(t * 3);
  e.nightObjs.forEach(o => {
    if (!o.userData.beacon) return;
    if (o instanceof THREE.PointLight) o.intensity = p * 8;
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) o.material.emissiveIntensity = p * 12;
  });
}

/* ═══════════════════════════════════════════════
   VEHICLES
   ═══════════════════════════════════════════════ */
function syncCount(e: Engine, n: number) {
  while (e.vehicles.length < n) addVehicle(e);
  while (e.vehicles.length > n) removeVehicle(e);
}

function removeVehicle(e: Engine) {
  const v = e.vehicles.pop()!;
  e.scene.remove(v.root);
  if (v.spotL) { e.scene.remove(v.spotL); v.spotL.dispose(); }
  if (v.spotR) { e.scene.remove(v.spotR); v.spotR.dispose(); }
  if (v.spotTargetL) e.scene.remove(v.spotTargetL);
  if (v.spotTargetR) e.scene.remove(v.spotTargetR);
  if (v.tailPL) { e.scene.remove(v.tailPL); v.tailPL.dispose(); }
  v.root.traverse(ch => {
    if (ch instanceof THREE.Mesh) {
      ch.geometry.dispose();
      const m = ch.material;
      if (Array.isArray(m)) m.forEach(mm => mm.dispose()); else m.dispose();
    }
  });
}

function addVehicle(e: Engine) {
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const lanes = dir === 1 ? [-5, -8] : [5, 8];
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  const isTruck = Math.random() < 0.25;
  const mesh = isTruck ? mkTruck() : mkCar();
  const s = isTruck ? 0.7 : 0.55;
  mesh.scale.set(s, s, s);
  if (dir === -1) mesh.rotation.y = Math.PI;
  const root = new THREE.Group();
  root.add(mesh);
  const x = -HL + Math.random() * HL * 2;
  const speed = dir * (0.4 + Math.random() * 0.6) * (isTruck ? 0.65 : 1);
  const y = deckYAt(x, e.config.deckHeight) + 2.8;
  root.position.set(x, y, lane);
  e.scene.add(root);

  const spotsUsed = e.vehicles.filter(v => v.spotL !== null).length;
  const giveSpots = spotsUsed < e.maxSpotVehicles;
  let spotL: THREE.SpotLight | null = null, spotR: THREE.SpotLight | null = null;
  let spotTargetL: THREE.Object3D | null = null, spotTargetR: THREE.Object3D | null = null;
  let tailPL: THREE.PointLight | null = null;

  if (giveSpots) {
    spotL = new THREE.SpotLight(0xffeedd, 40, 80, Math.PI / 6, 0.5, 1.5);
    spotR = new THREE.SpotLight(0xffeedd, 40, 80, Math.PI / 6, 0.5, 1.5);
    spotTargetL = new THREE.Object3D();
    spotTargetR = new THREE.Object3D();
    spotL.target = spotTargetL; spotR.target = spotTargetR;
    spotL.visible = e.night; spotR.visible = e.night;
    e.scene.add(spotL, spotR, spotTargetL, spotTargetR);
    tailPL = new THREE.PointLight(0xff1111, 8, 20, 2);
    tailPL.visible = e.night;
    e.scene.add(tailPL);
  }

  const v: Vehicle = { root, mesh, x, speed, lane, dir, isTruck, spotL, spotR, tailPL, spotTargetL, spotTargetR };
  posLights(v, e.config.deckHeight);
  if (e.night) toggleVehicleNight(v, true);
  e.vehicles.push(v);
}

function posLights(v: Vehicle, deckBase: number) {
  const s = v.isTruck ? 0.7 : 0.55;
  const y = deckYAt(v.x, deckBase) + 2.8;
  const x = v.x, z = v.lane;
  const frontOff = v.dir * (v.isTruck ? 5.5 : 2.5) * s;
  const aheadOff = v.dir * 50;
  const backOff = v.dir * (v.isTruck ? -6 : -2.5) * s;
  if (v.spotL) v.spotL.position.set(x + frontOff, y + 0.6, z - 0.7 * s);
  if (v.spotR) v.spotR.position.set(x + frontOff, y + 0.6, z + 0.7 * s);
  if (v.spotTargetL) v.spotTargetL.position.set(x + aheadOff, y - 2, z - 0.3);
  if (v.spotTargetR) v.spotTargetR.position.set(x + aheadOff, y - 2, z + 0.3);
  if (v.tailPL) v.tailPL.position.set(x + backOff, y + 0.5, z);
}

function tickVehicles(e: Engine) {
  const spans = analyzeSpans(e.config);
  for (const v of e.vehicles) {
    v.x += v.speed;
    if (v.x > HL + 100) v.x = -HL - 100;
    else if (v.x < -HL - 100) v.x = HL + 100;

    // Base deck Y + deflection from structural analysis
    const baseY = deckYAt(v.x, e.config.deckHeight);
    const defl = getDeckDeflection(v.x, spans);
    const y = baseY - defl + 2.8;
    v.root.position.set(v.x, y, v.lane);

    // Tilt car to follow deformed surface slope (numerical derivative)
    const dx = 2;
    const yA = deckYAt(v.x + dx, e.config.deckHeight) - getDeckDeflection(v.x + dx, spans);
    const yB = deckYAt(v.x - dx, e.config.deckHeight) - getDeckDeflection(v.x - dx, spans);
    v.mesh.rotation.z = Math.atan((yA - yB) / (2 * dx));

    posLights(v, e.config.deckHeight);
  }
}

/* ═══════════════════════════════════════════════
   NIGHT LIGHTING
   ═══════════════════════════════════════════════ */
function buildNightLighting(scene: THREE.Scene, cfg: StructureConfig): THREE.Object3D[] {
  const objs: THREE.Object3D[] = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffcc44, emissiveIntensity: 10 });
  const piers = getPierPositions(cfg.pierCount);

  const spacing = 35, cnt = Math.floor(HL * 2 / spacing);
  for (let i = 0; i <= cnt; i++) {
    const x = -HL + i * spacing;
    const y = deckYAt(x, cfg.deckHeight) + 3;
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), poleMat);
      pole.position.y = 3.5; g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3), poleMat);
      arm.position.set(0, 7, -side * 1.5); g.add(arm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), glowMat.clone());
      lamp.position.set(0, 6.8, -side * 2.8); g.add(lamp);
      g.position.set(x, y, side * (cfg.deckWidth / 2 - 1.5));
      g.visible = false;
      scene.add(g); objs.push(g);
    }
    if (i % 5 === 0) {
      const spot = new THREE.SpotLight(0xffcc66, 25, 55, Math.PI / 3, 0.6, 1.5);
      spot.position.set(x, y + 8, 0);
      const tgt = new THREE.Object3D();
      tgt.position.set(x, y - 2, 0);
      spot.target = tgt;
      spot.visible = false;
      scene.add(spot, tgt); objs.push(spot);
    }
  }

  for (let i = 0; i <= 6; i++) {
    const x = -HL + i * (HL * 2 / 6);
    const y = deckYAt(x, cfg.deckHeight) - 3;
    const pl = new THREE.PointLight(0xffaa44, 8, 70, 2);
    pl.position.set(x, y, 0);
    pl.visible = false;
    scene.add(pl); objs.push(pl);
  }

  if (cfg.showPylons) {
    piers.forEach(px => {
      const dy = deckYAt(px, cfg.deckHeight);
      const up = new THREE.SpotLight(0xeeddcc, 20, 120, Math.PI / 7, 0.3, 1.2);
      up.position.set(px, dy + 4, 0);
      const tgt = new THREE.Object3D();
      tgt.position.set(px, dy + cfg.pylonHeight + 5, 0);
      up.target = tgt;
      up.visible = false;
      scene.add(up, tgt); objs.push(up);

      const baseGlow = new THREE.PointLight(0xffaa66, 4, 50, 2);
      baseGlow.position.set(px, dy - 10, 0);
      baseGlow.visible = false;
      scene.add(baseGlow); objs.push(baseGlow);

      const topY = dy + cfg.pylonHeight + 4;
      const bL = new THREE.PointLight(0xff2200, 6, 200, 1.5);
      bL.position.set(px, topY, 0);
      bL.visible = false; bL.userData.beacon = true;
      scene.add(bL); objs.push(bL);

      const bMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 10 })
      );
      bMesh.position.set(px, topY, 0);
      bMesh.visible = false; bMesh.userData.beacon = true;
      scene.add(bMesh); objs.push(bMesh);
    });
  }

  return objs;
}

/* ═══════════════════════════════════════════════
   SKY
   ═══════════════════════════════════════════════ */
function makeSky(mode: 'day' | 'night'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  if (mode === 'day') {
    g.addColorStop(0, '#1a2a4a'); g.addColorStop(0.25, '#3a6080');
    g.addColorStop(0.45, '#7ab0d0'); g.addColorStop(0.65, '#b8d8e8');
    g.addColorStop(0.82, '#e8d8c0'); g.addColorStop(1, '#f0e0c0');
  } else {
    g.addColorStop(0, '#000206'); g.addColorStop(0.35, '#01040c');
    g.addColorStop(0.6, '#020812'); g.addColorStop(0.8, '#030a14');
    g.addColorStop(1, '#040a10');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  if (mode === 'night') {
    for (let i = 0; i < 600; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 420, 0.2 + Math.random() * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,240,${0.15 + Math.random() * 0.85})`; ctx.fill();
    }
    const mx = 380, my = 50;
    const mg = ctx.createRadialGradient(mx, my, 12, mx, my, 70);
    mg.addColorStop(0, 'rgba(180,190,210,0.3)'); mg.addColorStop(1, 'rgba(180,190,210,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 70, my - 70, 140, 140);
    ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,225,210,0.95)'; ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 6, my - 4, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#000206'; ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

/* ═══════════════════════════════════════════════
   TERRAIN
   ═══════════════════════════════════════════════ */
function buildTerrain(scene: THREE.Scene) {
  const geo = new THREE.PlaneGeometry(3000, 3000, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z);
    pos.setY(i, h);
    const n = (h + 180) / 230;
    if (h < -150) { col[i*3]=0.25; col[i*3+1]=0.35; col[i*3+2]=0.2; }
    else if (n < 0.4) { col[i*3]=0.2+n*0.2; col[i*3+1]=0.4+n*0.3; col[i*3+2]=0.15+n*0.1; }
    else { col[i*3]=0.35+n*0.15; col[i*3+1]=0.5+n*0.1; col[i*3+2]=0.2+n*0.05; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true; scene.add(m);

  const trG = new THREE.CylinderGeometry(0.8, 1.2, 8, 6);
  const tpG = new THREE.ConeGeometry(5, 15, 7);
  const trM = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
  const cs = [0x2d5a1e, 0x3a6b2a, 0x1e4a15, 0x2a5520, 0x356830];
  for (let i = 0; i < 600; i++) {
    const x = (Math.random()-0.5)*2000, z = (Math.random()-0.5)*2000;
    if (Math.abs(z) < 100) continue;
    const h = terrainH(x, z); if (h < -60) continue;
    const s = 0.5 + Math.random()*1.5;
    const g2 = new THREE.Group();
    const trunk = new THREE.Mesh(trG, trM);
    trunk.scale.set(s,s,s); trunk.position.y = 4*s; g2.add(trunk);
    const tp = new THREE.Mesh(tpG, new THREE.MeshStandardMaterial({ color: cs[Math.floor(Math.random()*cs.length)], roughness: 0.9 }));
    tp.scale.set(s,s,s); tp.position.y = 14*s; tp.castShadow = true; g2.add(tp);
    g2.position.set(x, h, z); g2.rotation.y = Math.random()*Math.PI*2; scene.add(g2);
  }
}

function buildRiver(scene: THREE.Scene) {
  const geo = new THREE.PlaneGeometry(2500, 120, 100, 20);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, -176 + Math.sin(x*0.02+z*0.05)*1.2);
    pos.setZ(i, z + Math.sin(x*0.005)*20);
  }
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a6090, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 })));
}

/* ═══════════════════════════════════════════════
   BRIDGE PARTS
   ═══════════════════════════════════════════════ */
function mkPier(parent: THREE.Group, x: number, gY: number, pH: number, mat: THREE.MeshStandardMaterial, matD: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, gY, 0);
  const bW = 24, tW = 14, d = 10;
  const sh = new THREE.Shape();
  sh.moveTo(-bW/2,0); sh.lineTo(bW/2,0); sh.lineTo(tW/2,pH); sh.lineTo(-tW/2,pH); sh.closePath();
  const pg = new THREE.ExtrudeGeometry(sh, { steps:1, depth:d, bevelEnabled:false });
  pg.translate(0,0,-d/2);
  const p = new THREE.Mesh(pg, mat.clone());
  p.castShadow=true; p.receiveShadow=true;
  p.userData.stressType = 'pier';
  p.userData.pierHeight = pH;
  g.add(p);

  if (pH > 60) {
    const sS=pH*0.75, aH=pH-sS, sp=5;
    for (const side of [-1,1]) {
      const arm = new THREE.Shape();
      arm.moveTo(-3,0); arm.lineTo(3,0); arm.lineTo(3+side*sp*0.3,aH); arm.lineTo(-3+side*sp*0.3,aH); arm.closePath();
      const ag = new THREE.ExtrudeGeometry(arm, { steps:1, depth:d, bevelEnabled:false });
      ag.translate(side*tW/4, sS, -d/2);
      const am = new THREE.Mesh(ag, matD.clone());
      am.castShadow=true;
      am.userData.stressType = 'pier';
      am.userData.pierHeight = pH;
      g.add(am);
    }
  }
  const bg = new THREE.BoxGeometry(bW+10,8,d+6);
  const b = new THREE.Mesh(bg, matD.clone());
  b.position.y=4; b.castShadow=true; b.receiveShadow=true;
  b.userData.stressType = 'pier';
  b.userData.pierHeight = pH;
  g.add(b);
  parent.add(g);
  return g;
}

function mkDeck(parent: THREE.Group, sMat: THREE.MeshStandardMaterial, rMat: THREE.MeshStandardMaterial, bMat: THREE.MeshStandardMaterial, deckBase: number, deckWidth: number): THREE.Group {
  const bL = 1200, dW = deckWidth, S = 200;
  const g = new THREE.Group(); g.position.y = deckBase;
  const cv = (geo: THREE.BufferGeometry) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getX(i) / HL; p.setY(i, p.getY(i) + (-t*t*8+8)); }
    geo.computeVertexNormals();
  };

  const dg = new THREE.BoxGeometry(bL,4.5,dW,S,1,1); cv(dg);
  const deck = new THREE.Mesh(dg, sMat.clone());
  deck.castShadow=true; deck.receiveShadow=true;
  deck.userData.stressType = 'deck';
  g.add(deck);

  const rg = new THREE.BoxGeometry(bL,0.3,dW-2,S,1,1); cv(rg);
  const road = new THREE.Mesh(rg, rMat.clone());
  road.position.y=2.5; road.receiveShadow=true;
  road.userData.stressType = 'deck';
  g.add(road);

  const mg = new THREE.BoxGeometry(bL,0.05,0.3,S,1,1); cv(mg);
  const mark = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color:0xdddd44, roughness:0.6 }));
  mark.position.y=2.7; g.add(mark);

  for (const side of [-1,1]) {
    const bg2 = new THREE.BoxGeometry(bL,3,0.8,S,1,1); cv(bg2);
    const bar = new THREE.Mesh(bg2, bMat.clone());
    bar.position.y=4; bar.position.z=side*(dW/2-0.4);
    bar.castShadow=true;
    bar.userData.stressType = 'deck';
    g.add(bar);

    const sg = new THREE.BoxGeometry(bL,4,0.1,S,1,1); cv(sg);
    const scr = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color:0xaaccee, transparent:true, opacity:0.15, roughness:0.1, metalness:0.5 }));
    scr.position.y=7; scr.position.z=side*(dW/2);
    g.add(scr);
  }
  parent.add(g);
  return g;
}

function mkPylon(parent: THREE.Group, x: number, dY: number, pH: number, mat: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1,1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3,pH,4), mat.clone());
    leg.position.set(side*4, pH/2, 0);
    leg.rotation.z = -side * Math.atan2(4, pH);
    leg.castShadow=true;
    leg.userData.stressType = 'pylon';
    leg.userData.localY = 0.5; // middle
    g.add(leg);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(4,8,6), mat.clone());
  top.position.y = pH-2; top.castShadow=true;
  top.userData.stressType = 'pylon';
  top.userData.localY = 1.0; // top
  g.add(top);

  // Base stress marker
  const baseMarker = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 6), mat.clone());
  baseMarker.position.y = 1;
  baseMarker.userData.stressType = 'pylon';
  baseMarker.userData.localY = 0.0; // base (highest stress)
  g.add(baseMarker);

  g.position.set(x, dY+2.5, 0);
  parent.add(g);
  return g;
}

function mkCables(parent: THREE.Group, px: number, dY: number, pH: number, cM: THREE.MeshStandardMaterial, cableCount: number, deckBase: number, deckWidth: number) {
  const span = 140, topY = dY + pH + 2.5;
  const edgeZ = (deckWidth / 2) - 2;
  for (const s of [-1,1]) {
    for (let i = 1; i <= cableCount; i++) {
      const dx = px + s * (i / cableCount) * span;
      if (Math.abs(dx) > HL) continue;
      const cY = deckYAt(dx, deckBase) + 3;
      for (const e of [-1,1]) {
        const st = new THREE.Vector3(px, topY, e*1.5);
        const en = new THREE.Vector3(dx, cY, e*edgeZ);
        const dir = new THREE.Vector3().subVectors(en, st);
        const len = dir.length();
        const mid = new THREE.Vector3().addVectors(st, en).multiplyScalar(0.5);
        const cg = new THREE.CylinderGeometry(0.15,0.15,len,4);
        const cable = new THREE.Mesh(cg, cM.clone());
        cable.position.copy(mid);
        cable.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
        cable.castShadow=true;
        cable.userData.stressType = 'cable';
        cable.userData.cableLength = len;
        parent.add(cable);
      }
    }
  }
}

/* ═══════════════════════════════════════════════
   CAR / TRUCK
   ═══════════════════════════════════════════════ */
const CC = [0xcc2222,0x2244aa,0xeeeeee,0x333333,0x888888,0x44aa44,0xddaa22,0x6633aa,0x22aaaa,0xbb5500,0xdd3366,0x1155cc,0xaabb00];

function mkCar(): THREE.Group {
  const g = new THREE.Group();
  const c = CC[Math.floor(Math.random()*CC.length)];
  const bM = new THREE.MeshStandardMaterial({ color:c, roughness:0.4, metalness:0.6 });
  const gM = new THREE.MeshStandardMaterial({ color:0x88bbdd, roughness:0.1, metalness:0.8, transparent:true, opacity:0.6 });
  const wM = new THREE.MeshStandardMaterial({ color:0x222222, roughness:0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(5,1.2,2.2), bM);
  body.position.y = 0.7; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8,1,2), gM);
  cabin.position.set(-0.2,1.6,0); g.add(cabin);

  const wG = new THREE.CylinderGeometry(0.4,0.4,0.3,8); wG.rotateX(Math.PI/2);
  for (const wx of [-1.5,1.5]) for (const wz of [-1.1,1.1]) {
    const w = new THREE.Mesh(wG, wM); w.position.set(wx,0.4,wz); g.add(w);
  }
  const hlM = new THREE.MeshStandardMaterial({ color:0xffffee, emissive:0xffffaa, emissiveIntensity:0.5 });
  hlM.userData.isHL = true;
  for (const z of [-0.7,0.7]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.35,0.45), hlM); h.position.set(2.5,0.8,z); g.add(h); }
  const tlM = new THREE.MeshStandardMaterial({ color:0xff2222, emissive:0xff0000, emissiveIntensity:0.4 });
  tlM.userData.isTL = true;
  for (const z of [-0.7,0.7]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.35,0.45), tlM); t.position.set(-2.5,0.8,z); g.add(t); }
  return g;
}

function mkTruck(): THREE.Group {
  const g = new THREE.Group();
  const cc = CC[Math.floor(Math.random()*CC.length)];
  const cM = new THREE.MeshStandardMaterial({ color:cc, roughness:0.5, metalness:0.4 });
  const tM = new THREE.MeshStandardMaterial({ color:0xdddddd, roughness:0.7, metalness:0.2 });
  const gM = new THREE.MeshStandardMaterial({ color:0x88bbdd, roughness:0.1, metalness:0.8, transparent:true, opacity:0.6 });
  const wM = new THREE.MeshStandardMaterial({ color:0x222222, roughness:0.9 });

  const cab = new THREE.Mesh(new THREE.BoxGeometry(3,2.2,2.4), cM);
  cab.position.set(4,1.2,0); g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.1,1.2,2), gM);
  ws.position.set(5.5,1.5,0); g.add(ws);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(9,2.8,2.5), tM);
  trailer.position.set(-1.5,1.5,0); g.add(trailer);

  const wG = new THREE.CylinderGeometry(0.5,0.5,0.35,8); wG.rotateX(Math.PI/2);
  for (const wx of [4,-1,-4]) for (const wz of [-1.2,1.2]) {
    const w = new THREE.Mesh(wG, wM); w.position.set(wx,0.5,wz); g.add(w);
  }
  const hlM = new THREE.MeshStandardMaterial({ color:0xffffee, emissive:0xffffaa, emissiveIntensity:0.5 });
  hlM.userData.isHL = true;
  for (const z of [-0.8,0.8]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.45,0.55), hlM); h.position.set(5.5,0.8,z); g.add(h); }
  const tlM = new THREE.MeshStandardMaterial({ color:0xff2222, emissive:0xff0000, emissiveIntensity:0.4 });
  tlM.userData.isTL = true;
  for (const z of [-0.8,0.8]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.45,0.55), tlM); t.position.set(-6,0.8,z); g.add(t); }
  return g;
}
