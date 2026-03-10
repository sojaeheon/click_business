import React, { useState, useEffect, Suspense } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Stage } from "@react-three/drei";
import { useGame } from "../../app/store/gameStore";

export function MinigamePage() {
  const { closeBuildingPage } = useGame();

  // 모델 로드 헬퍼용 컴포넌트
  function BuildingModel() {
    const { scene } = useGLTF("/models/environments/car_hatchback.gltf");
    return <primitive object={scene} />;
  }

  const [gameState, setGameState] = useState<"locked" | "playing" | "success" | "failure">("locked");
  const [timeLeft, setTimeLeft] = useState(60);
  const [clicksLeft, setClicksLeft] = useState(50);
  const [shake, setShake] = useState(0);

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

  const handleUnlock = () => {
    // 💡 [백엔드 연동: 재화 차감 로직]
    setGameState("playing");
    setTimeLeft(60);
    setClicksLeft(50);
  };

  const handleRetry = () => {
    setGameState("locked");
    setTimeLeft(60);
    setClicksLeft(50);
  };

  const handleClickBuilding = () => {
    if (gameState !== "playing") return;

    // 약간의 쉐이크 이펙트 트리거
    setShake(Math.random() * 4 - 2);

    setClicksLeft((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) {
        setGameState("success");
      }
      return next;
    });

    // 짧은 시간 후 쉐이크 초기화
    setTimeout(() => setShake(0), 100);
  };

  const damagePercent = ((50 - clicksLeft) / 50) * 100;

  return (
    <div className="absolute inset-0 z-40 bg-gray-50 flex flex-col font-sans select-none overflow-hidden">
      {/* 상단 뒤로가기 (UX 편의상 추가) */}
      <div className="absolute top-6 left-6 z-[60]">
        <button
          onClick={closeBuildingPage}
          className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* 잠금 팝업 오버레이 */}
      {gameState === "locked" && (
        <div className="absolute inset-0 z-50 bg-gray-600/40 flex flex-col items-center justify-center backdrop-blur-[6px] animate-fade-in pointer-events-auto">
          {/* 자물쇠 배경 투명화 처리 및 그림자 강조 */}
          <div className="mb-24 flex items-center justify-center">
            <Lock className="w-36 h-36 text-gray-800 drop-shadow-2xl" strokeWidth={1.5} />
          </div>
          
          {/* 금액 차감 버튼 - 위치를 내리고 글꼴/여백 조정 최적화 */}
          <button
            onClick={handleUnlock}
            className="px-14 py-3.5 bg-white border-[3px] border-gray-800 rounded-full text-xl font-bold text-gray-800 hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
          >
            1000원
          </button>
        </div>
      )}

      {/* 항상 표시되는 게임 메인 화면 (잠금 시 회색빛 & 블러 처리) */}
      <div className={`flex-1 flex flex-col items-center justify-center relative z-0 transition-opacity duration-500 ${gameState === "locked" ? "opacity-30 grayscale blur-sm pointer-events-none" : ""}`}>
          
          {/* 타이머 및 클릭수 */}
          <div className="absolute top-6 right-6 flex flex-col gap-3 items-end">
            <div className="px-8 py-3 bg-white border-[3px] border-gray-800 rounded-full font-black text-xl shadow-md text-gray-800">
              남은 시간 : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
            <div className="px-8 py-3 bg-white border-[3px] border-gray-800 rounded-full font-black text-xl shadow-md text-gray-800">
              남은 클릭 수 : {clicksLeft}회
            </div>
          </div>

          {/* 중앙 모델 타겟 */}
          <button
            onClick={handleClickBuilding}
            className="relative transition-transform cursor-pointer outline-none"
            style={{
              transform: `scale(${1 - damagePercent * 0.001}) rotate(${shake}deg)`, // 전체 크기 줄어들고 쉐이크 이펙트
              filter: `brightness(${100 - damagePercent / 3}%)`,
            }}
          >
            {/* 3D 캔버스 영역 (차량 크기를 대폭 키움) */}
            <div className="w-[600px] h-[600px] relative flex items-center justify-center pointer-events-none active:scale-95 transition-transform">
              <Canvas shadows dpr={[1, 2]} camera={{ fov: 45 }}>
                <Suspense fallback={null}>
                  <Stage environment="city" intensity={0.5} adjustCamera={0.8}>
                    <BuildingModel />
                  </Stage>
                </Suspense>
              </Canvas>
              
              {/* 데미지에 따른 크랙 (금이 가는 선들) - 차량 위로 눈에 띄게 노출 */}
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ opacity: damagePercent > 10 ? 1 : 0 }}
              >
                <div className="absolute top-[10%] left-[35%] w-2 h-48 bg-gray-900 transform -rotate-[25deg] origin-top-left" />
              </div>
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ opacity: damagePercent > 30 ? 1 : 0 }}
              >
                <div className="absolute top-[25%] right-[10%] w-56 h-2 bg-gray-900 transform rotate-[15deg] origin-top-right" />
                <div className="absolute top-[45%] right-[25%] w-2 h-32 bg-gray-900 transform rotate-[45deg] origin-bottom-right" />
              </div>
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ opacity: damagePercent > 50 ? 1 : 0 }}
              >
                <div className="absolute bottom-[10%] left-[25%] w-2 h-56 bg-gray-900 transform rotate-[35deg] origin-bottom-left" />
                <div className="absolute bottom-[25%] left-[30%] w-32 h-2 bg-gray-900 transform rotate-[15deg] origin-bottom-left" />
              </div>
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ opacity: damagePercent > 70 ? 1 : 0 }}
              >
                <div className="absolute top-[45%] left-[5%] w-64 h-2.5 bg-gray-900 transform -rotate-[10deg] origin-top-left" />
              </div>
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ opacity: damagePercent > 85 ? 1 : 0 }}
              >
                <div className="absolute top-1/4 left-1/4 w-3.5 h-56 bg-gray-900 transform rotate-[65deg]" />
                <div className="absolute bottom-1/4 right-1/4 w-56 h-3.5 bg-gray-900 transform -rotate-[55deg]" />
              </div>
            </div>
          </button>
        </div>

      {/* 성공 팝업 */}
      {gameState === "success" && (
        <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] border-gray-800 shadow-2xl flex flex-col items-center transform scale-105 transition-transform">
            <h2 className="text-4xl font-black text-gray-800 mb-8 tracking-wider">성 공 !</h2>
            <div className="w-40 h-40 bg-yellow-50 rounded-3xl border-4 border-yellow-400 flex flex-col items-center justify-center mb-8 shadow-inner relative overflow-hidden">
               {/* 반짝임 효과 느낌 */}
              <div className="absolute inset-0 bg-gradient-to-tr from-yellow-200/30 to-white/60"></div>
              <span className="text-6xl mb-3 relative z-10 drop-shadow-md">🎁</span>
              <span className="font-bold text-yellow-800 text-lg relative z-10">아이템 획득</span>
            </div>
            <div className="w-full flex flex-col gap-4">
              <button
                onClick={handleRetry}
                className="w-full py-5 bg-blue-50 border-[3px] border-blue-400 rounded-2xl font-bold text-blue-800 text-xl hover:bg-blue-100 hover:scale-[1.02] active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                한번 더 도전하기
              </button>
              <button
                onClick={closeBuildingPage}
                className="w-full py-5 bg-gray-100 border-[3px] border-gray-300 rounded-2xl font-bold text-gray-600 text-xl hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실패 팝업 */}
      {gameState === "failure" && (
        <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] p-10 max-w-md w-full border-[6px] border-gray-800 shadow-2xl flex flex-col items-center transform scale-105 transition-transform">
            <h2 className="text-4xl font-black text-red-600 mb-8 tracking-wider">실 패 !</h2>
            <div className="w-40 h-40 bg-gray-100 rounded-3xl border-4 border-gray-300 flex flex-col items-center justify-center mb-8 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-200/50 to-transparent"></div>
              <span className="text-6xl mb-3 relative z-10 opacity-70">💦</span>
              <span className="font-bold text-gray-500 text-lg relative z-10">시간 초과</span>
            </div>
            <div className="w-full flex flex-col gap-4">
              <button
                onClick={handleRetry}
                className="w-full py-5 bg-gray-800 border-[3px] border-gray-800 rounded-2xl font-bold text-white text-xl hover:bg-gray-700 hover:scale-[1.02] active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                다시 도전하기
              </button>
              <button
                onClick={closeBuildingPage}
                className="w-full py-5 bg-gray-100 border-[3px] border-gray-300 rounded-2xl font-bold text-gray-600 text-xl hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all shadow-sm cursor-pointer"
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
