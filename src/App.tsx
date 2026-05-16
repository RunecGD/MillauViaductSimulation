import { useRef, useState } from 'react';
import MillauViaduct, { DEFAULT_STRUCTURE, type StructureConfig } from './components/MillauViaduct';
import InfoPanel from './components/InfoPanel';
import ControlPanel from './components/ControlPanel';
import WarningPanel from './components/WarningPanel';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nightMode, setNightMode] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(24);
  const [structure, setStructure] = useState<StructureConfig>({ ...DEFAULT_STRUCTURE });
  const [showStress, setShowStress] = useState(false);
  const [cameraPreset, setCameraPreset] = useState('perspective');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />

      <MillauViaduct
        containerRef={containerRef}
        nightMode={nightMode}
        vehicleCount={vehicleCount}
        structure={structure}
        showStress={showStress}
        cameraPreset={cameraPreset}
      />

      <ControlPanel
        nightMode={nightMode}
        setNightMode={setNightMode}
        vehicleCount={vehicleCount}
        setVehicleCount={setVehicleCount}
        structure={structure}
        setStructure={setStructure}
        showStress={showStress}
        setShowStress={setShowStress}
        cameraPreset={cameraPreset}
        setCameraPreset={setCameraPreset}
      />

      <WarningPanel structure={structure} vehicleCount={vehicleCount} />

      <InfoPanel />

      <div className="absolute bottom-4 left-4 z-10 select-none pointer-events-none">
        <h1 className="text-white/30 text-sm font-light tracking-widest uppercase">
          Виадук Мийо · 3D Модель
        </h1>
      </div>
    </div>
  );
}
