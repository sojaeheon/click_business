import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IsometricScene } from "../app/components/game/IsometricScene";
import { playSfx } from "../utils/sfx";
import * as THREE from "three";

// ─── 3D→2D 변환 (아이소메트릭 직교 카메라 기반) ──────────────────
// constants.ts: polarAngle=PI/3, azimuthAngle=PI/4, distance=60, zoom=40(loginMode)
const D = 60, PA = Math.PI / 3, AA = Math.PI / 4, ZOOM = 40;
const CAM_POS = new THREE.Vector3(
  D * Math.sin(PA) * Math.sin(AA),
  D * Math.cos(PA),
  D * Math.sin(PA) * Math.cos(AA),
);

function project3Dto2D(wx: number, wy: number, wz: number, vw: number, vh: number) {
  // 직교 카메라 투영: view matrix → NDC → screen
  const cam = new THREE.OrthographicCamera(-vw / 2, vw / 2, vh / 2, -vh / 2, 0.1, 1000);
  cam.position.copy(CAM_POS);
  cam.lookAt(0, 0, 0);
  cam.zoom = ZOOM;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const vec = new THREE.Vector3(wx, wy, wz).project(cam);
  return { x: (vec.x * 0.5 + 0.5) * vw, y: (-vec.y * 0.5 + 0.5) * vh };
}

// ─── 건물 3D 좌표 (BX=12, BZ=6) ────────────────────────────────
const BX = 12, BZ = 6;
const BUILDINGS: Record<string, [number, number, number]> = {
  workstation: [0, 1.5, BZ],
  market:      [BX, 1.5, BZ],
  warehouse:   [BX, 1.5, -BZ],
  minigame:    [-BX, 1.5, BZ],
  hr:          [-BX, 1.5, -BZ],
};

// ─── 온보딩 단계 (유저 요청 흐름) ───────────────────────────────
interface Step { building: string | null; title: string; message: string; image?: string; }

const STEPS: Step[] = [
  { building: null, title: "딸깍 비즈니스", message: "INTRO" },
  { building: "workstation", title: "작업장", message: "재료를 넣고 생산품을 만드는 곳이에요.\n일꾼은 필수! 레벨이 높을수록 생산이 빨라져요.", image: "/images/tutorial/workstation.png" },
  { building: "market", title: "마켓", message: "그럼 재료는 어디서 구매할까요?\n마켓에서 재료를 사고 생산품을 팔 수 있어요!", image: "/images/tutorial/market.png" },
  { building: "warehouse", title: "창고", message: "구매한 재료와 생산품이 보관돼요.", image: "/images/tutorial/warehouse.png" },
  { building: "minigame", title: "미니게임", message: "일꾼 레벨업을 위해 새 일꾼을 뽑으러 가볼까요?\n스페이스바 연타로 일꾼과 장비를 얻을 수 있어요!", image: "/images/tutorial/minigame.png" },
  { building: "hr", title: "인력소", message: "같은 레벨 일꾼 2개를 합성해 강화하세요!", image: "/images/tutorial/hr.png" },
  { building: null, title: "준비 완료!", message: "이제 산업을 선택하고 시작해볼까요?" },
];

