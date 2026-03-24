import React, { useState, useEffect, Suspense, useRef } from "react";
import { Lock, Timer } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../../store/gameStore";
import type { InventoryItem } from "../../store/gameStore";
import { MinigameAPI } from "../../api/gameApi";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { WORKER_LEVEL_IMAGES } from "../../constants/workers";
import { playSfx } from "../../utils/sfx";

// ✨ shadcn/ui AlertDialog 임포트 추가 (경로는 프로젝트에 맞게 확인해주세요!)
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../app/components/ui/alert-dialog";

// 🚗 거대 자동차 모델
function BuildingModel() {
  const { scene } = useGLTF("/models/environments/car_hatchback.gltf");
  const groupRef = useRef<THREE.Group>(null);
  const hasTurned = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (groupRef.current.position.z < 0) {
      groupRef.current.position.z += delta * 150;
      if (groupRef.current.position.z >= 0) {
        groupRef.current.position.z = 0;
      }
    }
    else if (!hasTurned.current) {
      const targetRotation = Math.PI / 4;
      if (groupRef.current.rotation.y < targetRotation) {
        groupRef.current.rotation.y += delta * 6;
      } else {
        groupRef.current.rotation.y = targetRotation;
        hasTurned.current = true;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, -150]} rotation={[0, 0, 0]}>
      <primitive object={scene} scale={[12, 12, 12]} position={[0, 0, 0]} />
    </group>
  );
}

