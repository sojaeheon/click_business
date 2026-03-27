import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useGameStore } from "../../../store/gameStore";
import { playSfx } from "../../../utils/sfx";

// ---------------------------------------------------------------------------
// 1. Tutorial step definitions
// ---------------------------------------------------------------------------
interface TutorialStepDef {
  step: number;
  message: string;
  location: string;
  action: string;
}

const TUTORIAL_STEPS: TutorialStepDef[] = [
  { step: 0,  message: "딸깍 비즈니스에 오신 것을 환영합니다!\n이 도시에서 기업을 운영하고 돈을 벌어보세요.",               location: "overview",          action: "next" },
  { step: 1,  message: "여기는 작업장이에요.\n재료로 생산품을 만드는 곳이죠!",                                             location: "workstation",       action: "enter_workstation" },
  { step: 2,  message: "먼저 일꾼을 장착해볼까요?\n일꾼이 있어야 생산할 수 있어요.",                                       location: "workstation_modal", action: "equip_worker" },
  { step: 3,  message: "재료가 부족하네요!\n마켓에서 재료를 구매해볼까요?",                                                 location: "workstation_modal", action: "go_market" },
  { step: 4,  message: "재료는 마켓에서 구매할 수 있어요.\n최소 수량만큼 매수 주문을 넣어보세요!",                           location: "market",            action: "buy_material" },
  { step: 5,  message: "체결 완료! 구매한 재료는 창고에서 관리돼요.\n창고로 가볼까요?",                                     location: "market",            action: "go_warehouse" },
  { step: 6,  message: "재료가 들어와 있네요!\n다시 작업장으로 가볼까요?",                                                  location: "warehouse",         action: "go_workstation" },
  { step: 7,  message: "-+ 버튼으로 생산할 개수를 조절하고\n작업을 시작해보세요!",                                          location: "workstation_modal", action: "start_production" },
  { step: 8,  message: "생산이 시작됐어요!\n1랩 단위마다 중도 수령할 수도 있답니다.",                                       location: "workstation",       action: "next" },
  { step: 9,  message: "시간이 좀 걸리죠?\n캐릭터 레벨을 올리면 생산 시간을 단축할 수 있어요!",                             location: "workstation",       action: "go_minigame" },
  { step: 10, message: "미니게임으로 일꾼을 얻어보세요!\n스페이스바를 연타해서 건물을 부숴보세요!",                          location: "minigame",          action: "play_minigame" },
  { step: 11, message: "같은 레벨 캐릭터가 나왔네요!\n레벨업을 시켜볼까요?",                                               location: "minigame_result",   action: "go_hr" },
  { step: 12, message: "같은 레벨 일꾼 2개를 합성하면\n더 강한 일꾼으로 강화할 수 있어요!",                                location: "hr",                action: "upgrade_worker" },
  { step: 13, message: "레벨 2 일꾼이 됐어요!\n작업장에 장착하면 생산이 빨라져요!",                                        location: "hr",                action: "next" },
  { step: 14, message: "재료 가격은 어떻게 변할까요?\n뉴스를 보고 시장을 예측해보세요!",                                   location: "news",              action: "next" },
  { step: 15, message: "열심히 돈을 벌다 보면\n랭킹에 등재될 수 있어요!\n\n이제 본격적으로 시작해볼까요?",                  location: "ranking",           action: "finish" },
];

// ---------------------------------------------------------------------------
// 2. Action -> button label mapping
// ---------------------------------------------------------------------------
const ACTION_LABELS: Record<string, string> = {
  next:             "다음",
  enter_workstation: "작업장 들어가기",
  equip_worker:     "일꾼 장착하기",
  go_market:        "마켓으로 이동",
  buy_material:     "재료 구매하기",
  go_warehouse:     "창고로 이동",
  go_workstation:   "작업장으로 이동",
  start_production: "작업 시작하기",
  go_minigame:      "미니게임 하러가기",
  play_minigame:    "미니게임 시작",
  go_hr:            "인사과로 이동",
  upgrade_worker:   "일꾼 강화하기",
  finish:           "튜토리얼 완료!",
};

