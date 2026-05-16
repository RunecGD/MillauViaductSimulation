import { useMemo } from 'react';
import type { StructureConfig } from './MillauViaduct';
import { DEFAULT_STRUCTURE, analyzeSpans, cableTensionRatio } from './MillauViaduct';

interface Props {
  structure: StructureConfig;
  vehicleCount: number;
}

interface Warning {
  type: 'danger' | 'warn' | 'info';
  text: string;
}

function getWarnings(cfg: StructureConfig, nv: number): Warning[] {
  const d = DEFAULT_STRUCTURE;
  const warnings: Warning[] = [];
  const spans = analyzeSpans(cfg, nv);
  const cRatio = cableTensionRatio(cfg, nv);
  const anyFailed = spans.some(s => s.failed);
  const maxSpanLen = Math.max(...spans.map(s => s.L));
  const maxDefl = Math.max(...spans.map(s => s.maxDeflection));

  // Span failure
  if (anyFailed) {
    warnings.push({ type: 'danger', text: `Пролёт ${Math.round(maxSpanLen)} м не выдерживает — прогиб ${Math.round(maxDefl)} м превышает допустимый. Обрушение неизбежно.` });
  } else if (maxDefl > 5) {
    warnings.push({ type: 'warn', text: `Прогиб палубы ${maxDefl.toFixed(1)} м в пролёте ${Math.round(maxSpanLen)} м — приближается к пределу.` });
  }

  // Cable tension
  if (!cfg.showPylons) {
    warnings.push({ type: 'danger', text: 'Без пилонов и вант мост работает как балка. При таких пролётах — разрушение.' });
  } else if (!cfg.showCables) {
    warnings.push({ type: 'danger', text: 'Пилоны без вант — мёртвая нагрузка. Полотно не поддерживается.' });
  } else if (cRatio > 2.5) {
    warnings.push({ type: 'danger', text: `Натяжение вант ${cRatio.toFixed(1)}× от расчётного — каскадный обрыв тросов.` });
  } else if (cRatio > 1.5) {
    warnings.push({ type: 'warn', text: `Натяжение вант ${cRatio.toFixed(1)}× от расчётного — близко к пределу прочности.` });
  }

  // Pier overload
  const pierLoad = (cfg.deckWidth / d.deckWidth) * (d.pierCount / cfg.pierCount);
  if (pierLoad > 2.5) {
    warnings.push({ type: 'danger', text: `Нагрузка на опоры ${pierLoad.toFixed(1)}× от расчётной — риск потери устойчивости.` });
  } else if (pierLoad > 1.5) {
    warnings.push({ type: 'warn', text: `Нагрузка на опоры ${pierLoad.toFixed(1)}× от расчётной.` });
  }

  // Pier count
  if (cfg.pierCount < d.pierCount && cfg.pierCount >= 4) {
    warnings.push({ type: 'info', text: `${cfg.pierCount} опор — пролёты по ${Math.round(maxSpanLen)} м вместо ${Math.round(1200 / (d.pierCount + 1))} м.` });
  }

  // Deck width
  if (cfg.deckWidth > 42) {
    warnings.push({ type: 'warn', text: `Ширина ${cfg.deckWidth} м — риск аэродинамического флаттера при ветре.` });
  } else if (cfg.deckWidth < 22) {
    warnings.push({ type: 'warn', text: `Ширина ${cfg.deckWidth} м — недостаточно для 4 полос движения.` });
  }

  // Traffic overload
  if (nv > 50) {
    warnings.push({ type: 'warn', text: `${nv} машин — транспортная нагрузка +${Math.round((nv/24)*30)}% сверх расчётной.` });
  } else if (nv > 70) {
    warnings.push({ type: 'danger', text: `${nv} машин — критическая перегрузка полотна.` });
  }

  // Tall pylons
  if (cfg.showPylons && cfg.pylonHeight > 115) {
    warnings.push({ type: 'warn', text: `Пилоны ${cfg.pylonHeight} м — повышенная ветровая нагрузка (M ∝ H²).` });
  }

  // Short pylons
  if (cfg.showPylons && cfg.showCables && cfg.pylonHeight < 55) {
    warnings.push({ type: 'warn', text: `Пилоны ${cfg.pylonHeight} м — пологий угол вант увеличивает натяжение.` });
  }

  return warnings;
}

const ICON = { danger: '🔴', warn: '🟡', info: '🔵' };
const BG = { danger: 'bg-red-500/20 border-red-500/40', warn: 'bg-yellow-500/15 border-yellow-500/30', info: 'bg-blue-500/10 border-blue-500/20' };
const TX = { danger: 'text-red-300', warn: 'text-yellow-200', info: 'text-blue-300' };

export default function WarningPanel({ structure, vehicleCount }: Props) {
  const warnings = useMemo(() => getWarnings(structure, vehicleCount), [structure, vehicleCount]);

  if (warnings.length === 0) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 select-none pointer-events-none"
         style={{ maxWidth: '500px', width: '90%' }}>
      <div className="space-y-1.5">
        {warnings.map((w, i) => (
          <div key={i}
            className={`rounded-lg border px-3 py-2 backdrop-blur-md pointer-events-auto ${BG[w.type]} ${w.type === 'danger' ? 'animate-pulse' : ''}`}>
            <div className="flex gap-2 items-center">
              <span className="text-sm shrink-0">{ICON[w.type]}</span>
              <p className={`text-[11px] leading-snug font-medium ${TX[w.type]}`}>{w.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