// ─── 컴포넌트 ────────────────────────────────────────────────────
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // 화면 크기 기반 건물 2D 좌표 계산
  const spot = useMemo(() => {
    if (!current.building) return null;
    const pos = BUILDINGS[current.building];
    if (!pos) return null;
    return project3Dto2D(pos[0], pos[1], pos[2], window.innerWidth, window.innerHeight);
  }, [current.building]);

  const changeStep = useCallback((next: number) => {
    setFadeIn(false);
    setTimeout(() => { setStep(next); setFadeIn(true); playSfx("/audio/spawn.wav", 0.35); }, 250);
  }, []);

  const handleNext = () => {
    playSfx("/audio/jump.wav", 0.3);
    isLast ? navigate("/industry-selection") : changeStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 0) { playSfx("/audio/jump.wav", 0.25); changeStep(step - 1); }
  };

  const handleSkip = () => {
    playSfx("/audio/hit.wav", 0.3);
    navigate("/industry-selection");
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {/* 3D 배경 */}
      <div className="absolute inset-0">
        <IsometricScene isLoginMode={true} />
      </div>

      {/* 오버레이 (스포트라이트) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: spot
            ? `radial-gradient(ellipse 280px 240px at ${spot.x}px ${spot.y}px, transparent 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.65) 100%)`
            : "rgba(0,0,0,0.4)",
        }}
      />

      {/* 스포트라이트 링 */}
      {spot && (
        <div
          className="absolute pointer-events-none transition-all duration-700 ease-out"
          style={{ left: spot.x, top: spot.y, transform: "translate(-50%, -50%)" }}
        >
          <div className="absolute rounded-full border-2 border-cyan-400/40 animate-ping"
            style={{ width: 200, height: 160, top: -80, left: -100 }} />
          <div className="absolute rounded-full border-2 border-cyan-300/60"
            style={{ width: 200, height: 160, top: -80, left: -100,
              boxShadow: "0 0 40px rgba(34,211,238,0.2), inset 0 0 40px rgba(34,211,238,0.08)" }} />
          <div className="absolute text-xs font-bold text-cyan-300 bg-gray-900/80 border border-cyan-500/40 px-3 py-1 rounded-full whitespace-nowrap"
            style={{ top: -100, left: "50%", transform: "translateX(-50%)" }}>
            {current.title}
          </div>
        </div>
      )}

      {/* 스킵 버튼 */}
      <button onClick={handleSkip}
        className="absolute top-6 right-6 z-50 px-6 py-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-base font-bold border border-white/40 transition-all shadow-lg">
        건너뛰기 →
      </button>

      {/* 카드 */}
      {current.message === "INTRO" ? (
        /* ─── 첫 단계: 화면 중앙 큰 카드 ─── */
        <div className={`absolute inset-0 z-50 flex items-center justify-center px-4 pointer-events-none
          transition-all duration-500 ease-out ${fadeIn ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <div className="pointer-events-auto max-w-lg w-full rounded-3xl
            bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-slate-950/95
            backdrop-blur-xl shadow-[0_0_60px_rgba(34,211,238,0.15)] p-8 text-center relative overflow-hidden"
            style={{ border: "2px solid rgba(34,211,238,0.25)" }}>
            {/* 장식 라인 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            <p className="text-cyan-400/70 text-xs font-bold tracking-[0.3em] uppercase mb-3">Economy Simulation</p>
            <h1 className="text-4xl font-black text-white mb-2" style={{ textShadow: "0 0 30px rgba(34,211,238,0.3)" }}>
              딸깍 비즈니스
            </h1>
            <div className="w-16 h-0.5 bg-cyan-400/50 mx-auto my-4 rounded-full" />

            <p className="text-gray-200 text-base leading-loose">
              실제 기업은 어떻게 경제에 참여할까요?<br />
              <span className="font-bold text-cyan-300">재료를 구매</span>하고,{" "}
              <span className="font-bold text-cyan-300">가공</span>하고,{" "}
              <span className="font-bold text-cyan-300">판매</span>하는 과정을 거치겠죠?<br />
              재료는 가장 이득이 되는 타이밍에 사고 싶을 거예요!
            </p>
            <div className="w-10 h-0.5 bg-gray-600 mx-auto my-4 rounded-full" />
            <p className="text-gray-400 text-sm leading-relaxed">
              저희는 <span className="font-bold text-gray-200">기업이 어떻게 운영되고 경제에 참여하는지</span>,<br />
              이것이 어떻게 <span className="font-bold text-gray-200">시장 경제를 구성하는지</span>를 시뮬레이션했습니다.
            </p>

            <p className="text-cyan-300 font-bold text-lg mt-6" style={{ textShadow: "0 0 20px rgba(34,211,238,0.4)" }}>
              튜토리얼을 따라 게임을 진행해보세요!
            </p>
            <button onClick={handleNext}
              className="mt-5 px-10 py-3 rounded-xl text-base font-black
                         bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400
                         text-white shadow-lg shadow-cyan-600/40 hover:shadow-cyan-500/50
                         transition-all duration-200 tracking-wide">
              START →
            </button>
          </div>
        </div>
      ) : (
        /* ─── 이후 단계: 스포트라이트 위치에 따라 상단/하단 ─── */
        <div className={`absolute inset-x-0 z-50 flex justify-center px-4 pointer-events-none ${
          spot && spot.y > window.innerHeight * 0.45 ? "top-0 pt-8" : "bottom-0 pb-10"
        }`}>
          <div className={`pointer-events-auto max-w-md w-full rounded-2xl border border-cyan-500/30
            bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95
            backdrop-blur-xl shadow-2xl shadow-cyan-500/10
            transition-all duration-300 ease-out
            ${fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {current.image && (
              <div className="px-4 pt-4">
                <img src={current.image} alt={current.title}
                  className="w-full rounded-xl border border-gray-700/50 shadow-lg max-h-48 object-cover object-top" />
              </div>
            )}
            <div className="px-6 pt-4 pb-2">
              <h2 className="text-lg font-bold text-white">{current.title}</h2>
            </div>
            <div className="px-6 pb-3">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{current.message}</p>
            </div>
            <div className="px-6 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-300 ${
                    i === step ? "w-5 h-2 bg-cyan-400" : i < step ? "w-2 h-2 bg-cyan-700" : "w-2 h-2 bg-gray-600"
                  }`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button onClick={handlePrev}
                    className="px-3 py-1.5 rounded-lg text-sm bg-gray-700/60 hover:bg-gray-600/80 text-gray-300 border border-gray-600/40 transition-all">
                    ←
                  </button>
                )}
                <button onClick={handleNext}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition-all">
                  {isLast ? "시작하기 →" : "다음 →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
