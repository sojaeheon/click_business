import React, { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { useGame } from "../../store/gameStore";
import { Canvas } from "@react-three/fiber";
import { Html, useGLTF, useAnimations, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";

// --- Types ---
interface WorkerItem {
  id: number;
  name: string;
  model: string;
  level: number;
  owned: number;
  maxOwned: number;
}

const MOCK_INVENTORY: WorkerItem[] = [
  { id: 1, name: "야만전사", model: "/models/characters/Barbarian.glb", level: 1, owned: 1, maxOwned: 2 },
  { id: 2, name: "기사", model: "/models/characters/Knight.glb", level: 2, owned: 2, maxOwned: 2 },
  { id: 3, name: "마법사", model: "/models/characters/Mage.glb", level: 3, owned: 0, maxOwned: 2 },
  { id: 4, name: "궁수", model: "/models/characters/Ranger.glb", level: 1, owned: 1, maxOwned: 2 },
  { id: 5, name: "도적", model: "/models/characters/Rogue.glb", level: 2, owned: 1, maxOwned: 2 },
];


// --- 3D Components ---
function IsometricRoom() {
  return (
    <group position={[0, -0.05, 0]}>
      {/* 바닥 타일 */}
      <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#fcdbcb" />
      </mesh>
      {/* 왼쪽 벽 */}
      <mesh receiveShadow position={[-6, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#f0d1b3" />
      </mesh>
      {/* 뒤쪽 벽 */}
      <mesh receiveShadow position={[0, 4, -6]}>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#fde5d0" />
      </mesh>
    </group>
  );
}

function CharacterModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = React.useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} scale={1.8} position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]} />;
}

function Lever({ onPull }: { onPull: () => void }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/props/lever.glb");
  const { actions } = useAnimations(animations, group);

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (actions && Object.keys(actions).length > 0) {
      const actionName = Object.keys(actions)[0];
      const action = actions[actionName];
      if (action) {
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
      }
    }
    onPull();
  };

  return (
    <group ref={group} onClick={handleClick} position={[3, 0, -2]} scale={2.5} rotation={[0, -Math.PI / 6, 0]}>
      <primitive object={scene} />
      <Html position={[0, 2, 0]} center>
        <div className="bg-white/90 backdrop-blur rounded-full px-4 py-1.5 font-bold text-slate-800 shadow-lg border-2 border-amber-500 text-sm pointer-events-none animate-bounce">
          👇 CLICK
        </div>
      </Html>
    </group>
  );
}

