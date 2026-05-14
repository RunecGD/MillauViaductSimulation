import { useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, Sky } from '@react-three/drei';
import ViaductModel from './components/ViaductModel';
import ControlPanel from './components/ControlPanel';
import InfoPanel from './components/InfoPanel';
import CameraController from './components/CameraController';
import { useDamage } from './hooks/usePhysics';

const DEFAULT_PILLAR_HEIGHTS = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
const DEFAULT_DECK_THICKNESS = 1.0;
const DEFAULT_CABLE_COUNT = 12;

function LoadingFallback() {
  return (
    <Html center>
      <div className="text-white text-xl font-semibold bg-gray-900/80 px-8 py-4 rounded-xl backdrop-blur-sm">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-3" />
        Загрузка...
      </div>
    </Html>
  );
}

export default function App() {
  const [pillarHeights, setPillarHeights] = useState<number[]>([...DEFAULT_PILLAR_HEIGHTS]);
  const [deckThickness, setDeckThickness] = useState(DEFAULT_DECK_THICKNESS);
  const [cableCount, setCableCount] = useState(DEFAULT_CABLE_COUNT);
  const [load, setLoad] = useState(0.3);
  const [showStress, setShowStress] = useState(false);
  const [windForce, setWindForce] = useState(0);
  const [isNight, setIsNight] = useState(false);
  const [cameraPreset, setCameraPreset] = useState('perspective');

  const handleReset = useCallback(() => {
    setPillarHeights([...DEFAULT_PILLAR_HEIGHTS]);
    setDeckThickness(DEFAULT_DECK_THICKNESS);
    setCableCount(DEFAULT_CABLE_COUNT);
    setLoad(0.3);
    setShowStress(false);
    setWindForce(0);
  }, []);

  const damage = useDamage(cableCount, deckThickness, load, pillarHeights);

  const isWarning = damage > 0.15 && damage < 0.45;

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <Canvas
        camera={{ position: [12, 6, 12], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false }}
        shadows
      >
        <Suspense fallback={<LoadingFallback />}>
          {/* Realistic sky */}
          <Sky
            distance={450000}
            sunPosition={isNight ? [-10, -5, -10] : [80, 40, -30]}
            inclination={isNight ? 0.01 : 0.52}
            azimuth={0.25}
            rayleigh={isNight ? 0.1 : 0.5}
            turbidity={isNight ? 20 : 8}
          />
          <fog attach="fog" args={[isNight ? '#050a15' : '#c9dff5', 50, 150]} />

          {/* Sunlight / Moonlight */}
          <directionalLight
            position={isNight ? [10, 20, 10] : [80, 40, -30]}
            intensity={isNight ? 0.15 : 2.2}
            color={isNight ? '#99b3ff' : '#fff5e0'}
            castShadow
            shadow-mapSize-width={4096}
            shadow-mapSize-height={4096}
            shadow-camera-far={120}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={30}
            shadow-camera-bottom={-20}
          />
          
          {/* Fill and Ambient */}
          <ambientLight intensity={isNight ? 0.05 : 0.4} color={isNight ? '#101525' : '#e8f0ff'} />
          <hemisphereLight intensity={isNight ? 0.1 : 0.4} color={isNight ? '#1a2035' : '#87ceeb'} groundColor={isNight ? '#050802' : '#5a7a3a'} />

          <ViaductModel
            pillarHeights={pillarHeights}
            deckThickness={deckThickness}
            cableCount={cableCount}
            load={load}
            showStress={showStress}
            windForce={windForce}
            isNight={isNight}
          />

          <CameraController preset={cameraPreset} />
        </Suspense>
      </Canvas>

      {/* Damage overlay — gradually appears */}
      {damage > 0.3 && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Red vignette — intensity grows with damage */}
          <div
            className={damage > 0.6 ? 'absolute inset-0 animate-pulse' : 'absolute inset-0'}
            style={{
              boxShadow: `inset 0 0 ${damage * 80}px rgba(220,38,38,${(damage-0.3)*0.4})`,
            }}
          />
          {/* Warning banner — text changes with severity */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-red-950/90 border border-red-600 text-red-100 px-6 py-3 rounded-xl shadow-xl">
            <div className={damage>0.7?'text-2xl animate-bounce':'text-2xl'}>⚠️</div>
            <div>
              <div className="text-base font-bold">
                {damage > 0.85 ? 'ПОЛНОЕ ОБРУШЕНИЕ'
                  : damage > 0.65 ? 'ОБРУШЕНИЕ ПРОЛЁТОВ'
                  : damage > 0.45 ? 'ВАНТЫ РВУТСЯ'
                  : 'ДЕФОРМАЦИЯ'}
              </div>
              <div className="text-xs text-red-300 mt-0.5">
                {damage > 0.85 ? 'Конструкция разрушена'
                  : damage > 0.65 ? 'Секции полотна падают, транспорт в реке'
                  : damage > 0.45 ? 'Тросы не выдерживают, центральные пролёты провисают'
                  : 'Мост деформируется под нагрузкой'}
              </div>
            </div>
          </div>
          {/* Damage bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 border border-red-800/50 px-5 py-2 rounded-lg">
            <div className="text-[10px] text-red-400 uppercase tracking-widest mb-1 text-center">Повреждение</div>
            <div className="w-40 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${damage * 100}%`,
                  background: damage > 0.7
                    ? 'linear-gradient(90deg,#f97316,#dc2626)'
                    : damage > 0.45
                      ? 'linear-gradient(90deg,#eab308,#f97316)'
                      : '#eab308'
                }}
              />
            </div>
            <div className="text-center text-[10px] text-gray-400 mt-0.5">{Math.round(damage*100)}%</div>
          </div>
        </div>
      )}

      {isWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-amber-950/80 border border-amber-600/60 text-amber-200 px-5 py-2 rounded-lg text-xs flex items-center gap-2 animate-pulse">
            ⚡ Нагрузка приближается к предельной
          </div>
        </div>
      )}

      <ControlPanel
        pillarHeights={pillarHeights}
        setPillarHeights={setPillarHeights}
        deckThickness={deckThickness}
        setDeckThickness={setDeckThickness}
        cableCount={cableCount}
        setCableCount={setCableCount}
        load={load}
        setLoad={setLoad}
        showStress={showStress}
        setShowStress={setShowStress}
        windForce={windForce}
        setWindForce={setWindForce}
        isNight={isNight}
        setIsNight={setIsNight}
        onReset={handleReset}
        cameraPreset={cameraPreset}
        setCameraPreset={setCameraPreset}
      />

      <InfoPanel />
    </div>
  );
}
