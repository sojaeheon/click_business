import React, { useState, useEffect, useRef, Suspense } from "react";
import { Plus } from "lucide-react";
import { useGame, useGameStore } from "../../store/gameStore";
import { Canvas } from "@react-three/fiber";
import { Html, useGLTF, OrbitControls, useAnimations, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { BackButton } from "../../app/components/ui/backbutton";
import { getWorkerIcon, getWorkerModelPath, WorkerCard } from "../../app/components/ui/WorkerCard";

function CharacterModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const clone = React.useMemo(() => scene.clone(), [scene]);
  const group = useRef<any>(null);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      const actionName = Object.keys(actions)[0];
      actions[actionName]?.play();
    }
  }, [actions]);

  // 애니메이션이 최상위 그룹의 위치를 덮어씌울 수 있으므로 wrapper 그룹으로 위치값을 제어합니다.
  return (
    <group position={[0, 0, 0]}>
      <group ref={group}>
        <primitive object={clone} scale={1} rotation={[0, 0, 0]} />
      </group>
    </group>
  );
}

function Lever({ onPull }: { onPull: () => void }) {
  const group = useRef<any>(null);
  const { scene, animations } = useGLTF("/models/props/lever.glb");
  const clone = React.useMemo(() => scene.clone(), [scene]);
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
    <group ref={group} onClick={handleClick} position={[2.8, -0.2, 2.0]} scale={1.5} rotation={[0, -Math.PI / 4, 0]}>
      <primitive object={clone} position={[0, 0, 0]} />
      <Html position={[0, 1.8, 0]} center zIndexRange={[100, 0]}>
        <div className="bg-white/90 backdrop-blur rounded-full px-4 py-1.5 font-bold text-slate-800 shadow-lg border-2 border-amber-500 text-sm pointer-events-none animate-bounce whitespace-nowrap">
          👇 강화 시도
        </div>
      </Html>
    </group>
  );
}

function PlatformModel() {
  const { scene } = useGLTF("/models/props/basemodule_B.gltf");
  const texture = useTexture("/models/props/spacebits_texture.png");
  texture.flipY = false;
  
  const clone = React.useMemo(() => {
    const c = scene.clone();
    c.traverse((node: any) => {
      if (node.isMesh) {
        node.material = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          roughness: 0.6
        });
      }
    });
    return c;
  }, [scene, texture]);

  return <primitive object={clone} scale={1} position={[0, -1, 0]} />;
}