export function HRPage() {
  const { closeBuildingPage } = useGame();

  const [selectedWorker, setSelectedWorker] = useState<WorkerItem | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const { scene: platformScene } = useGLTF("/models/props/platform.glb");

  const handleLeverPull = () => {
    if (!selectedWorker) {
      setUpgradeMessage("강화할 캐릭터를 선택해주세요!");
      setTimeout(() => setUpgradeMessage(null), 2000);
      return;
    }

    const r = Math.random();
    setTimeout(() => {
      if (r < 0.7) {
        setUpgradeMessage(`✨ 강화 성공! ${selectedWorker.name} Lv.${selectedWorker.level + 1}`);
        setSelectedWorker({ ...selectedWorker, level: selectedWorker.level + 1 });
      } else if (r < 0.85) {
        setUpgradeMessage("💦 변화가 없습니다 (유지)");
      } else if (r < 0.95) {
        setUpgradeMessage(`🔻 강화 실패... ${selectedWorker.name} Lv.${Math.max(1, selectedWorker.level - 1)}`);
        setSelectedWorker({ ...selectedWorker, level: Math.max(1, selectedWorker.level - 1) });
      } else {
        setUpgradeMessage("🔥 캐릭터가 파괴되었습니다!");
        setSelectedWorker(null);
      }
      setTimeout(() => setUpgradeMessage(null), 3000);
    }, 1000);
  };

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col pt-8"
      style={{
        backgroundImage: "url('/images/HR.png')",
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: '#cddeed' // 여백을 채워줄 파란 하늘 비슷한 색
      }}
    >
      <BackButton onClick={closeBuildingPage} className="absolute top-6 left-6 z-50" />

      {upgradeMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white font-black text-3xl px-12 py-5 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-bounce border-4 border-amber-400">
          {upgradeMessage}
        </div>
      )}

      <div className="flex-1 w-full relative">
        <Canvas shadows camera={{ position: [0, 6, 14], fov: 40 }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 15, 10]} intensity={1.8} castShadow shadow-bias={-0.001} />

          <IsometricRoom />

          {/* 중앙 인물 + 플랫폼 영역 */}
          <group position={[-2, 0, -1]}>
            <primitive object={platformScene.clone()} scale={1.8} />

            <Html position={[0, 4.0, 0]} center zIndexRange={[100, 0]}>
              <div className="flex flex-col items-center pointer-events-none w-64 transform -translate-y-4">
                <div className="flex justify-between w-48 mb-[-1px]">
                  <div className="w-1.5 h-12 bg-amber-800 border-l border-amber-950 shadow-md" />
                  <div className="w-1.5 h-12 bg-amber-800 border-l border-amber-950 shadow-md" />
                </div>
                <div className="bg-[#5c4033] border-4 border-[#3e2723] rounded-lg p-3 w-full text-center shadow-xl relative flex flex-col gap-1 items-center">
                  <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-amber-900 shadow-inner" />
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-amber-900 shadow-inner" />
                  <h2 className="text-white font-black text-2xl mb-1 drop-shadow-md">
                    {selectedWorker ? `${selectedWorker.name} Lv.${selectedWorker.level}` : "캐릭터 미선택"}
                  </h2>
                  {selectedWorker && (
                    <>
                      <div className="bg-white/20 px-3 py-1 rounded text-white text-sm font-bold shadow-inner">
                        보유 {selectedWorker.owned}/{selectedWorker.maxOwned}
                      </div>
                      <div className="text-yellow-400 font-bold mt-2 text-sm bg-black/40 w-full py-1.5 rounded drop-shadow">
                        강화 후 기대: Lv.{selectedWorker.level + 1}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between w-48 mb-[-1px]">
                  <div className="w-1.5 h-6 bg-amber-800 border-l border-amber-950 shadow-md" />
                  <div className="w-1.5 h-6 bg-amber-800 border-l border-amber-950 shadow-md" />
                </div>
                <div className="bg-[#4e342e] border-4 border-[#3e2723] rounded-lg w-56 text-center shadow-xl pt-3 pb-2 px-1 relative flex flex-col items-center">
                  <div className="absolute -top-1 left-2 w-2 h-2 rounded-full bg-slate-900/60 shadow-inner" />
                  <div className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-slate-900/60 shadow-inner" />
                  <div className="text-emerald-400 text-3xl font-black mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">성공 확률: 70%</div>
                  <div className="text-slate-300 text-[11px] bg-black/50 rounded px-2 py-1.5 leading-tight font-bold w-[90%] mx-auto shadow-inner">
                    실패 확률<br /><span className="text-yellow-400">유지 15%</span> / <span className="text-orange-400">하락 10%</span> / <span className="text-rose-500">파괴 5%</span>
                  </div>
                </div>
              </div>
            </Html>

            <group position={[0, 0.45, 0]}>
              {selectedWorker ? (
                <group onClick={(e) => { e.stopPropagation(); setIsInventoryOpen(true); }} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'}>
                  <CharacterModel url={selectedWorker.model} />
                </group>
              ) : (
                <Html position={[0, 1.0, 0]} center>
                  <button
                    onClick={() => setIsInventoryOpen(true)}
                    className="w-20 h-20 bg-amber-200/50 backdrop-blur-sm rounded-full border-[6px] border-amber-400 flex items-center justify-center hover:bg-amber-300/80 hover:scale-110 transition-all cursor-pointer shadow-[0_0_20px_rgba(251,191,36,0.5)] group"
                  >
                    <Plus className="w-10 h-10 text-amber-700 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                  </button>
                </Html>
              )}
            </group>
          </group>

          <Lever onPull={handleLeverPull} />

          <OrbitControls
            enableZoom={false}
            enablePan={false}
            maxPolarAngle={Math.PI / 2 + 0.1}
            minPolarAngle={Math.PI / 3}
            minAzimuthAngle={-0.3}
            maxAzimuthAngle={0.3}
          />
        </Canvas>
      </div>

      {isInventoryOpen && (
        <div className="absolute inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 z-50 flex flex-col border-l-4 border-slate-200 animate-[slideInRight_0.3s_ease-out]">
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-200">
            <h2 className="text-2xl font-black text-slate-800">보유 인력 (인벤토리)</h2>
            <button onClick={() => setIsInventoryOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xl cursor-pointer">X</button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
            {MOCK_INVENTORY.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.owned > 0) {
                    setSelectedWorker(item);
                    setIsInventoryOpen(false);
                  }
                }}
                className={`w-full text-left rounded-3xl border-[4px] p-5 flex justify-between items-center transition-all ${item.owned > 0
                    ? "bg-white border-slate-200 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                    : "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed grayscale"
                  }`}
              >
                <div>
                  <h3 className="text-xl font-black text-slate-800">{item.name}</h3>
                  <p className="text-md font-bold text-amber-600 mt-1">Lv. {item.level}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-400 font-bold mb-1">보유량</span>
                  <span className={`text-2xl font-black ${item.owned > 0 ? "text-slate-800" : "text-rose-500"}`}>
                    {item.owned} / {item.maxOwned}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}
