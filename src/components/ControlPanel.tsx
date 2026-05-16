import { useState } from 'react';
import type { StructureConfig } from './MillauViaduct';
import { DEFAULT_STRUCTURE, computeStability } from './MillauViaduct';

type Tab = 'struct' | 'load' | 'cam';

interface Props {
  nightMode: boolean;
  setNightMode: (v: boolean) => void;
  vehicleCount: number;
  setVehicleCount: (v: number) => void;
  structure: StructureConfig;
  setStructure: (v: StructureConfig) => void;
  showStress: boolean;
  setShowStress: (v: boolean) => void;
  cameraPreset: string;
  setCameraPreset: (v: string) => void;
}

export default function ControlPanel({
  nightMode, setNightMode,
  vehicleCount, setVehicleCount,
  structure, setStructure,
  showStress, setShowStress,
  cameraPreset, setCameraPreset,
}: Props) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('struct');

  const update = (patch: Partial<StructureConfig>) => setStructure({ ...structure, ...patch });
  const stability = computeStability(structure, vehicleCount);
  const scoreCol = stability >= 70 ? 'text-green-400' : stability >= 40 ? 'text-yellow-400' : 'text-red-400';
  const barCol = stability >= 70 ? 'bg-green-500' : stability >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="absolute top-3 left-3 z-10 select-none" style={{ maxHeight: 'calc(100vh - 1.5rem)' }}>
      <button onClick={() => setOpen(!open)}
        className="mb-1.5 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors flex items-center gap-2 text-sm">
        <span>{open ? '◀' : '▶'}</span>
        <span className="font-medium">Управление</span>
      </button>

      {open && (
        <div className="bg-black/75 backdrop-blur-md text-white rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ width: '310px', maxHeight: 'calc(100vh - 4.5rem)', overflowY: 'auto' }}>

          {/* Stability bar */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">Устойчивость</span>
              <span className={`text-xl font-bold ${scoreCol}`}>{stability}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${barCol}`} style={{ width: `${stability}%` }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5 text-[11px]">
            {([
              { k: 'struct' as const, l: 'Конструкция' },
              { k: 'load' as const, l: 'Нагрузки' },
              { k: 'cam' as const, l: 'Камера' },
            ]).map(({ k, l }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-2 font-medium transition-colors ${tab === k ? 'bg-white/5 text-blue-400 border-b border-blue-400' : 'text-gray-500 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="p-3.5 space-y-3.5">
            {/* ── Конструкция ── */}
            {tab === 'struct' && (
              <>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Опоры: {structure.pierCount}</p>
                  <input type="range" min={2} max={9} step={1} value={structure.pierCount}
                    onChange={e => update({ pierCount: +e.target.value })} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>2</span><span className="text-gray-400">реальн. 7</span><span>9</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Высота палубы</p>
                  <input type="range" min={100} max={250} step={10} value={structure.deckHeight}
                    onChange={e => update({ deckHeight: +e.target.value })} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>100 м</span><span>{structure.deckHeight} м</span><span>250 м</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Ширина палубы</p>
                  <input type="range" min={16} max={50} step={2} value={structure.deckWidth}
                    onChange={e => update({ deckWidth: +e.target.value })} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>Узкое</span><span>{structure.deckWidth} м</span><span>Широкое</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Высота пилонов</p>
                  <input type="range" min={40} max={130} step={5} value={structure.pylonHeight}
                    onChange={e => update({ pylonHeight: +e.target.value })} className="w-full"
                    disabled={!structure.showPylons} />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>40 м</span><span>{structure.pylonHeight} м</span><span>130 м</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Ванты: {structure.cableCount}</p>
                  <input type="range" min={3} max={18} step={1} value={structure.cableCount}
                    onChange={e => update({ cableCount: +e.target.value })} className="w-full"
                    disabled={!structure.showCables || !structure.showPylons} />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>3</span><span className="text-gray-400">реальн. ≈ 11</span><span>18</span>
                  </div>
                </div>

                <Tog label="Пилоны" value={structure.showPylons} onChange={v => update({ showPylons: v })} />
                <Tog label="Ванты" value={structure.showCables} onChange={v => update({ showCables: v })} disabled={!structure.showPylons} />
              </>
            )}

            {/* ── Нагрузки ── */}
            {tab === 'load' && (
              <>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Транспорт: {vehicleCount}</p>
                  <input type="range" min={0} max={80} step={4} value={vehicleCount}
                    onChange={e => setVehicleCount(+e.target.value)} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>Пусто</span><span>{vehicleCount} авто</span><span>Перегрузка</span>
                  </div>
                </div>

                <Tog label="Карта напряжений" value={showStress} onChange={setShowStress} />

                {showStress && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-500">Низкое</span>
                    <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right,#22c55e,#eab308,#f97316,#ef4444)' }} />
                    <span className="text-[9px] text-gray-500">Крит.</span>
                  </div>
                )}

                <Tog label="Ночной режим" value={nightMode} onChange={setNightMode} />
              </>
            )}

            {/* ── Камера ── */}
            {tab === 'cam' && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { k: 'front', l: 'Спереди' },
                    { k: 'side', l: 'Сбоку' },
                    { k: 'top', l: 'Сверху' },
                    { k: 'close', l: 'Ближе' },
                    { k: 'below', l: 'Снизу' },
                    { k: 'perspective', l: 'Общий' },
                  ]).map(p => (
                    <button key={p.k} onClick={() => setCameraPreset(p.k)}
                      className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                        cameraPreset === p.k
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}>
                      {p.l}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  Мышь — вращение, колесо — масштаб
                </p>
              </>
            )}

            <button onClick={() => setStructure({ ...DEFAULT_STRUCTURE })}
              className="w-full py-2 bg-white/5 hover:bg-red-900/30 text-gray-400 hover:text-red-300 rounded-lg text-[11px] font-medium transition-colors border border-white/5 hover:border-red-800/50">
              ↺ Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tog({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${value ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-white/5 border border-white/5'}`}>
      <span className="text-gray-300">{label}</span>
      <div className={`w-8 h-4 rounded-full transition-colors relative ${value ? 'bg-blue-500' : 'bg-gray-600'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}
