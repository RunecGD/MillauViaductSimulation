import { useState } from 'react';
import { useDamage } from '../hooks/usePhysics';

interface Props {
  pillarHeights: number[];
  setPillarHeights: (h: number[]) => void;
  deckThickness: number;
  setDeckThickness: (v: number) => void;
  cableCount: number;
  setCableCount: (v: number) => void;
  load: number;
  setLoad: (v: number) => void;
  showStress: boolean;
  setShowStress: (v: boolean) => void;
  windForce: number;
  setWindForce: (v: number) => void;
  isNight: boolean;
  setIsNight: (v: boolean) => void;
  onReset: () => void;
  cameraPreset: string;
  setCameraPreset: (v: string) => void;
}

export default function ControlPanel({
  pillarHeights, setPillarHeights,
  deckThickness, setDeckThickness,
  cableCount, setCableCount,
  load, setLoad,
  showStress, setShowStress,
  windForce, setWindForce,
  isNight, setIsNight,
  onReset, cameraPreset, setCameraPreset,
}: Props) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'struct' | 'load' | 'cam'>('load');

  const updateH = (i: number, v: number) => {
    const h = [...pillarHeights]; h[i] = v; setPillarHeights(h);
  };

  const damage = useDamage(cableCount, deckThickness, load, pillarHeights);
  const stability = Math.round((1 - damage) * 100);

  const scoreCol = stability >= 70 ? 'text-green-400' : stability >= 40 ? 'text-yellow-400' : 'text-red-400';
  const barCol = stability >= 70 ? 'bg-green-500' : stability >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  const numCars = Math.max(4, Math.floor(load * 20));
  const numTrucks = Math.max(1, Math.floor(load * 6));

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

          {/* Stability */}
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
            {[
              { k: 'struct' as const, l: 'Конструкция' },
              { k: 'load' as const, l: 'Нагрузки' },
              { k: 'cam' as const, l: 'Камера' },
            ].map(({ k, l }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-2 font-medium transition-colors ${tab === k ? 'bg-white/5 text-blue-400 border-b border-blue-400' : 'text-gray-500 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="p-3.5 space-y-3.5">

            {tab === 'struct' && (
              <>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Высоты 7 опор</p>
                  {pillarHeights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-500 w-5 text-right">{i + 1}</span>
                      <input type="range" min="0.3" max="3" step="0.05" value={h}
                        onChange={(e) => updateH(i, parseFloat(e.target.value))}
                        className="flex-1" />
                      <span className="text-[10px] text-gray-400 w-9 text-right">{Math.round(h * 100)}м</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Толщина полотна</p>
                  <input type="range" min="0.3" max="2" step="0.05" value={deckThickness}
                    onChange={(e) => setDeckThickness(parseFloat(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>Тонкое</span><span>{deckThickness.toFixed(1)}×</span><span>Массивное</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Ванты: {cableCount}</p>
                  <input type="range" min="2" max="22" step="2" value={cableCount}
                    onChange={(e) => setCableCount(parseInt(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>2</span><span className="text-gray-400">реальн. ≈11</span><span>22</span>
                  </div>
                </div>
              </>
            )}

            {tab === 'load' && (
              <>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Транспортная нагрузка</p>
                  <input type="range" min="0" max="2" step="0.01" value={load}
                    onChange={(e) => setLoad(parseFloat(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>Пусто</span>
                    <span className={load > 1.2 ? 'text-red-400 font-bold' : ''}>{Math.round(load * 100)}%</span>
                    <span>Перегрузка</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    На мосту: {numCars} авто, {numTrucks} грузовиков
                  </p>
                  {load > 1.3 && <p className="text-[10px] text-red-400 mt-1 animate-pulse">⚠ Конструкция разрушается!</p>}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Ветер</p>
                  <input type="range" min="0" max="2" step="0.05" value={windForce}
                    onChange={(e) => setWindForce(parseFloat(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span>Штиль</span><span>{Math.round(windForce * 50)} м/с</span><span>Ураган</span>
                  </div>
                </div>
                <button onClick={() => setShowStress(!showStress)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${showStress ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-white/5 border border-white/5'}`}>
                  <span className="text-gray-300">Карта напряжений</span>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${showStress ? 'bg-blue-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${showStress ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                <button onClick={() => setIsNight(!isNight)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${isNight ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-white/5 border border-white/5'}`}>
                  <span className="text-gray-300">Ночной режим</span>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${isNight ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isNight ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                {showStress && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-500">Низкое</span>
                    <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right,#22c55e,#eab308,#f97316,#ef4444)' }} />
                    <span className="text-[9px] text-gray-500">Крит.</span>
                  </div>
                )}
              </>
            )}

            {tab === 'cam' && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { k: 'front', l: 'Спереди' },
                    { k: 'side', l: 'Сбоку' },
                    { k: 'top', l: 'Сверху' },
                    { k: 'close', l: 'Ближе' },
                    { k: 'below', l: 'Снизу' },
                    { k: 'perspective', l: 'Общий' },
                  ].map((p) => (
                    <button key={p.k} onClick={() => setCameraPreset(p.k)}
                      className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${cameraPreset === p.k ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                      {p.l}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  Мышь — вращение, колесо — масштаб, ПКМ — перемещение
                </p>
              </>
            )}

            <button onClick={onReset}
              className="w-full py-2 bg-white/5 hover:bg-red-900/30 text-gray-400 hover:text-red-300 rounded-lg text-[11px] font-medium transition-colors border border-white/5 hover:border-red-800/50">
              ↺ Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
