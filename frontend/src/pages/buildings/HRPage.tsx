import React, { useState, useRef } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useGame } from "../../app/store/gameStore";
import { Canvas } from "@react-three/fiber";
import { Html, useGLTF, useAnimations, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import Aurora from "../../app/components/ui/Aurora";

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

export function BackBtn({ onClick }: { onClick: () => void }) {
  const [err, setErr] = useState(false);
  return (
    <button onClick={onClick} className="absolute top-6 left-6 z-50 w-14 h-14 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all overflow-hidden">
      {!err ? (
        <div className="relative w-full h-full">
          <img src="/ui_icons/Button_Square_Sky.png" alt="back-bg" className="absolute inset-0 w-full h-full object-cover" />
          <img src="/ui_icons/Icon_Return.png" alt="back" className="absolute inset-0 w-8 h-8 m-auto object-contain z-10" onError={() => setErr(true)} />
        </div>
      ) : (
        <ArrowLeft className="w-8 h-8 text-slate-700" />
      )}
    </button>
  );
}

// --- 3D Components ---

function CharacterModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  return <primitive object={clone} scale={1.8} position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]} />;
}

// 아이템 창(인벤토리)에 들어갈 작은 3D 뷰어
function InventoryCanvasItem({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  return (
    <Canvas camera={{ position: [0, 2, 5], fov: 40 }} gl={{ alpha: true }} style={{ width: '100%', height: '100px', pointerEvents: 'none' }}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} />
      <primitive object={clone} position={[0, -0.8, 0]} rotation={[0, Math.PI / 4, 0]} scale={2.5} />
    </Canvas>
  );
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
  const { state, closeBuildingPage } = useGame();

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
    <div className="absolute inset-0 z-40 flex flex-col pt-8 bg-black overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <Aurora colorStops={["#7cff67", "#B19EEF", "#5227FF"]} blend={0.5} amplitude={1.0} speed={1} />
      </div>
      <BackBtn onClick={closeBuildingPage} />

      {upgradeMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white font-black text-3xl px-12 py-5 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-bounce border-4 border-amber-400">
          {upgradeMessage}
        </div>
      )}

      <div className="flex-1 w-full relative">
        {/* ortho 그래픽 카메라 및 위치 조절하여 정중앙에 아이소메트릭으로 꽉차게 설정 */}
        <Canvas shadows orthographic camera={{ position: [20, 20, 20], zoom: 55 }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 15, 10]} intensity={1.8} castShadow shadow-bias={-0.001} />

          {/* 중앙에 위치하도록 group 조정 */}
          <group position={[0, -2, 0]}>
            <group position={[0, 0, 0]}>
              <primitive object={platformScene.clone()} scale={1.8} />

              {/* 캐릭터 정보 표지판 (좌측 구석으로 분리하여 배치) */}
              <Html position={[-6, 4, 4]} center zIndexRange={[100, 0]}>
                <div className="flex flex-col items-center pointer-events-none w-64 transform scale-110">
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
          </group>

          {/* 레버 클릭 가능하도록 위치 조정 */}
          <Lever onPull={handleLeverPull} />
        </Canvas>
      </div>

      {isInventoryOpen && (
        <div className="absolute inset-y-0 right-0 w-[550px] bg-slate-900/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.4)] p-6 z-50 flex flex-col border-l-4 border-slate-700 animate-[slideInRight_0.3s_ease-out]">
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-700">
            <h2 className="text-2xl font-black text-white">보유 아이템 / 캐릭터</h2>
            <button onClick={() => setIsInventoryOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-700 flex items-center justify-center font-bold text-slate-300 text-xl cursor-pointer">X</button>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 auto-rows-max pr-2 custom-scrollbar">
            {state.warehouseItems.map((item, index) => {
              // 캐릭터/인력 아이템 식별을 위해 MOCK_INVENTORY 매핑 (실제 데이터 도입 시 로직 변경)
              const mappedWorker = MOCK_INVENTORY[index % MOCK_INVENTORY.length];
              const isWorker = item.type !== "material"; // material이 아니면 캐릭터로 간주(게임 로직에 따라 다름)

              const canSelect = isWorker && item.quantity > 0;
              const displayInfo = isWorker ? mappedWorker : null;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (canSelect && displayInfo) {
                      setSelectedWorker({ ...displayInfo, name: item.name });
                      setIsInventoryOpen(false);
                    }
                  }}
                  className={`relative flex flex-col rounded-2xl border-4 overflow-hidden transition-all ${canSelect
                    ? "bg-slate-800 border-amber-500 hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:-translate-y-1 cursor-pointer"
                    : "bg-slate-800 border-slate-600 opacity-60 cursor-not-allowed grayscale"
                    }`}
                >
                  {/* 카트라이더 식 3D/이미지 뷰어 컨테이너 */}
                  <div className="w-full h-[120px] bg-gradient-to-b from-slate-700 to-slate-800 flex items-center justify-center relative overflow-hidden">
                    {displayInfo ? (
                      <InventoryCanvasItem modelUrl={displayInfo.model} />
                    ) : (
                      <span className="text-5xl opacity-40">📦</span>
                    )}
                    <span className="absolute top-2 right-3 text-xs font-black text-white/50 bg-black/40 px-2 py-0.5 rounded-full z-10">
                      ID: {item.id}
                    </span>
                  </div>

                  {/* 정보 영역 */}
                  <div className="p-3 bg-slate-900 border-t-2 border-slate-700 flex flex-col">
                    <h3 className="text-lg font-black text-white truncate text-center mb-1">{item.name}</h3>
                    {displayInfo && (
                      <p className="text-xs font-bold text-amber-500 text-center mb-2">Lv. {displayInfo.level}</p>
                    )}
                    <div className="flex justify-between items-center bg-black/50 rounded px-3 py-1.5 mt-auto">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Owned</span>
                      <span className={`text-sm font-black ${item.quantity > 0 ? "text-emerald-400" : "text-rose-500"}`}>
                        {item.quantity} <span className="text-slate-500 text-[10px]">/{item.maxQuantity}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
