import React, { useState, useEffect, Suspense, useRef } from "react";
import { Lock, Timer } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore, pickReward } from "../../store/gameStore";
import type { InventoryItem } from "../../store/gameStore";
import { MinigameAPI } from "../../api/gameApi";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";

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

  const TOTAL_CLICKS = 10;
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

  const handleUnlock = async () => {
    if (isProcessing) return;
    const { money, inventoryItems, inventoryMax } = useGameStore.getState();

    // 인벤토리 가득 찼으면 게임 결제 차단
    if (inventoryItems.length >= inventoryMax) {
      useAlertStore.getState().openAlert(
        `인벤토리가 가득 찼습니다. (${inventoryItems.length}/${inventoryMax})\n아이템을 버리거나 인벤토리를 확장한 후 이용하세요.`,
        "게임 참여 불가"
      );
      return;
    }

    if (money < 100000) {
      setShowErrorAlert(true);
      return;
    }

    setIsProcessing(true);
    try {
      useGameStore.setState((prev) => ({ money: prev.money - 100000 }));
      setGameState("playing");
      setTimeLeft(10);
      setClicksLeft(TOTAL_CLICKS);
      setIsStarted(false); // 준비 상태
    } catch (e) {
      console.error(e);
      useAlertStore.getState().openAlert("게임 입장에 실패했습니다.", "오류");
    } finally {
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

    if (buttonRef.current) {
      buttonRef.current.classList.remove("hit-shake-anim");
      void buttonRef.current.offsetWidth;
      buttonRef.current.classList.add("hit-shake-anim");
    }

    const hitX = 350;
    const hitY = 350;

    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 200;

    const newEffect = { id: Date.now(), x: hitX + offsetX, y: hitY + offsetY };
    setClickEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setClickEffects((prev) => prev.filter((ef) => ef.id !== newEffect.id));
    }, 400);

    setClicksLeft((prev) => {
      const damage = isFever ? Math.floor(Math.random() * 2) + 2 : 1;
      const next = Math.max(0, prev - damage);
      if (next === 0 && prev > 0) {
        setGameState("success");
        // 랜덤 보상 뽑기 (확률 가중치 로직 적용)
        const randomReward = pickReward();
        setRewardItem(randomReward);
        useGameStore.getState().addInventoryItem(randomReward);

        MinigameAPI.claimReward({ companyId: 1, clicks: TOTAL_CLICKS, isFever }).catch(console.error);
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
        <div className="absolute inset-0 z-50 bg-gray-950/80 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-auto">
          <div className="mb-10 flex items-center justify-center animate-bounce bg-white/10 p-10 rounded-full border-2 border-white/20">
            <Lock className="w-24 h-24 text-white drop-shadow-2xl" strokeWidth={2} />
          </div>
          <button
            onClick={handleUnlock}
            className="px-16 py-5 bg-gradient-to-b from-yellow-300 to-yellow-500 border-4 border-yellow-700 rounded-full text-2xl font-black text-yellow-950 hover:from-yellow-200 hover:to-yellow-400 active:scale-95 transition-all shadow-[0_8px_0_rgb(161,98,7)] cursor-pointer tracking-widest"
          >
            100,000원 투입
          </button>

          {/* 💡 오른쪽 조작법 패널 */}
          <div className="absolute right-32 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md rounded-2xl border-2 border-white/10 p-6 max-w-lg flex flex-col gap-4 text-left shadow-2xl whitespace-nowrap">
            <h3 className="text-xl font-black text-yellow-400 flex items-center gap-2">
              <span className="text-2xl">💡</span> 게임 조작 방법
            </h3>
            <div className="w-full h-0.5 bg-white/10"></div>
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
          className={`relative transition-transform outline-none mt-auto mb-20 ${gameState === "locked" ? "cursor-default" : "cursor-pointer"}`}
          style={{
            transform: `scale(${1 - damagePercent * 0.002})`,
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

      {/* 성공/실패 팝업 생략 (기존과 동일) */}
      {gameState === "success" && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] border-slate-800 shadow-2xl flex flex-col items-center">
            <h2 className="text-5xl font-black text-slate-800 mb-8 tracking-wider">성 공 !</h2>
            <div className="w-40 h-40 bg-yellow-50 rounded-3xl border-4 border-amber-400 flex flex-col items-center justify-center mb-8 shadow-inner">
              <span className="text-6xl mb-3 drop-shadow-md">{rewardItem ? rewardItem.icon : "🎁"}</span>
              <span className="font-bold text-amber-800 text-xl text-center break-keep leading-tight px-2">{rewardItem ? rewardItem.name : "아이템 획득"}</span>
            </div>
            <div className="w-full flex flex-col gap-4">
              <button onClick={handleRetry} className="w-full py-5 bg-blue-50 border-[3px] border-blue-400 rounded-2xl font-black text-blue-800 text-xl hover:bg-blue-100 active:scale-95 transition-all shadow-sm cursor-pointer">한번 더 도전하기</button>
              <button onClick={closeBuildingPage} className="w-full py-5 bg-slate-100 border-[3px] border-slate-300 rounded-2xl font-black text-slate-600 text-xl hover:bg-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer">나가기</button>
            </div>
          </div>
        </div>
      )}

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