function LevelUpEffect() {
  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-amber-400/20 mix-blend-overlay animate-pulse" />
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-5xl animate-[fall_3s_ease-out_forwards]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-10%`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        >
          ✨
        </div>
      ))}
      <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-amber-500 drop-shadow-[0_0_30px_rgba(251,191,36,0.8)] animate-[zoomIn_0.8s_ease-out_forwards]">
        LEVEL UP!
      </div>
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(360deg); opacity: 0; }
        }
        @keyframes zoomIn {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function getModelPathForWorker(name: string) {
  return getWorkerModelPath(name);
}

export function HRPage() {
  const { closeBuildingPage } = useGame();
  const slots = useGameStore(s => s.inventoryItems);

  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const getWorkerCount = (worker: any) => {
    if (!worker) return 0;
    const name = worker.name;
    const level = worker.level || 1;
    let count = 0;
    slots.forEach(s => {
      const sName = s.name;
      const sLevel = s.level || 1;
      const qty = s.quantity || 1;
      if (sName === name && sLevel === level) {
        count += qty;
      }
    });
    return count;
  };

  const handleLeverPull = () => {
    if (!selectedWorker) {
      setUpgradeMessage("강화할 캐릭터를 선택해주세요!");
      setTimeout(() => setUpgradeMessage(null), 2000);
      return;
    }

    const count = getWorkerCount(selectedWorker);
    if (count < 2) {
      setUpgradeMessage(`동일한 레벨의 캐릭터가 2개 필요합니다! (현재 ${count}개)`);
      setTimeout(() => setUpgradeMessage(null), 2000);
      return;
    }

    const r = Math.random();
    setTimeout(() => {
      if (r < 0.7) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
        setSelectedWorker({ ...selectedWorker, level: (selectedWorker.level || 1) + 1 });
      } else if (r < 0.85) {
        setUpgradeMessage("💦 변화가 없습니다 (유지)");
      } else if (r < 0.95) {
        setUpgradeMessage(`🔻 강화 실패... 레벨 하락`);
        setSelectedWorker({ ...selectedWorker, level: Math.max(1, (selectedWorker.level || 1) - 1) });
      } else {
        setUpgradeMessage("🔥 캐릭터가 파괴되었습니다!");
        setSelectedWorker(null);
      }
      setTimeout(() => setUpgradeMessage(null), 3000);
    }, 1000);
  };

  // const { scene: platformScene } = useGLTF("/models/props/platform.glb");

  const workerCount = getWorkerCount(selectedWorker);

  return (
    <div className="absolute inset-0 z-40 flex flex-col pt-8">
      {/* 배경 컨테이너 - 이미지에만 블러 적용 */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/images/HR.png')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: '#cddeed',
          filter: 'blur(4px)'
        }}
      />

      <BackButton onClick={closeBuildingPage} className="absolute top-6 left-6 z-50" />

      {upgradeMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white font-black text-2xl px-10 py-4 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-bounce border-4 border-amber-400 z-[60]">
          {upgradeMessage}
        </div>
      )}

      {showLevelUp && <LevelUpEffect />}

      {/* 캔버스 래퍼 - 더 넓고 크게 배치 & 정면 응시 */}
      <div className="absolute flex justify-center items-end bottom-4 left-0 right-0 h-[80%] pointer-events-none">
        <div className="w-[1000px] h-[800px] pointer-events-auto relative">

          {/* 캐릭터 선택 정보창 */}
          {selectedWorker && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-8 py-4 rounded-3xl border-2 border-slate-600 shadow-xl flex gap-6 items-center z-10 text-white">
              <div>
                <h2 className="text-3xl font-black text-amber-400">{selectedWorker.name}</h2>
                <p className="text-xl font-bold">Lv. {selectedWorker.level || 1}</p>
              </div>
              <div className="h-10 w-px bg-slate-600"></div>
              <div className="flex flex-col items-center cursor-help" title="강화 시 2개의 동일 캐릭터가 소모(합성)됩니다.">
                <span className="text-slate-300 text-sm font-bold">보유 수량</span>
                <span className={`text-2xl font-black ${workerCount >= 2 ? 'text-emerald-400' : 'text-rose-400'}`}>{workerCount} / 2</span>
              </div>
            </div>
          )}

          <Canvas shadows camera={{ position: [0, 1.0, 9], fov: 35 }}>
            <ambientLight intensity={1.2} />
            <directionalLight position={[10, 15, 10]} intensity={1.8} castShadow shadow-bias={-0.001} />

            <Suspense fallback={null}>
              <group position={[-1.5, -0.5, 0]}>
                {/* 플랫폼 */}
                <PlatformModel />

                <group position={[0, -1.0, 0]}>
                  {selectedWorker ? (
                    <group onClick={(e) => { e.stopPropagation(); setIsInventoryOpen(true); }} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'}>
                      <CharacterModel url={getModelPathForWorker(selectedWorker.name)} />
                    </group>
                  ) : (
                    <Html position={[0, 0.8, 0]} center zIndexRange={[100, 0]}>
                      <button
                        onClick={() => setIsInventoryOpen(true)}
                        className="w-24 h-24 bg-amber-200/50 backdrop-blur-sm rounded-full border-[6px] border-amber-400 flex items-center justify-center hover:bg-amber-300/80 hover:scale-110 transition-all cursor-pointer shadow-[0_0_20px_rgba(251,191,36,0.5)] group"
                      >
                        <Plus className="w-12 h-12 text-amber-700 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                      </button>
                    </Html>
                  )}
                </group>
              </group>

              {/* Lever 추가 */}
              <Lever onPull={handleLeverPull} />
            </Suspense>

            <OrbitControls
              enableZoom={false}
              enablePan={false}
              enableRotate={false}
            />
          </Canvas>

          {/* 강화 시도 버튼 - Canvas 밖 HTML로 배치 */}
          <button
            onClick={handleLeverPull}
            className="absolute bottom-6 right-6 z-20 bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-95 text-white font-black text-xl px-8 py-4 rounded-2xl shadow-[0_6px_0_rgb(180,83,9)] border-2 border-amber-700 cursor-pointer transition-all flex items-center gap-3 animate-bounce"
          >
            <span className="text-2xl">⚒️</span> 강화 시도
          </button>
        </div>
      </div>

      {isInventoryOpen && (
        <div className="absolute inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 z-50 flex flex-col border-l-4 border-slate-200 animate-[slideInRight_0.3s_ease-out]">
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-200">
            <h2 className="text-2xl font-black text-slate-800">보유 인력 (인벤토리)</h2>
            <button onClick={() => setIsInventoryOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xl cursor-pointer">X</button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
            {!slots || slots.length === 0 ? (
              <div className="text-center text-slate-400 mt-10">인벤토리가 비어 있습니다.</div>
            ) : (
              slots.filter(item => item.type.startsWith("worker_")).map((item) => (
                <div key={item.id} className="w-full">
                  <WorkerCard
                    item={item}
                    isSmall={false}
                    onClick={() => {
                      setSelectedWorker(item);
                      setIsInventoryOpen(false);
                    }}
                  />
                  {/* 보유 개수 표시기 등 필요 시 추가 */}
                </div>
              ))
            )}
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
