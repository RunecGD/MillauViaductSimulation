import { useMemo } from 'react';

const SPAN = 3.42; // scene units ≈ 342m real

/**
 * Physics-based damage model.
 *
 * Three independent failure checks (Euler-Bernoulli beam, cable tension,
 * pier buckling). Constants calibrated so that default parameters
 * (cables=12, thickness=1, load=0.3, heights=[1..1]) give damage ≈ 0.
 *
 * Returns damage 0→1.
 */
export function useDamage(
  cableCount: number,
  deckThickness: number,
  load: number,
  pillarHeights: number[],
) {
  return useMemo(() => {
    // ─── Constants (calibrated to scene scale) ───
    const E = 210;          // flexural modulus (normalised)
    const deckWidth = 0.55; // scene units

    // ─── Deck flexural rigidity: EI ───
    // Moment of inertia of box section ∝ width·t³/12
    const t = deckThickness;
    const I = deckWidth * t * t * t / 12;
    const EI = E * I;

    // ─── Distributed load ───
    const w_self = 0.44;                // self-weight (always present)
    const w_traffic = load * 0.8;       // traffic load (proportional to slider)
    const w_total = w_self + w_traffic;

    // ─── Cable support ───
    // 11 cable pairs = design capacity. Fewer → beam carries more.
    const n = Math.max(cableCount, 1);
    const cableSupport = Math.min(n / 11, 1.0);
    // Load remaining on beam after cable support
    const w_beam = w_total * (1 - cableSupport * 0.85);

    const L = SPAN;
    const L4 = L * L * L * L; // L⁴

    // ═══ CHECK 1: Beam deflection (Euler-Bernoulli) ═══
    // δ = 5·w·L⁴ / (384·E·I)
    const delta = (5 * w_beam * L4) / (384 * Math.max(EI, 0.0001));
    // Serviceability limit: L/250. Ultimate limit: L/50.
    const delta_service = L / 250; // ≈ 0.0137
    const delta_ultimate = L / 50; // ≈ 0.0684
    const beam_damage = Math.max(0, Math.min(1,
      (delta - delta_service) / (delta_ultimate - delta_service),
    ));

    // ═══ CHECK 2: Cable tension ═══
    // Each cable pair carries V = w·L / (2n)
    // Tension T = V / sin(α) ≈ V · √2 (α ≈ 45°)
    const V_per_cable = (w_total * L) / (2 * n);
    const T_cable = V_per_cable * 1.414;
    // Yield capacity calibrated so that at defaults T/yield ≈ 0.27
    const cable_yield = 0.5;
    const cable_ratio = T_cable / cable_yield;
    const cable_damage = Math.max(0, Math.min(1,
      (cable_ratio - 0.5) / 0.8,
    ));

    // ═══ CHECK 3: Pier buckling (Euler column) ═══
    // Critical load P_cr ∝ EI / L²  →  taller pier = weaker
    // σ = N / P_cr where N = w_total · L (tributary load)
    const avgH = pillarHeights.reduce((a, b) => a + b, 0) / pillarHeights.length;
    const pier_load = w_total * L;
    // Capacity calibrated: at defaults (avgH=1) → ratio ≈ 0.2
    const pier_yield = 8.0;
    const pier_capacity = pier_yield / (avgH * avgH);
    const pier_ratio = pier_load / Math.max(pier_capacity, 0.01);
    const pier_damage = Math.max(0, Math.min(1,
      (pier_ratio - 0.5) / 1.0,
    ));

    // ═══ Overall: worst of three ═══
    return Math.max(beam_damage, cable_damage, pier_damage);
  }, [cableCount, deckThickness, load, pillarHeights]);
}
