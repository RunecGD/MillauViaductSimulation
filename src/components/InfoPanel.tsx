import { useState } from 'react';

const FACTS = [
  { label: 'Высота',    value: '343 м', note: 'Выше Эйфелевой башни' },
  { label: 'Длина',     value: '2 460 м', note: 'Почти 2.5 километра' },
  { label: 'Пролёт',    value: '342 м', note: '6 центральных пролётов' },
  { label: 'Масса',     value: '36 000 т', note: 'Стальное полотно' },
  { label: 'Ванты',     value: '154', note: 'Стальных тросов' },
  { label: 'Год',       value: '2004', note: 'Открытие 14 декабря' },
];

const ENGINEERING = [
  {
    q: 'Почему вантовая конструкция?',
    a: 'Ванты передают вес полотна на пилоны через растяжение. Это позволяет перекрывать 342-метровые пролёты без промежуточных опор, что невозможно для обычной балочной конструкции.',
  },
  {
    q: 'Какая точность была нужна?',
    a: 'При стыковке двух половин полотна над долиной Тарн отклонение составило менее 1 см на 2.5 км. GPS и лазерные системы контролировали каждый миллиметр.',
  },
  {
    q: 'Как мост противостоит ветру?',
    a: 'Аэродинамическое полотно обтекаемой формы, ветроотбойники на краях. Конструкция выдерживает ветер до 250 км/ч. На высоте 270 м над долиной ветер — главная нагрузка.',
  },
  {
    q: 'Что происходит при нагреве?',
    a: 'Стальное полотно удлиняется на 35 см при изменении температуры. Скользящие опоры и температурные швы компенсируют деформации без повреждений.',
  },
];

export default function InfoPanel() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<'facts' | 'eng'>('facts');

  return (
    <div className="absolute top-3 right-3 z-10 select-none">
      <button onClick={() => setOpen(!open)}
        className="mb-1.5 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors flex items-center gap-2 text-sm ml-auto">
        <span className="font-medium">О виадуке</span>
        <span>{open ? '▶' : '◀'}</span>
      </button>

      {open && (
        <div className="bg-black/75 backdrop-blur-md text-white rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ width: '320px', maxHeight: 'calc(100vh - 4.5rem)', overflowY: 'auto' }}>

          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-bold">Виадук Мийо</h2>
            <p className="text-[10px] text-gray-400">Viaduc de Millau · Аверон, Франция</p>
            <p className="text-[9px] text-gray-500 mt-0.5">Норман Фостер · Мишель Вирложо · 2001–2004</p>
          </div>

          <div className="flex border-b border-white/5 text-[11px]">
            <button onClick={() => setSection('facts')}
              className={`flex-1 py-2 font-medium transition-colors ${section === 'facts' ? 'text-blue-400 border-b border-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`}>
              Характеристики
            </button>
            <button onClick={() => setSection('eng')}
              className={`flex-1 py-2 font-medium transition-colors ${section === 'eng' ? 'text-blue-400 border-b border-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`}>
              Инженерия
            </button>
          </div>

          <div className="p-3.5">
            {section === 'facts' && (
              <div className="grid grid-cols-3 gap-2">
                {FACTS.map((f) => (
                  <div key={f.label} className="bg-white/5 rounded-lg p-2 text-center group hover:bg-white/10 transition-colors">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">{f.label}</div>
                    <div className="text-sm font-bold mt-0.5">{f.value}</div>
                    <div className="text-[8px] text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{f.note}</div>
                  </div>
                ))}
              </div>
            )}
            {section === 'eng' && (
              <div className="space-y-1.5">
                {ENGINEERING.map((e) => (
                  <details key={e.q} className="bg-white/5 rounded-lg overflow-hidden group">
                    <summary className="px-3 py-2 cursor-pointer text-[11px] font-medium text-gray-300 hover:text-white transition-colors flex items-center justify-between">
                      {e.q}
                      <span className="text-gray-500 group-open:rotate-180 transition-transform text-[10px]">▼</span>
                    </summary>
                    <div className="px-3 pb-2.5 text-[10px] text-gray-400 leading-relaxed">{e.a}</div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