export function MinigamePage() {
  const closeBuildingPage = useGameStore((state) => state.closeBuildingPage);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const TOTAL_CLICKS = 80;
  const [gameState, setGameState] = useState<"locked" | "playing" | "success" | "failure">("locked");
  const [timeLeft, setTimeLeft] = useState(10);
  const [clicksLeft, setClicksLeft] = useState(TOTAL_CLICKS);
  const [isStarted, setIsStarted] = useState(false);
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rewardItem, setRewardItem] = useState<Omit<InventoryItem, "id"> | null>(null);

  // ✨ 게임 종료 확인용 팝업 상태 추가
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // ✨ 잔액 부족 알림용 팝업 상태 추가 (alert 대체)
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  const isFever = false; // Fever 기능 삭제

  useEffect(() => {
    let timer: number;
    if (gameState === "playing" && timeLeft > 0 && isStarted) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState("failure");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isStarted]);

  // ⌨️ 스페이스바 타격 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === "playing" && e.code === "Space") {
        e.preventDefault(); // 스크롤 방지
        if (e.repeat) return; // 연속 누름(꾹 누르기) 방어
        if (!isStarted) {
          setIsStarted(true);
        }
        handleClickBuilding();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, isStarted]);

  // 🚪 뒤로가기 방지 로직 (기본 confirm 창 대체)
  const handleBackClick = () => {
    if (gameState === "playing") {
      setShowExitConfirm(true); // shadcn 팝업 열기
    } else {
      closeBuildingPage();
    }
  };

  const isProcessingRef = useRef(false);

  const handleUnlock = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    const { money, inventoryItems, inventoryMax } = useGameStore.getState();

    // 인벤토리 가득 찼으면 게임 결제 차단 (워커 슬롯 기준, 티켓 제외)
    const workerCount = inventoryItems.filter(i => i.type?.startsWith("worker_")).length;
    if (workerCount >= inventoryMax) {
      useAlertStore.getState().openAlert(
        `인벤토리가 가득 찼습니다. (${workerCount}/${inventoryMax})\n아이템을 버리거나 인벤토리를 확장한 후 이용하세요.`,
        "게임 참여 불가"
      );
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    if (money < 100000) {
      setShowErrorAlert(true);
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    try {
      setGameState("playing");
      setTimeLeft(10);
      setClicksLeft(TOTAL_CLICKS);
      setIsStarted(false); // 준비 상태
    } catch (e) {
      console.error(e);
      useAlertStore.getState().openAlert("게임 입장에 실패했습니다.", "오류");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setGameState("locked");
    setTimeLeft(10);
    setClicksLeft(TOTAL_CLICKS);
    setIsStarted(false);
  };

  // 🖱️ 타격 이벤트
  const handleClickBuilding = () => {
    if (gameState !== "playing") return;

    playSfx("/audio/hit.wav", 0.4);

    if (buttonRef.current) {
      buttonRef.current.classList.remove("hit-shake-anim");
      void buttonRef.current.offsetWidth;
      buttonRef.current.classList.add("hit-shake-anim");
    }

    const hitX = 350;
    const hitY = 350;

    const newEffects = [{
      id: Date.now(),
      x: hitX + (Math.random() - 0.5) * 180,
      y: hitY + (Math.random() - 0.5) * 180,
    }];
    setClickEffects((prev) => [...prev, ...newEffects]);

    setTimeout(() => {
      setClickEffects((prev) => prev.filter((ef) => !newEffects.some(ne => ne.id === ef.id)));
    }, 500);

    setClicksLeft((prev) => {
      const damage = isFever ? Math.floor(Math.random() * 2) + 2 : 1;
      const next = Math.max(0, prev - damage);
      if (next === 0 && prev > 0) {
        setGameState("success");
        setIsProcessing(true);
        
        MinigameAPI.claimReward({ companyId: 1, clicks: TOTAL_CLICKS, isFever })
          .then((res) => {
            const data = res.data;
            let typeStr = "";
            let iconStr = "🎁";
            if (data.itemType === "EQUIPMENT") {
               typeStr = `worker_lv${data.workerLevel || 1}`;
               if (data.workerLevel === 1) iconStr = "⛏️";
               else if (data.workerLevel === 2) iconStr = "🔥";
               else if (data.workerLevel === 3) iconStr = "🔨";
               else if (data.workerLevel === 4) iconStr = "🏹";
               else if (data.workerLevel === 5) iconStr = "🌟";
               else if (data.workerLevel === 6) iconStr = "👑";
            } else {
               if (data.itemName.includes("창고")) {
                  typeStr = "ticket_warehouse";
                  iconStr = "📦";
               } else {
                  typeStr = "ticket_inventory";
                  iconStr = "🎒";
               }
            }

            // 이미지 프리로드 후 rewardItem 세팅 (이전 아이템 잔상 방지)
            const imgSrc = data.itemType === "EQUIPMENT" ? WORKER_LEVEL_IMAGES[data.workerLevel || 1] : null;
            const setReward = () => {
              setRewardItem({
                type: typeStr as any,
                name: data.itemName,
                quantity: 1,
                icon: iconStr,
                level: data.workerLevel || undefined
              });
            };
            if (imgSrc) {
              const img = new Image();
              img.src = imgSrc;
              img.onload = setReward;
              img.onerror = setReward;
            } else {
              setReward();
            }

            useGameStore.getState().fetchCompanyData(1);
          })
          .catch((err) => {
             console.error("미니게임 보상 수령 실패:", err);
             // useAlertStore.getState().openAlert(err?.response?.data?.message || "보상 처리 오류", "오류");
             // 실패해도 창 닫기나 잠금 처리 등 필요시 추가
          })
          .finally(() => {
             setIsProcessing(false);
          });
      }
      return next;
    });

    if (!isStarted) {
      setIsStarted(true);
    }
  };

  const hpPercent = (clicksLeft / TOTAL_CLICKS) * 100;
  const damagePercent = ((TOTAL_CLICKS - clicksLeft) / TOTAL_CLICKS) * 100;

  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col font-sans select-none overflow-hidden transition-colors duration-500`}
      style={{
        backgroundImage: "url('/images/minigame.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#161924'
      }}
    >
      {isFever && <div className="absolute inset-0 bg-red-950/60 pointer-events-none mix-blend-multiply transition-colors" />}

      <BackButton onClick={handleBackClick} className="absolute top-6 left-6" />

      {gameState === "locked" && (
        <div className="absolute inset-0 z-50 bg-gray-950/80 flex flex-row items-center justify-center backdrop-blur-sm pointer-events-auto px-16 gap-8">
          {/* Left spacer (mirrors right panel width) */}
          <div className="flex-1 max-w-xl" />

          {/* Center: lock + button */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="mb-10 flex items-center justify-center animate-bounce bg-white/10 p-10 rounded-full border-2 border-white/20">
              <Lock className="w-24 h-24 text-white drop-shadow-2xl" strokeWidth={2} />
            </div>
            <button
              onClick={handleUnlock}
              className="px-16 py-5 bg-gradient-to-b from-yellow-300 to-yellow-500 border-4 border-yellow-700 rounded-full text-2xl font-black text-yellow-950 hover:from-yellow-200 hover:to-yellow-400 active:scale-95 transition-all shadow-[0_8px_0_rgb(161,98,7)] cursor-pointer tracking-widest"
            >
              100,000원 투입
            </button>
          </div>

          {/* Right: 조작법 패널 */}
          <div className="flex-1 max-w-xl flex justify-end">
            <div className="bg-black/60 backdrop-blur-md rounded-2xl border-2 border-white/10 p-6 flex flex-col gap-4 text-left shadow-2xl w-full">
              <h3 className="text-xl font-black text-yellow-400 flex items-center gap-2">
                <span className="text-2xl">💡</span> 게임 조작 방법
              </h3>
              <div className="w-full h-0.5 bg-white/10" />
              <ul className="flex flex-col gap-3 text-slate-200 font-bold text-sm leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>마우스 <strong className="text-white text-base">클릭</strong>이나 <strong className="text-white text-base">스페이스바</strong>를 누르면 타이머가 시작됩니다!</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>게임이 시작된 후에는 어떤 연사 수단이든 동원하여 차를 부숴보세요 🚗🔥</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 flex flex-col items-center relative z-0 transition-all duration-500 pt-10 ${gameState === "locked" ? "opacity-100" : "opacity-100"} ${isFever ? "animate-[feverBgShake_0.1s_linear_infinite]" : ""}`}>
        <div className={`w-full max-w-3xl flex flex-col items-center gap-4 px-6 z-20 transition-opacity duration-300 ${gameState === "locked" ? "opacity-0" : "opacity-100"}`}>
          <div className={`flex items-center gap-3 px-8 py-3 rounded-full border-4 shadow-xl ${timeLeft <= 10 ? 'bg-red-600 border-red-900 text-white animate-pulse' : 'bg-slate-800 border-slate-950 text-yellow-400'}`}>
            <Timer className="w-8 h-8" />
            <span className="text-4xl font-black tracking-widest font-mono">
              00:{String(timeLeft).padStart(2, "0")}
            </span>
          </div>

          <div className="w-full flex flex-col gap-1">
            <div className="flex justify-between items-end px-2">
              <span className="text-white font-black text-2xl tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">TARGET: JUNK CAR</span>
              <span className="text-white font-bold text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{clicksLeft} / {TOTAL_CLICKS}</span>
            </div>
            <div className="w-full h-10 bg-slate-950 border-4 border-slate-300 rounded-full overflow-hidden shadow-2xl relative">
              <div
                className={`h-full transition-all duration-300 ease-out ${isFever ? 'bg-red-500' : hpPercent > 50 ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${hpPercent}%` }}
              />
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }}></div>
            </div>
          </div>
        </div>

        <button
          ref={buttonRef}
          onClick={handleClickBuilding}
          className={`relative transition-transform duration-75 active:scale-95 outline-none mt-auto mb-20 ${gameState === "locked" ? "cursor-default" : "cursor-pointer"}`}
          style={{
            filter: `brightness(${isFever ? 70 - damagePercent / 4 : 100 - damagePercent / 4}%) sepia(${isFever ? 0.8 : 0}) hue-rotate(${isFever ? -50 : 0}deg)`,
          }}
        >
          {clickEffects.map((ef) => (
            <span
              key={ef.id}
              className={`absolute z-50 text-7xl font-black pointer-events-none drop-shadow-2xl ${isFever ? 'text-yellow-300' : 'text-rose-500'}`}
              style={{ left: ef.x - 40, top: ef.y - 40, animation: 'damageFloat 0.5s ease-out forwards' }}
            >
              {isFever ? "🔥" : "💥"}
            </span>
          ))}

          <div className="w-[700px] h-[700px] relative flex items-center justify-center pointer-events-none">
            {/* ✨ 카메라 위치를 거대해진 차 크기에 맞게 [0, 8, 40]으로 뺐습니다! */}
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 5, 15], fov: 45 }}>
              <ambientLight intensity={1.5} />
              <directionalLight position={[10, 20, 10]} intensity={2} castShadow />
              <Suspense fallback={null}>
                <BuildingModel />
              </Suspense>
            </Canvas>
          </div>
        </button>
      </div>

      {/* 성공 팝업 */}
      {gameState === "success" && (() => {
        const isHighTier = rewardItem?.type?.startsWith("worker") && (rewardItem.level || 0) >= 4;
        return (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-auto overflow-hidden">
            {/* 난리 부루스 배경 이펙트 (회전하는 빛) */}
            {isHighTier && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60 mix-blend-screen">
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes spinCenter {
                    from { transform: translate(-50%, -50%) rotate(0deg); }
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                  }
                `}} />
                <div
                  style={{
                    position: 'absolute',
                    width: '400%',
                    height: '400%',
                    top: '50%',
                    left: '50%',
                    animation: 'spinCenter 3s linear infinite',
                    background: 'conic-gradient(from 0deg, transparent 0deg, rgba(252,211,77,1) 20deg, transparent 40deg, rgba(252,211,77,1) 60deg, transparent 80deg, rgba(252,211,77,1) 100deg, transparent 120deg, rgba(252,211,77,1) 140deg, transparent 160deg, rgba(252,211,77,1) 180deg, transparent 200deg, rgba(252,211,77,1) 220deg, transparent 240deg, rgba(252,211,77,1) 260deg, transparent 280deg, rgba(252,211,77,1) 300deg, transparent 320deg, rgba(252,211,77,1) 340deg, transparent 360deg)',
                  }}
                />
              </div>
            )}
            <div className={`relative bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] shadow-2xl flex flex-col items-center z-10 transition-transform ${isHighTier ? "border-amber-400 scale-[1.02] shadow-[0_0_100px_rgba(251,191,36,0.8)]" : "border-slate-800"}`}>
              
              {/* 장식 이모지 */}
              {isHighTier && (
                <>
                  <div className="absolute -top-14 left-0 right-0 flex justify-center text-7xl animate-[bounce_0.5s_infinite]">🎉</div>
                  <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-6xl animate-ping">✨</div>
                  <div className="absolute -right-12 top-1/2 -translate-y-1/2 text-6xl animate-pulse">🔥</div>
                </>
              )}

              <h2 className={`text-5xl font-black mb-8 tracking-wider drop-shadow-md ${isHighTier ? "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 animate-pulse" : "text-slate-800"}`}>
                {isHighTier ? "⭐대성공⭐" : "성 공 !"}
              </h2>
              
              <div className={`w-40 h-40 bg-slate-50 rounded-3xl border-4 flex flex-col items-center justify-center mb-8 shadow-inner relative ${isHighTier ? "border-red-500 bg-yellow-100" : "border-amber-400"}`}>
                {isHighTier && <div className="absolute inset-0 bg-yellow-400/30 animate-pulse pointer-events-none rounded-3xl" />}
                
                <div className={`flex items-center justify-center h-24 mb-2 z-10 ${isHighTier ? "scale-125 transition-transform drop-shadow-[0_10px_10px_rgba(220,38,38,0.6)]" : "drop-shadow-md"}`}>
                  {rewardItem ? (
                    !rewardItem.type?.startsWith("worker") ? (
                      <span className="text-6xl">{rewardItem.icon}</span>
                    ) : (
                      <>
                        <img src={WORKER_LEVEL_IMAGES[rewardItem.level || 1]} alt={rewardItem.name} className="w-24 h-24 object-contain" />
                        <span className={`absolute -top-3 -left-3 px-3 py-1 font-black text-xs rounded-full shadow-lg ${isHighTier ? "bg-red-600 border-2 border-red-300 text-yellow-300 animate-pulse scale-110" : "bg-slate-800 text-yellow-400 border border-slate-600"}`}>
                          Lv.{rewardItem.level}
                        </span>
                      </>
                    )
                  ) : (
                    <span className="text-6xl">🎁</span>
                  )}
                </div>
                <span className={`font-bold z-10 text-center break-keep leading-tight px-2 ${isHighTier ? "text-red-700 text-2xl drop-shadow-[0_1px_2px_rgba(255,255,255,1)]" : "text-amber-800 text-xl"}`}>
                  {rewardItem ? rewardItem.name : "아이템 획득"}
                </span>
              </div>
              
              <div className="w-full flex flex-col gap-4 mt-2 relative z-20">
                <button onClick={handleRetry} className="w-full py-5 bg-blue-50 border-[3px] border-blue-400 rounded-2xl font-black text-blue-800 text-xl hover:bg-blue-100 active:scale-95 transition-all shadow-sm cursor-pointer">
                  한번 더 도전하기
                </button>
                <button onClick={closeBuildingPage} className="w-full py-5 bg-slate-100 border-[3px] border-slate-300 rounded-2xl font-black text-slate-600 text-xl hover:bg-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer">
                  나가기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {gameState === "failure" && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] border-slate-800 shadow-2xl flex flex-col items-center">
            <h2 className="text-5xl font-black text-rose-600 mb-8 tracking-wider">실 패 !</h2>
            <div className="w-40 h-40 bg-slate-100 rounded-3xl border-4 border-slate-300 flex flex-col items-center justify-center mb-8 shadow-inner">
              <span className="text-6xl mb-3 opacity-70">💦</span>
              <span className="font-bold text-slate-500 text-xl">시간 초과</span>
            </div>
            <div className="w-full flex flex-col gap-4">
              <button onClick={handleRetry} className="w-full py-5 bg-slate-800 border-[3px] border-slate-800 rounded-2xl font-black text-white text-xl hover:bg-slate-700 active:scale-95 transition-all shadow-sm cursor-pointer">다시 도전하기</button>
              <button onClick={closeBuildingPage} className="w-full py-5 bg-slate-100 border-[3px] border-slate-300 rounded-2xl font-black text-slate-600 text-xl hover:bg-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer">나가기</button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ✨ shadcn/ui: 게임 종료 경고 팝업 (기존 confirm 창 대체) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent className="z-[999] border-4 border-slate-800 rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <span className="text-3xl">⚠️</span> 게임을 종료하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-bold text-slate-600 leading-relaxed mt-4">
              지금 나가시면 투입된 금액 <span className="text-rose-500 font-black">100,000원</span>은 환불되지 않습니다.<br />
              정말 포기하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel className="flex-1 font-bold border-2 border-slate-300 hover:bg-slate-100 py-4 text-lg rounded-xl cursor-pointer">
              계속하기
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={closeBuildingPage}
              className="flex-1 font-bold bg-rose-500 text-white hover:bg-rose-600 py-4 text-lg rounded-xl cursor-pointer"
            >
              포기하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ✨ shadcn/ui: 잔액 부족 경고 팝업 (기존 alert 창 대체) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AlertDialog open={showErrorAlert} onOpenChange={setShowErrorAlert}>
        <AlertDialogContent className="border-4 border-slate-800 rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <span className="text-3xl">💰</span> 잔액이 부족합니다!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-bold text-slate-600 leading-relaxed mt-4">
              게임을 시작하려면 100,000원이 필요합니다.<br />
              현재 잔액: <span className="text-rose-500 font-black">{useGameStore.getState().money.toLocaleString()}원</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogAction
              onClick={() => setShowErrorAlert(false)}
              className="flex-1 font-bold bg-slate-800 text-white hover:bg-slate-700 py-4 text-lg rounded-xl cursor-pointer"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}