// ---------------------------------------------------------------------------
// 3. Location -> indicator position (CSS %)
//    Each location maps to a rough screen area where the spotlight / arrow
//    should point. These values are tuned for a typical 16:9 viewport.
// ---------------------------------------------------------------------------
interface IndicatorPos {
  top: string;
  left: string;
  label: string;
}

const LOCATION_INDICATORS: Record<string, IndicatorPos> = {
  overview:          { top: "40%", left: "50%", label: "도시 전경" },
  workstation:       { top: "55%", left: "35%", label: "작업장" },
  workstation_modal: { top: "50%", left: "50%", label: "작업장 UI" },
  market:            { top: "45%", left: "65%", label: "마켓" },
  warehouse:         { top: "55%", left: "55%", label: "창고" },
  minigame:          { top: "50%", left: "50%", label: "미니게임" },
  minigame_result:   { top: "50%", left: "50%", label: "미니게임 결과" },
  hr:                { top: "55%", left: "45%", label: "인사과" },
  news:              { top: "15%", left: "80%", label: "뉴스" },
  ranking:           { top: "15%", left: "70%", label: "랭킹" },
};

// ---------------------------------------------------------------------------
// 4. Component
// ---------------------------------------------------------------------------
export function TutorialOverlay() {
  // -- Store bindings -------------------------------------------------------
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const isTutorial   = useGameStore((s) => s.isTutorial);

  // Setter helpers – the store may or may not expose these yet, so we access
  // them defensively via getState() to avoid hard crashes.
  const setTutorialStep = useGameStore((s) => s.setTutorialStep);
  const endTutorial = useGameStore((s) => s.endTutorial);

  // -- Local UI state -------------------------------------------------------
  const [visible, setVisible] = useState(false);       // entrance animation
  const [fadeCard, setFadeCard] = useState(false);      // card fade-in per step
  const prevStepRef = useRef(tutorialStep);

  // Current step data
  const currentStep: TutorialStepDef | undefined = TUTORIAL_STEPS[tutorialStep];
  const indicator = currentStep ? LOCATION_INDICATORS[currentStep.location] : undefined;
  const buttonLabel = currentStep ? (ACTION_LABELS[currentStep.action] ?? "다음") : "다음";

  // -- Effects --------------------------------------------------------------
  // Mount entrance
  useEffect(() => {
    if (isTutorial) {
      requestAnimationFrame(() => setVisible(true));
      setFadeCard(true);
    } else {
      setVisible(false);
      setFadeCard(false);
    }
  }, [isTutorial]);

  // Step change: play sound + re-trigger card animation
  useEffect(() => {
    if (tutorialStep !== prevStepRef.current) {
      prevStepRef.current = tutorialStep;
      playSfx("/audio/spawn.wav", 0.4);
      setFadeCard(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFadeCard(true));
      });
    }
  }, [tutorialStep]);

  // -- Handlers -------------------------------------------------------------
  const handleNext = useCallback(() => {
    if (!currentStep) return;
    playSfx("/audio/jump.wav", 0.35);

    if (currentStep.action === "finish" || tutorialStep >= TUTORIAL_STEPS.length - 1) {
      endTutorial();
      return;
    }
    setTutorialStep(tutorialStep + 1);
  }, [currentStep, tutorialStep, setTutorialStep, endTutorial]);

  const handleSkip = useCallback(() => {
    playSfx("/audio/hit.wav", 0.3);
    endTutorial();
  }, [endTutorial]);

  // -- Step progress indicator dots -----------------------------------------
  const progressDots = useMemo(
    () =>
      TUTORIAL_STEPS.map((_, i) => (
        <span
          key={i}
          className={`inline-block rounded-full transition-all duration-300 ${
            i === tutorialStep
              ? "w-3 h-3 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]"
              : i < tutorialStep
              ? "w-2 h-2 bg-cyan-700"
              : "w-2 h-2 bg-gray-600"
          }`}
        />
      )),
    [tutorialStep],
  );

  // -- Early exit -----------------------------------------------------------
  if (!isTutorial || !currentStep) return null;

  // -- Render ---------------------------------------------------------------
  return (
    <div
      className={`fixed inset-0 z-[9999] pointer-events-auto transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      {/* ====== A. Dark overlay with radial spotlight cutout ====== */}
      <div
        className="absolute inset-0"
        style={{
          background: indicator
            ? `radial-gradient(ellipse 220px 180px at ${indicator.left} ${indicator.top}, transparent 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.72) 100%)`
            : "rgba(0,0,0,0.72)",
          transition: "background 0.6s ease",
        }}
      />

      {/* ====== B. Pulsing spotlight ring ====== */}
      {indicator && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: indicator.top,
            left: indicator.left,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Outer pulse ring */}
          <div
            className="absolute rounded-full border-2 border-cyan-400/50 animate-ping"
            style={{
              width: 200,
              height: 160,
              top: -80,
              left: -100,
            }}
          />
          {/* Inner glow ring */}
          <div
            className="absolute rounded-full border-2 border-cyan-300/70"
            style={{
              width: 200,
              height: 160,
              top: -80,
              left: -100,
              boxShadow: "0 0 30px rgba(34,211,238,0.25), inset 0 0 30px rgba(34,211,238,0.12)",
            }}
          />
          {/* Location label chip */}
          <div
            className="absolute text-xs font-bold text-cyan-300 bg-gray-900/80 border border-cyan-500/40 px-2.5 py-0.5 rounded-full whitespace-nowrap"
            style={{
              top: -100,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {indicator.label}
          </div>
        </div>
      )}

      {/* ====== C. Pulsing arrow pointing from card toward spotlight ====== */}
      {indicator && (
        <div
          className="absolute pointer-events-none flex flex-col items-center"
          style={{
            left: indicator.left,
            bottom: "28%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="animate-bounce text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          </div>
        </div>
      )}

      {/* ====== D. Skip button (top-right) ====== */}
      <button
        onClick={handleSkip}
        className="absolute top-5 right-5 flex items-center gap-1.5 px-4 py-2
          text-sm font-semibold text-gray-300 bg-gray-800/80 border border-gray-600/60
          rounded-full backdrop-blur-sm
          hover:bg-gray-700/90 hover:text-white hover:border-gray-500 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)]
          active:scale-95 transition-all duration-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 5 14 14" />
          <path d="m5 19 14-14" />
        </svg>
        스킵
      </button>

      {/* ====== E. Tutorial card (bottom-center) ====== */}
      <div
        className={`absolute left-1/2 bottom-8 -translate-x-1/2 w-[94%] max-w-lg
          transition-all duration-500 ease-out
          ${fadeCard ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        <div
          className="relative bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95
            border border-cyan-500/30 rounded-2xl p-5 pt-4 backdrop-blur-md
            shadow-[0_0_40px_rgba(0,0,0,0.6),0_0_15px_rgba(34,211,238,0.15)]"
        >
          {/* Glowing top border accent */}
          <div
            className="absolute -top-px left-8 right-8 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.6), transparent)",
            }}
          />

          {/* Speech bubble tail */}
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45
              bg-gray-900/95 border-l border-t border-cyan-500/30"
          />

          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-cyan-400/80 tracking-wider uppercase">
              Tutorial {tutorialStep + 1} / {TUTORIAL_STEPS.length}
            </span>
            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {progressDots}
            </div>
          </div>

          {/* Message */}
          <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-line mb-5 font-medium">
            {currentStep.message}
          </p>

          {/* Bottom row: step dots + action button */}
          <div className="flex items-center justify-between">
            {/* Subtle step text */}
            <span className="text-xs text-gray-500">
              {indicator?.label ?? ""}
            </span>

            {/* Action button */}
            <button
              onClick={handleNext}
              className="relative px-5 py-2 text-sm font-bold text-white rounded-xl overflow-hidden
                bg-gradient-to-r from-cyan-600 to-blue-600
                hover:from-cyan-500 hover:to-blue-500
                shadow-[0_0_18px_rgba(34,211,238,0.35)]
                hover:shadow-[0_0_25px_rgba(34,211,238,0.55)]
                active:scale-95 transition-all duration-200"
            >
              {/* Shimmer effect */}
              <span
                className="absolute inset-0 opacity-30"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)",
                  animation: "tutorialShimmer 2.5s infinite",
                }}
              />
              <span className="relative z-10 flex items-center gap-1.5">
                {buttonLabel}
                {currentStep.action !== "finish" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ====== F. Inline keyframes for shimmer animation ====== */}
      <style>{`
        @keyframes tutorialShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
