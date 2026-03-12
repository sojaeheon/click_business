import React, { useState, useEffect, Suspense, useRef } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Stage } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../../app/store/gameStore";
import { MinigameAPI } from "../../api/gameApi";

// 모델 로드 헬퍼용 컴포넌트 (드리프트 애니메이션)
function BuildingModel({ isPlaying }: { isPlaying: boolean }) {
  const { scene } = useGLTF("/models/environments/car_hatchback.gltf");
  const groupRef = useRef<THREE.Group>(null);

  // 초기 엉덩이뷰가 아닌 정면뷰를 위해 Math.PI 추가
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 계속 앞으로 반복해서 다가오는 연출 (루핑 애니메이션)
    groupRef.current.position.z += delta * 15;

    // 타격 시 흔들리는 rotation 추가 효과를 위해 기본 로테이션 적용
    // 엉덩이뷰 -> 정면으로 오게 하려면 기본 rotation y에 Math.PI
    groupRef.current.rotation.y = Math.PI;

    if (groupRef.current.position.z > 20) {
      groupRef.current.position.z = -40; // 화면 뒤로 리셋
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

export function MinigamePage() {
  const { closeBuildingPage } = useGame();

  const TOTAL_CLICKS = 100;
  const [gameState, setGameState] = useState<"locked" | "playing" | "success" | "failure">("locked");
  const [timeLeft, setTimeLeft] = useState(30);
  const [clicksLeft, setClicksLeft] = useState(TOTAL_CLICKS);
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [errImg, setErrImg] = useState(false);

  const isFever = gameState === "playing" && clicksLeft > 0 && clicksLeft <= TOTAL_CLICKS / 2;

  // 타이머 로직
  useEffect(() => {
    let timer: number;
    if (gameState === "playing" && timeLeft > 0) {
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
  }, [gameState, timeLeft]);

  const handleUnlock = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await MinigameAPI.unlockGame({ companyId: 1, amount: 1000 });
      setGameState("playing");
      setTimeLeft(30);
      setClicksLeft(TOTAL_CLICKS);
    } catch (e) {
      console.error(e);
      alert("게임 입장에 실패했습니다. 재화를 확인해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setGameState("locked");
    setTimeLeft(30);
    setClicksLeft(TOTAL_CLICKS);
  };

  const handleClickBuilding = (e: React.MouseEvent) => {
    if (gameState !== "playing") return;

    setShakeTrigger(Date.now()); // CSS 애니메이션 리트리거용

    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;
    const newEffect = { id: Date.now(), x: x + offsetX, y: y + offsetY };
    setClickEffects((prev) => [...prev, newEffect]);

    setTimeout(() => {
      setClickEffects((prev) => prev.filter((ef) => ef.id !== newEffect.id));
    }, 400);

    setClicksLeft((prev) => {
      const damage = isFever ? Math.floor(Math.random() * 2) + 2 : 1;
      const next = Math.max(0, prev - damage);
      if (next === 0 && prev > 0) {
        setGameState("success");
        MinigameAPI.claimReward({ companyId: 1, clicks: TOTAL_CLICKS, isFever }).catch(console.error);
      }
      return next;
    });
  };

  const damagePercent = ((TOTAL_CLICKS - clicksLeft) / TOTAL_CLICKS) * 100;

  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col font-sans select-none overflow-hidden transition-colors duration-500`}
      style={{
        backgroundImage: "url('/images/minigame.png')",
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#161924'
      }}
    >
      {isFever && <div className="absolute inset-0 bg-red-950/40 pointer-events-none mix-blend-multiply transition-colors" />}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes feverBgShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(3px, 3px); }
          50% { transform: translate(-3px, -3px); }
          75% { transform: translate(-3px, 3px); }
        }
        @keyframes textGlowPulse {
          0%, 100% { text-shadow: 0 0 10px #ef4444, 0 0 20px #ef4444; transform: scale(1) translateX(-50%); }
          50% { text-shadow: 0 0 20px #ef4444, 0 0 40px #ef4444, 0 0 60px #ef4444; transform: scale(1.1) translateX(-45%); }
        }
        @keyframes damageFloat {
          0% { opacity: 1; transform: translateY(0) scale(1.5) rotate(-10deg); }
          50% { transform: translateY(-30px) scale(2.5) rotate(15deg); }
          100% { opacity: 0; transform: translateY(-80px) scale(1) rotate(0deg); }
        }
        @keyframes hitShake {
          0% { transform: translate(0, 0) rotate(0); }
          20% { transform: translate(10px, -10px) rotate(2deg); }
          40% { transform: translate(-10px, 10px) rotate(-2deg); }
          60% { transform: translate(10px, 10px) rotate(2deg); }
          80% { transform: translate(-10px, -10px) rotate(-2deg); }
          100% { transform: translate(0, 0) rotate(0); }
        }
      `}} />

      {/* 상단 뒤로가기 버튼 */}
      <div className="absolute top-6 left-6 z-[60]">
        <button
          onClick={closeBuildingPage}
          className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer shadow-sm hover:scale-105 active:scale-95"
        >
          {!errImg ? (
            <img src="/ui_icons/Button_Exit_Blue.png" alt="back" className="w-10 h-10 object-contain" onError={() => setErrImg(true)} />
          ) : (
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          )}
        </button>
      </div>

      {/* 잠금 팝업 오버레이 */}
      {gameState === "locked" && (
        <div className="absolute inset-0 z-50 bg-gray-900/60 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-auto">
          {/* 자물쇠 다시 Lucide Icon 으로 변경 */}
          <div className="mb-12 flex items-center justify-center animate-bounce bg-white/20 p-8 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            <Lock className="w-32 h-32 text-white drop-shadow-2xl" strokeWidth={1.5} />
          </div>

          <button
            onClick={handleUnlock}
            className="px-14 py-4 bg-white border-[4px] border-slate-800 rounded-full text-2xl font-black text-slate-800 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-[0_10px_0_theme(colors.slate.800)] cursor-pointer tracking-widest"
          >
            1,000 원
          </button>
        </div>
      )}

      {/* 게임 화면 본체 */}
      <div className={`flex-1 flex flex-col items-center justify-center relative z-0 transition-all duration-500 ${gameState === "locked" ? "opacity-30 blur-sm pointer-events-none" : ""} ${isFever ? "animate-[feverBgShake_0.1s_linear_infinite]" : ""}`}>

        {/* 피버 텍스트 오버레이 */}
        {isFever && (
          <div
            className="absolute top-[15%] left-1/2 text-8xl font-black text-white italic z-10 pointer-events-none tracking-widest"
            style={{ animation: 'textGlowPulse 0.5s ease-in-out infinite' }}
          >
            FEVER!
          </div>
        )}

        {/* 타이머 및 클릭수 */}
        <div className="absolute top-6 right-6 flex flex-col gap-3 items-end z-20">
          <div className={`px-8 py-3 outline-none border-[3px] rounded-full font-black text-xl shadow-md transition-colors ${isFever ? 'bg-red-600 border-red-800 text-white' : 'bg-white border-gray-800 text-gray-800'}`}>
            남은 시간 : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
          <div className={`px-8 py-3 border-[3px] rounded-full font-black text-xl shadow-md transition-colors ${isFever ? 'bg-orange-500 border-orange-700 text-white' : 'bg-white border-gray-800 text-gray-800'}`}>
            HP : {clicksLeft} / {TOTAL_CLICKS}
          </div>
        </div>

        {/* 중앙 모델 타겟 */}
        <button
          onClick={handleClickBuilding}
          key={shakeTrigger} // 리렌더링마다 애니메이션 리트리거 위해 키값 설정
          className="relative transition-transform cursor-pointer outline-none"
          style={{
            transform: `scale(${1 - damagePercent * 0.003})`,
            filter: `brightness(${isFever ? 60 - damagePercent / 3 : 100 - damagePercent / 3}%) sepia(${isFever ? 0.8 : 0}) hue-rotate(${isFever ? -50 : 0}deg) saturate(${isFever ? 3 : 1})`,
            animation: shakeTrigger ? 'hitShake 0.1s ease-in-out' : 'none'
          }}
        >
          {/* 타격 이펙트 오버레이 */}
          {clickEffects.map((ef) => (
            <span
              key={ef.id}
              className={`absolute z-50 text-6xl font-black pointer-events-none drop-shadow-md ${isFever ? 'text-yellow-300' : 'text-rose-500'}`}
              style={{
                left: ef.x - 30,
                top: ef.y - 30,
                animation: 'damageFloat 0.5s ease-out forwards'
              }}
            >
              {isFever ? "🔥" : "💥"}
            </span>
          ))}

          {/* 3D 캔버스 영역 */}
          <div className="w-[600px] h-[600px] relative flex items-center justify-center pointer-events-none transition-transform">
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 5, -20], fov: 45 }}>
              <ambientLight intensity={1.5} />
              <directionalLight position={[10, 20, -10]} intensity={2} castShadow />
              <Suspense fallback={null}>
                <BuildingModel isPlaying={true} />
              </Suspense>
            </Canvas>

            {/* 데미지에 따른 크랙 */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ opacity: damagePercent > 10 ? 1 : 0 }}
            >
              <div className="absolute top-[10%] left-[35%] w-2 h-48 bg-slate-900 transform -rotate-[25deg] origin-top-left" />
            </div>
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ opacity: damagePercent > 30 ? 1 : 0 }}
            >
              <div className="absolute top-[25%] right-[10%] w-56 h-2 bg-slate-900 transform rotate-[15deg] origin-top-right" />
              <div className="absolute top-[45%] right-[25%] w-2 h-32 bg-slate-900 transform rotate-[45deg] origin-bottom-right" />
            </div>
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ opacity: damagePercent > 50 ? 1 : 0 }}
            >
              <div className="absolute bottom-[10%] left-[25%] w-2 h-56 bg-slate-900 transform rotate-[35deg] origin-bottom-left" />
              <div className="absolute bottom-[25%] left-[30%] w-32 h-2 bg-slate-900 transform rotate-[15deg] origin-bottom-left" />
            </div>
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ opacity: damagePercent > 70 ? 1 : 0 }}
            >
              <div className="absolute top-[45%] left-[5%] w-64 h-2.5 bg-slate-900 transform -rotate-[10deg] origin-top-left" />
            </div>
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ opacity: damagePercent > 85 ? 1 : 0 }}
            >
              <div className="absolute top-1/4 left-1/4 w-3.5 h-64 bg-slate-900 transform rotate-[65deg]" />
              <div className="absolute bottom-1/4 right-1/4 w-64 h-3.5 bg-slate-900 transform -rotate-[55deg]" />
            </div>
          </div>
        </button>
      </div>

      {/* 성공 팝업 */}
      {gameState === "success" && (
        <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] border-slate-800 shadow-2xl flex flex-col items-center transform scale-105 transition-transform">
            <h2 className="text-4xl font-black text-slate-800 mb-8 tracking-wider">성 공 !</h2>
            <div className="w-40 h-40 bg-yellow-50 rounded-3xl border-4 border-amber-400 flex flex-col items-center justify-center mb-8 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-200/40 to-white/60"></div>
              <span className="text-6xl mb-3 relative z-10 drop-shadow-md">🎁</span>
              <span className="font-bold text-amber-800 text-xl relative z-10">아이템 획득</span>
            </div>
            <div className="w-full flex flex-col gap-4">
              <button
                onClick={handleRetry}
                className="w-full py-5 bg-blue-50 border-[3px] border-blue-400 rounded-2xl font-black text-blue-800 text-xl hover:bg-blue-100 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                한번 더 도전하기
              </button>
              <button
                onClick={closeBuildingPage}
                className="w-full py-5 bg-slate-100 border-[3px] border-slate-300 rounded-2xl font-black text-slate-600 text-xl hover:bg-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실패 팝업 */}
      {gameState === "failure" && (
        <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] border-slate-800 shadow-2xl flex flex-col items-center transform scale-105 transition-transform">
            <h2 className="text-4xl font-black text-rose-600 mb-8 tracking-wider">실 패 !</h2>
            <div className="w-40 h-40 bg-slate-100 rounded-3xl border-4 border-slate-300 flex flex-col items-center justify-center mb-8 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-200/50 to-transparent"></div>
              <span className="text-6xl mb-3 relative z-10 opacity-70">💦</span>
              <span className="font-bold text-slate-500 text-xl relative z-10">시간 초과</span>
            </div>
            <div className="w-full flex flex-col gap-4">
              <button
                onClick={handleRetry}
                className="w-full py-5 bg-slate-800 border-[3px] border-slate-800 rounded-2xl font-black text-white text-xl hover:bg-slate-700 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                다시 도전하기
              </button>
              <button
                onClick={closeBuildingPage}
                className="w-full py-5 bg-slate-100 border-[3px] border-slate-300 rounded-2xl font-black text-slate-600 text-xl hover:bg-slate-200 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
