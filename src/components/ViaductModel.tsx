import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ViaductProps {
  pillarHeights: number[];
  deckThickness: number;
  cableCount: number;
  load: number;
  showStress: boolean;
  windForce: number;
  isNight?: boolean;
}

const BASE_HEIGHTS = [0.77, 1.09, 1.41, 2.45, 2.21, 1.36, 1.12];
const SPAN = 3.42;
const DECK_Y = 2.7;
const NUM_PIERS = 7;
const GROUND_Y = -1.0;

const CONCRETE = new THREE.Color(0xd6d3cd);
const ASPHALT = new THREE.Color(0x2a2a2a);
const CABLE_COL = new THREE.Color(0xbbbbbb);

function stressCol(s: number): THREE.Color {
  if (s < 0.25) return new THREE.Color(0x22c55e);
  if (s < 0.50) return new THREE.Color(0xeab308);
  if (s < 0.75) return new THREE.Color(0xf97316);
  return new THREE.Color(0xef4444);
}

// ──────────── CABLE with rope physics ────────────
function drawRope(
  segments: React.JSX.Element[],
  anchor: [number, number, number],
  endPoint: [number, number, number],
  keyPrefix: string,
  radius: number,
  color: THREE.Color,
  time: number,
  windForce: number,
  isBroken: boolean,
) {
  const SEGS = 8;
  const dx = endPoint[0] - anchor[0];
  const dy = endPoint[1] - anchor[1];
  const dz = endPoint[2] - anchor[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  // Cable has natural sag (catenary)
  const sagAmount = isBroken ? 0 : (0.02 + windForce * 0.01);
  
  for (let si = 0; si < SEGS; si++) {
    const t = si / SEGS;
    const tNext = (si + 1) / SEGS;
    
    // Linear interpolation
    const x0 = anchor[0] + dx * t;
    const x1 = anchor[0] + dx * tNext;
    const y0 = anchor[1] + dy * t;
    const y1 = anchor[1] + dy * tNext;
    const z0 = anchor[2] + dz * t;
    const z1 = anchor[2] + dz * tNext;
    
    // Add catenary sag (parabolic approximation)
    const sagY0 = isBroken ? 0 : sagAmount * 4 * t * (1 - t) * dist;
    const sagY1 = isBroken ? 0 : sagAmount * 4 * tNext * (1 - tNext) * dist;
    
    // Add wind sway for broken cables
    const swayX = isBroken ? Math.sin(time * 2 + t * 5) * 0.03 * windForce : 0;
    const swayZ = isBroken ? Math.cos(time * 1.5 + t * 3) * 0.02 * windForce : 0;
    
    const fx0 = x0 + swayX, fx1 = x1 + swayX;
    const fy0 = y0 - sagY0, fy1 = y1 - sagY1;
    const fz0 = z0 + swayZ, fz1 = z1 + swayZ;
    
    const segDx = fx1 - fx0, segDy = fy1 - fy0, segDz = fz1 - fz0;
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy + segDz * segDz);
    if (segLen < 0.001) continue;
    
    const dir = new THREE.Vector3(segDx, segDy, segDz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    
    segments.push(
      <mesh key={`${keyPrefix}-${si}`} position={[(fx0 + fx1) / 2, (fy0 + fy1) / 2, (fz0 + fz1) / 2]} rotation={e}>
        <cylinderGeometry args={[radius, radius, segLen, 5]} />
        <meshStandardMaterial color={color} metalness={isBroken ? 0.3 : 0.8} roughness={isBroken ? 0.6 : 0.2} />
      </mesh>
    );
  }
}

function Cable({ from, to, color, radius = 0.004, broken = false, time = 0, windForce = 0 }: {
  from: [number, number, number]; to: [number, number, number]; color: THREE.Color;
  radius?: number; broken?: boolean; time?: number; windForce?: number;
}) {
  const segments: React.JSX.Element[] = [];
  
  if (!broken) {
    // Intact cable: smooth catenary curve
    drawRope(segments, from, to, 'c', radius, color, time, windForce, false);
  } else {
    // Broken cable: TWO dangling pieces
    const midX = (from[0] + to[0]) / 2;
    const midY = Math.min(from[1], to[1]) - 0.5; // Cable sags down when broken
    
    // Upper piece hangs from pylon
    drawRope(segments, from, [midX, midY, from[2]], 'u', radius * 0.8, new THREE.Color(0x666666), time, windForce * 1.5, true);
    
    // Lower piece hangs from deck
    drawRope(segments, to, [midX, midY + 0.3, to[2]], 'd', radius * 0.8, new THREE.Color(0x666666), time, windForce * 1.5, true);
  }
  
  return <>{segments}</>;
}

// ──────────── Debris piece ────────────
interface DebrisData {
  id: number; x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  vrx: number; vry: number; vrz: number;
  size: [number, number, number];
  color: string;
  alive: boolean;
}

function Debris({ data }: { data: DebrisData }) {
  if (!data.alive) return null;
  return (
    <mesh position={[data.x, data.y, data.z]} rotation={[data.rx, data.ry, data.rz]} castShadow>
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={data.color} roughness={0.8} />
    </mesh>
  );
}

// ──────────── Splash effect ────────────
function Splash({ x, progress }: { x: number; progress: number }) {
  if (progress <= 0 || progress >= 1) return null;
  const s = progress * 2;
  return (
    <mesh position={[x, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[s * 0.15, s * 0.25, 16]} />
      <meshStandardMaterial color="#b0d4f1" transparent opacity={(1 - progress) * 0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ──────────── Vehicle ────────────
interface VD {
  id: number; x: number; z: number; type: 'car' | 'truck';
  color: string; speed: number; dir: 1 | -1;
  falling: boolean; fy: number; fvy: number; frz: number;
}

function Vehicle({ d, dy, dt: dth, night }: { d: VD; dy: number; dt: number; night: boolean }) {
  if (d.falling && d.fy < -5) return null;
  const y = d.falling ? d.fy : dy + dth * 0.07;
  const rotationZ = d.falling ? d.frz : 0;
  const emissiveInt = night ? 2 : 0.4;

  if (d.type === 'truck') return (
    <group position={[d.x, y, d.z]} rotation={[0, d.dir > 0 ? 0 : Math.PI, rotationZ]}>
      <mesh position={[0, -0.002, 0]} castShadow><boxGeometry args={[0.28, 0.012, 0.09]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[-0.03, 0.03, 0]} castShadow><boxGeometry args={[0.2, 0.055, 0.088]} /><meshStandardMaterial color={d.color} roughness={0.7} /></mesh>
      <mesh position={[0.105, 0.03, 0]} castShadow><boxGeometry args={[0.065, 0.05, 0.084]} /><meshStandardMaterial color="#222" /></mesh>
      {night && <pointLight position={[0.15, 0.02, 0]} intensity={0.5} distance={1} color="#fffbe0" />}
      <mesh position={[0.14, 0.015, 0.032]}><boxGeometry args={[0.005, 0.01, 0.01]} /><meshStandardMaterial color="#fffbe0" emissive="#fffbe0" emissiveIntensity={emissiveInt} /></mesh>
      <mesh position={[0.14, 0.015, -0.032]}><boxGeometry args={[0.005, 0.01, 0.01]} /><meshStandardMaterial color="#fffbe0" emissive="#fffbe0" emissiveIntensity={emissiveInt} /></mesh>
    </group>
  );
  return (
    <group position={[d.x, y, d.z]} rotation={[0, d.dir > 0 ? 0 : Math.PI, rotationZ]}>
      <mesh position={[0, 0.014, 0]} castShadow><boxGeometry args={[0.13, 0.03, 0.058]} /><meshStandardMaterial color={d.color} roughness={0.5} /></mesh>
      <mesh position={[0.005, 0.036, 0]} castShadow><boxGeometry args={[0.065, 0.02, 0.054]} /><meshStandardMaterial color={d.color} /></mesh>
      {night && <pointLight position={[0.07, 0.02, 0]} intensity={0.3} distance={0.8} color="#fffbe0" />}
      <mesh position={[0.066, 0.016, 0.022]}><boxGeometry args={[0.004, 0.008, 0.008]} /><meshStandardMaterial color="#fffbe0" emissive="#fffbe0" emissiveIntensity={emissiveInt} /></mesh>
      <mesh position={[0.066, 0.016, -0.022]}><boxGeometry args={[0.004, 0.008, 0.008]} /><meshStandardMaterial color="#fffbe0" emissive="#fffbe0" emissiveIntensity={emissiveInt} /></mesh>
    </group>
  );
}

interface SplashData { x: number; p: number; }

export default function ViaductModel({ pillarHeights, deckThickness, cableCount, load, showStress, windForce, isNight = false }: ViaductProps) {
  const bridgeRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const [splashes, setSplashes] = useState<SplashData[]>([]);
  const [debris, setDebris] = useState<DebrisData[]>([]);
  const [brokenSegments, setBrokenSegments] = useState<Set<number>>(new Set());

  const pillarX = useMemo(() => {
    const w = SPAN * (NUM_PIERS + 1);
    return Array.from({ length: NUM_PIERS }, (_, i) => -w / 2 + SPAN * (i + 1));
  }, []);

  const heights = useMemo(() => pillarHeights.map((m, i) => BASE_HEIGHTS[i] * m), [pillarHeights]);

  // Physics calculation
  const physics = useMemo(() => {
    const E = 210, t = deckThickness, I = 0.55 * t * t * t / 12, EI = E * I;
    const w_total = 0.44 + load * 0.8, n = Math.max(cableCount, 1);
    const L = SPAN, L4 = L * L * L * L;
    const dr = (5 * w_total * (1 - (n / 11) * 0.85) * L4) / (384 * Math.max(EI, 0.0001));
    const damage = Math.max(0, Math.min(1, (dr - L / 250) / (L / 50 - L / 250)));
    return { damage, delta: Math.min(dr, DECK_Y - GROUND_Y - 0.3) };
  }, [cableCount, deckThickness, load]);

  const { damage, delta } = physics;

  // Cable breaking logic
  const [brokenCables, setBrokenCables] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (damage > 0.4) {
      const newBroken = new Set(brokenCables);
      pillarX.forEach((_, pi) => {
        if (Math.random() < damage * 0.08) {
          const ci = Math.floor(Math.random() * Math.max(2, cableCount));
          newBroken.add(`${pi}-${ci}-${Math.random() > 0.5 ? 'l' : 'r'}`);
        }
      });
      setBrokenCables(newBroken);
    } else if (damage < 0.1) {
      setBrokenCables(new Set());
    }
  }, [damage, cableCount]);

  // Deck breaking and debris spawning
  useEffect(() => {
    if (damage > 0.65) {
      const newBroken = new Set(brokenSegments);
      const breakProgress = (damage - 0.65) / 0.35;
      
      // Central spans break first
      const centerIdx = Math.floor(deckPts.length / 2);
      const breakRange = Math.floor(30 * breakProgress);
      
      for (let i = centerIdx - breakRange; i < centerIdx + breakRange; i++) {
        if (i >= 0 && i < deckPts.length && Math.random() < breakProgress * 0.3) {
          if (!newBroken.has(i)) {
            newBroken.add(i);
            // Spawn debris
            const p = deckPts[i];
            if (p) {
              setDebris(prev => [...prev, {
                id: Date.now() + i,
                x: p.x + (Math.random() - 0.5) * 0.3,
                y: p.y + 0.5,
                z: (Math.random() - 0.5) * 0.5,
                vx: (Math.random() - 0.5) * 0.5,
                vy: 0,
                vz: (Math.random() - 0.5) * 0.3,
                rx: Math.random() * Math.PI,
                ry: Math.random() * Math.PI,
                rz: Math.random() * Math.PI,
                vrx: (Math.random() - 0.5) * 3,
                vry: (Math.random() - 0.5) * 3,
                vrz: (Math.random() - 0.5) * 3,
                size: [0.15 + Math.random() * 0.2, 0.08 + Math.random() * 0.1, 0.1 + Math.random() * 0.15],
                color: Math.random() > 0.5 ? '#b8b8c0' : '#9a9a9a',
                alive: true
              }]);
            }
          }
        }
      }
      setBrokenSegments(newBroken);
    } else if (damage < 0.5) {
      setBrokenSegments(new Set());
      setDebris([]);
    }
  }, [damage]);

  // Deck geometry
  const deckPts = useMemo(() => {
    const sx = -SPAN * 4, ex = SPAN * 4, N = 300, pts: THREE.Vector3[] = [];
    const supX = [sx, ...pillarX, ex];
    const supY = [DECK_Y, ...heights.map(h => Math.max(DECK_Y - Math.max(0, (BASE_HEIGHTS[pillarX.indexOf(pillarX[heights.indexOf(h)])] - h)), GROUND_Y + 0.5)), DECK_Y];
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = sx + (ex - sx) * t;
      let li = 0; for (let si = 0; si < supX.length - 1; si++) if (x >= supX[si]) li = si;
      const ri = li + 1, x0 = supX[li], x1 = supX[ri], y0 = supY[li], y1 = supY[ri], sL = x1 - x0;
      const u = (x - x0) / sL;
      let y = y0 + (y1 - y0) * u - 16 * u * u * (1 - u) * (1 - u) * delta * (sL / SPAN);
      if (damage > 0.45) {
        const c1 = (pillarX[2] + pillarX[3]) / 2, c2 = (pillarX[3] + pillarX[4]) / 2;
        const bd = Math.min(Math.abs(x - c1), Math.abs(x - c2));
        if (bd < SPAN * 0.55) {
          const bf = 1 - bd / (SPAN * 0.55), cp = (damage - 0.45) / 0.55;
          y -= Math.min(bf * bf * cp * 2.5, Math.max(0, y - GROUND_Y - 0.2));
        }
      }
      pts.push(new THREE.Vector3(x, Math.max(y, GROUND_Y + 0.05), 0));
    }
    return pts;
  }, [delta, pillarX, heights, damage]);

  const stressArr = useMemo(() => deckPts.map((p, i) => {
    if (i < 2 || i > deckPts.length - 3) return 0;
    const curv = Math.abs(deckPts[i - 1].y - 2 * p.y + deckPts[i + 1].y) * 200;
    return Math.min(curv * (0.3 + load) * 1.5 + damage * 0.3, 1);
  }), [deckPts, load, damage]);

  // Vehicles
  const vRef = useRef<VD[]>([]);
  const [vState, setVState] = useState<VD[]>([]);
  useEffect(() => {
    const vs: VD[] = [];
    const sx = -SPAN * 4, ex = SPAN * 4;
    for (let i = 0; i < 15 + load * 20; i++) {
      vs.push({ id: i, x: sx + Math.random() * (ex - sx), z: (i % 2 ? 0.08 : -0.08), type: i % 4 ? 'car' : 'truck', color: isNight ? '#555' : ['#c0392b', '#2980b9', '#f5f5f5'][i % 3], speed: 0.15 + Math.random() * 0.2, dir: i % 2 ? 1 : -1, falling: false, fy: 0, fvy: 0, frz: 0 });
    }
    vRef.current = vs;
  }, [load, isNight]);

  // Physics loop
  useFrame((_, dt) => {
    timeRef.current += dt;
    if (bridgeRef.current) {
      const maxA = 0.03, rawA = Math.sin(timeRef.current * 1.8) * windForce * 0.012;
      bridgeRef.current.rotation.z = Math.max(-maxA, Math.min(maxA, rawA));
    }
    
    // Update debris physics
    setDebris(prev => prev.map(d => {
      if (!d.alive) return d;
      const newVy = d.vy - 9.8 * dt * 0.5;
      const newY = d.y + newVy * dt;
      const newX = d.x + d.vx * dt;
      const newZ = d.z + d.vz * dt;
      const newRx = d.rx + d.vrx * dt;
      const newRy = d.ry + d.vry * dt;
      const newRz = d.rz + d.vrz * dt;
      
      // Splash when hitting water
      if (newY < -0.65 && d.y >= -0.65) {
        setSplashes(s => [...s, { x: newX, p: 0 }]);
      }
      
      // Stop at ground
      if (newY < GROUND_Y + 0.1) {
        return { ...d, y: GROUND_Y + 0.1, vy: 0, vx: 0, vz: 0, vrx: 0, vry: 0, vrz: 0 };
      }
      
      return { ...d, vy: newVy, y: newY, x: newX, z: newZ, rx: newRx, ry: newRy, rz: newRz };
    }).filter(d => d.y > GROUND_Y - 1));
    
    // Update vehicles
    vRef.current.forEach(v => {
      if (v.falling) {
        v.fvy -= 9.8 * dt * 0.5;
        v.fy += v.fvy * dt;
        v.frz += dt * (v.dir * 2);
        v.x += v.speed * v.dir * dt * 0.5;
        if (v.fy < -0.65 && v.fy > -0.75) {
          setSplashes(prev => [...prev, { x: v.x, p: 0 }]);
        }
      } else {
        v.x += v.speed * v.dir * dt;
        if (v.x > SPAN * 4.5) v.x = -SPAN * 4.5;
        if (v.x < -SPAN * 4.5) v.x = SPAN * 4.5;
        
        // Vehicle falls if segment is broken
        const idx = Math.floor(Math.max(0, Math.min(1, (v.x + SPAN * 4) / (SPAN * 8))) * 299);
        if (brokenSegments.has(idx)) {
          v.falling = true;
          v.fy = (deckPts[idx]?.y || DECK_Y) + deckThickness * 0.07;
          v.fvy = 0; v.frz = 0;
        }
      }
    });
    setVState([...vRef.current]);
  });

  // Splash animation
  useEffect(() => {
    if (splashes.length === 0) return;
    const iv = setInterval(() => { setSplashes(prev => prev.map(s => ({ ...s, p: s.p + 0.04 })).filter(s => s.p < 1)); }, 50);
    return () => clearInterval(iv);
  }, [splashes.length]);

  return (<>
    {/* TERRAIN */}
    <group>
      <mesh position={[0, -2.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[120, 80]} /><meshStandardMaterial color={isNight ? "#050802" : "#6b8f4e"} roughness={0.95} /></mesh>
      <mesh position={[-16, 0, 0]} receiveShadow castShadow><boxGeometry args={[20, 5, 50]} /><meshStandardMaterial color={isNight ? "#0a0f05" : "#7a9e5a"} /></mesh>
      <mesh position={[16, 0, 0]} receiveShadow castShadow><boxGeometry args={[20, 5, 50]} /><meshStandardMaterial color={isNight ? "#0a0f05" : "#7a9e5a"} /></mesh>
      <mesh position={[0, -1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 50]} /><meshStandardMaterial color={isNight ? "#020a15" : "#4a90c4"} transparent opacity={0.7} /></mesh>
      {splashes.map((s, i) => <Splash key={i} x={s.x} progress={s.p} />)}
    </group>

    {/* BRIDGE */}
    <group position={[0, -2.2, 0]}>
      <group ref={bridgeRef} position={[0, 2.2, 0]}>
        {/* PIERS */}
        {heights.map((h, i) => {
          const x = pillarX[i], pS = Math.min(load * h * 0.35 + damage * 0.3, 1), pC = showStress ? stressCol(pS) : CONCRETE, pylH = h * 0.38, pBot = -1.5, pH = DECK_Y - pBot;
          let tilt = 0; if (i === 3 || i === 4) tilt = Math.max(0, (damage - 0.6) / 0.4) * 0.06 * (i === 3 ? -1 : 1);
          return <group key={i} position={[x, 0, 0]} rotation={[0, 0, tilt]}>
            <mesh position={[-0.06, (pBot + DECK_Y) / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.09, pH, 0.2]} /><meshStandardMaterial color={pC} /></mesh>
            <mesh position={[0.06, (pBot + DECK_Y) / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.09, pH, 0.2]} /><meshStandardMaterial color={pC} /></mesh>
            <mesh position={[0, DECK_Y + pylH / 2, 0]} castShadow><boxGeometry args={[0.04, pylH, 0.04]} /><meshStandardMaterial color={pC} /></mesh>
            {isNight && <mesh position={[0, DECK_Y + pylH + 0.05, 0]}><sphereGeometry args={[0.02]} /><meshStandardMaterial color="red" emissive="red" emissiveIntensity={2} /></mesh>}
            
            {/* CABLES with rope physics */}
            {Array.from({ length: Math.max(2, cableCount) }).map((_, ci) => {
              const frac = (ci + 1) / (cableCount + 1), half = SPAN * 0.47, lx = -half * frac, rx = half * frac, topY = DECK_Y + pylH * 0.97 - ci * 0.008;
              const lId = `${i}-${ci}-l`, rId = `${i}-${ci}-r`, lb = brokenCables.has(lId), rb = brokenCables.has(rId);
              return <React.Fragment key={ci}>
                <Cable from={[-0.02, topY, 0]} to={[lx, DECK_Y, 0]} color={CABLE_COL} broken={lb} time={timeRef.current} windForce={windForce} />
                <Cable from={[0.02, topY, 0]} to={[rx, DECK_Y, 0]} color={CABLE_COL} broken={rb} time={timeRef.current} windForce={windForce} />
              </React.Fragment>;
            })}
          </group>;
        })}

        {/* DECK SEGMENTS - show or hide based on break state */}
        {Array.from({ length: 150 }).map((_, i) => {
          const idx = i * 2; if (idx >= deckPts.length - 2) return null;
          const p1 = deckPts[idx], p2 = deckPts[idx + 2], mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          
          // Only render if not broken
          if (brokenSegments.has(idx)) return null;
          
          const sl = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          return <group key={i} position={[mx, my, 0]} rotation={[0, 0, ang]}>
            <mesh position={[0, 0.06, 0]} castShadow receiveShadow><boxGeometry args={[sl + 0.005, 0.02, 0.5]} /><meshStandardMaterial color={showStress ? stressCol(stressArr[idx]) : ASPHALT} roughness={0.9} /></mesh>
            <mesh castShadow receiveShadow><boxGeometry args={[sl + 0.005, 0.1, 0.54]} /><meshStandardMaterial color={showStress ? stressCol(stressArr[idx]) : CONCRETE} /></mesh>
            {i % 10 === 0 && <group position={[0, 0.1, 0.28]}><mesh><boxGeometry args={[0.01, 0.15, 0.01]} /><meshStandardMaterial color="#444" /></mesh>{isNight && <><mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.02]} /><meshStandardMaterial color="#fffbe0" emissive="#fffbe0" emissiveIntensity={3} /></mesh><pointLight position={[0, 0.08, 0]} intensity={0.5} distance={3} color="#fffbe0" /></>}</group>}
          </group>;
        })}

        {/* VEHICLES */}
        {vState.map(v => <Vehicle key={v.id} d={v} dy={deckPts[Math.floor(Math.max(0, Math.min(1, (v.x + SPAN * 4) / (SPAN * 8))) * 299)]?.y || DECK_Y} dt={deckThickness} night={isNight} />)}

        {/* DEBRIS from broken sections */}
        {debris.map(d => <Debris key={d.id} data={d} />)}
      </group>
    </group>
  </>);
}
