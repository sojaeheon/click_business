import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { useGame, useGameStore } from "../../store/gameStore";
import { HRAPI } from "../../api/gameApi";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { WORKER_LEVEL_NAMES, WORKER_LEVEL_ICONS, WORKER_LEVEL_IMAGES, getWorkerDefByLevel } from "../../constants/workers";
import { playSfx } from "../../utils/sfx";

// ── 강화 확률 (내부 전용) ──
const UPGRADE_TABLE: Record<number, { success: number; stay: number; down: number; reset: number }> = {
  1: { success: 0.7, stay: 0.3, down: 0.0, reset: 0 },
  2: { success: 0.5, stay: 0.35, down: 0.15, reset: 0 },
  3: { success: 0.15, stay: 0.40, down: 0.35, reset: 0.10 },
  4: { success: 0.05, stay: 0.35, down: 0.40, reset: 0.20 },
  5: { success: 0.01, stay: 0.3, down: 0.5, reset: 0.19 },
};
type UpgradeResult = "success" | "stay" | "down" | "reset";



// ── 레벨별 테두리 색상 ──
const LEVEL_COLORS: Record<number, string> = {
  1: "#6b7280", 2: "#22c55e", 3: "#3b82f6", 4: "#a855f7", 5: "#f59e0b", 6: "#ef4444",
};
const LEVEL_GLOWS: Record<number, string> = {
  1: "none", 2: "0 0 20px rgba(34,197,94,.3)", 3: "0 0 25px rgba(59,130,246,.4)",
  4: "0 0 30px rgba(168,85,247,.4)", 5: "0 0 35px rgba(245,158,11,.5)", 6: "0 0 40px rgba(239,68,68,.5)",
};

// ── 메인 페이지 ──
export function HRPage() {
  const { closeBuildingPage } = useGame();
  const slots = useGameStore(s => s.inventoryItems);
  const equippedWorkerId = useGameStore(s => s.equippedWorkerId);

  const [selected, setSelected] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  type Phase = "idle" | "charging" | "striking" | "result";
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastResult, setLastResult] = useState<{ result: UpgradeResult; newLevel: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shakeClass, setShakeClass] = useState("");

  const lv = selected?.level ?? 1;
  const isMax = lv >= 6;
  const borderColor = LEVEL_COLORS[lv] ?? "#6b7280";
  const glowStyle = LEVEL_GLOWS[lv] ?? "none";

  const countOf = useCallback((w: any) => {
    if (!w) return 0;
    return slots.filter(s => s.name === w.name && (s.level || 1) === (w.level || 1) && s.id !== equippedWorkerId).reduce((a, s) => a + (s.quantity || 1), 0);
  }, [slots, equippedWorkerId]);

  // 전체 워커를 균일+식별 키로 그룹화
  const allWorkerGroups = useMemo(() => {
    // 장착중인 일꾼 ID를 제외한 일꾼만 강화 목록에 표시
    const ws = slots.filter(i => i.type?.startsWith("worker_") && i.id !== equippedWorkerId);
    const m = new Map<string, { item: any; total: number }>();
    ws.forEach(s => {
      const k = `${s.name}_${s.level ?? 1}`;
      const e = m.get(k);
      if (e) e.total += (s.quantity || 1); else m.set(k, { item: s, total: s.quantity || 1 });
    });
    // 레벨 오름차순으로 정렬
    return [...m.values()].sort((a, b) => (a.item.level ?? 1) - (b.item.level ?? 1));
  }, [slots, equippedWorkerId]);

  // 장착중인 일꾼 (ID로 직접 찾기)
  const equippedWorkerItem = useMemo(() => {
    return slots.find(i => i.id === equippedWorkerId && i.type?.startsWith("worker_")) ?? null;
  }, [slots, equippedWorkerId]);

  // ── 강화 실행 ──
  const handleUpgrade = async () => {
    if (!selected || busy || isMax) return;
    const cnt = countOf(selected);
    if (cnt < 2) {
      useAlertStore.getState().openAlert(`동일 레벨 캐릭터 2개 필요 (현재 ${cnt}개)`, "재료 부족");
      return;
    }

    setBusy(true);
    playSfx("/audio/leveling.wav", 0.5);

    // 1) 차징 (에너지 모으는 연출)
    setPhase("charging");
    await new Promise(r => setTimeout(r, 600));

    // 2) 타격 (화면 흔들림)
    setPhase("striking");
    setShakeClass("animate-shake");
    await new Promise(r => setTimeout(r, 300));
    setShakeClass("");

    // 3) 결과 판정
    let res: { result: UpgradeResult; newLevel: number };
    try {
      const api = await HRAPI.upgradeWorker(lv);
      res = { result: api.data.result as UpgradeResult, newLevel: api.data.newLevel };
    } catch (e: any) {
      useAlertStore.getState().openAlert(e?.response?.data?.message || "서버 연동 실패. (미구현 또는 오류)", "경고");
      setPhase("idle");
      setShakeClass("");
      setBusy(false);
      return;
    }

    // 4) 결과 표시
    setLastResult(res);
    setPhase("result");

    // ★ 서버와 동기화
    // 백엔드 API에서 아이템을 소모하고 결과를 저장했을 것이므로, 프론트엔드는 서버 데이터를 그대로 땡겨옴
    await useGameStore.getState().fetchCompanyData(1);

    // 유저 피드백: "강화 성공 시에도 기존 캐릭터 화면을 그대로 유지하고, 다음 레벨은 유저가 직접 변경하게 해달라"
    // 따라서 setSelected를 통한 자동 레벨업 추적이나 팝업 강제종료를 수행하지 않습니다.
    // 기존 선택된(lower level) 캐릭터가 남아 수량이 차감된 것(예: 0/2)을 화면에 그대로 보여줍니다.

    setTimeout(() => { setPhase("idle"); setLastResult(null); setBusy(false); }, 1800);
  };

  const def = selected ? getWorkerDefByLevel(lv) : null;

  return (
    <div className={`absolute inset-0 z-40 overflow-hidden ${shakeClass}`} style={{ background: "radial-gradient(ellipse at 50% 120%, #1a0f0a 0%, #0d0d14 50%, #05050a 100%)" }}>

      {/* ── 스타일 ── */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity:.6 } 100% { transform: scale(1.8); opacity:0 } }
        @keyframes charge-glow { 0% { filter: brightness(1) } 50% { filter: brightness(1.8) saturate(1.5) } 100% { filter: brightness(1) } }
        @keyframes strike-flash { 0% { opacity:1 } 100% { opacity:0 } }
        @keyframes shake { 0%,100% { transform: translateX(0) } 10% { transform: translateX(-8px) } 20% { transform: translateX(8px) } 30% { transform: translateX(-6px) } 40% { transform: translateX(6px) } 50% { transform: translateX(-4px) } 60% { transform: translateX(4px) } }
        @keyframes result-pop { 0% { transform: scale(0); opacity:0 } 60% { transform: scale(1.2); opacity:1 } 100% { transform: scale(1) } }
        @keyframes confetti { 0% { transform: translateY(0) rotate(0); opacity:1 } 100% { transform: translateY(60vh) rotate(720deg); opacity:0 } }
        @keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }
        @keyframes ember { 0% { transform: translateY(0) scale(1); opacity:.8 } 100% { transform: translateY(-60px) scale(0); opacity:0 } }
        @keyframes pulse-border { 0%, 100% { border-color: rgba(52, 211, 153, 0.4); opacity: 0.6; } 50% { border-color: rgba(52, 211, 153, 1); opacity: 1; } }
        .animate-pulse-border { animation: pulse-border 2s ease-in-out infinite; }
        .animate-shake { animation: shake .5s ease-in-out; }
        .ember { position:absolute; width:4px; height:4px; border-radius:50%; background:#f59e0b; animation: ember 1.5s ease-out forwards; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-shimmer { background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%); background-size: 200% 100%; animation: shimmer 2s infinite linear; }
      `}</style>

      {/* ── 배경 파티클 (불씨) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            background: `hsl(${25 + Math.random() * 20}, 90%, ${50 + Math.random() * 30}%)`,
            left: `${10 + Math.random() * 80}%`,
            bottom: `${Math.random() * 30}%`,
            opacity: 0.3 + Math.random() * 0.4,
            animation: `ember ${3 + Math.random() * 4}s ease-out ${Math.random() * 3}s infinite`,
          }} />
        ))}
      </div>

      {/* ── 뒤로가기 ── */}
      <BackButton onClick={closeBuildingPage} className="absolute top-6 left-6 z-50" />

      {/* ════════════════════════════════════════════════
          중앙: 강화 스테이지
         ════════════════════════════════════════════════ */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 -mt-12">

          {/* 캐릭터 카드 */}
          {selected ? (
            <div className="relative flex flex-col items-center">
              {/* 펄스 링 (차징 중) */}
              {phase === "charging" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-52 h-52 rounded-full border-2 opacity-60" style={{ borderColor: borderColor, animation: "pulse-ring 1s ease-out infinite" }} />
                  <div className="absolute w-52 h-52 rounded-full border-2 opacity-40" style={{ borderColor: borderColor, animation: "pulse-ring 1s ease-out .3s infinite" }} />
                </div>
              )}

              {/* 타격 플래시 */}
              {phase === "striking" && (
                <div className="absolute inset-0 -m-20 bg-white rounded-full" style={{ animation: "strike-flash .5s ease-out forwards" }} />
              )}

              {/* 메인 캐릭터 디스플레이 */}
              <div
                className="relative w-44 h-44 rounded-3xl flex items-center justify-center cursor-pointer transition-all duration-500"
                onClick={() => setPanelOpen(true)}
                style={{
                  background: `linear-gradient(135deg, ${borderColor}15 0%, ${borderColor}08 100%)`,
                  border: `3px solid ${borderColor}`,
                  boxShadow: glowStyle,
                  animation: phase === "charging" ? "charge-glow 1s ease-in-out infinite" : phase === "idle" ? "float 3s ease-in-out infinite" : "none",
                }}
              >
                <img
                  src={WORKER_LEVEL_IMAGES[lv] ?? WORKER_LEVEL_IMAGES[1]}
                  alt={`Lv.${lv} 일꾼`}
                  className="w-24 h-24 object-contain select-none drop-shadow-2xl"
                  style={{ filter: phase === "striking" ? "brightness(2) saturate(0)" : "none", transition: "filter .2s" }}
                />

                {/* 레벨 뱃지 */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-1 rounded-full font-black text-white text-sm tracking-wider" style={{ background: borderColor, boxShadow: `0 4px 12px ${borderColor}60` }}>
                  Lv.{lv}
                </div>
              </div>

              {/* 캐릭터 이름 */}
              <div className="mt-6 text-center">
                <h2 className="text-2xl font-black text-white tracking-tight">{def?.displayName}</h2>
                <p className="text-sm font-bold mt-1" style={{ color: `${borderColor}cc` }}>{WORKER_LEVEL_NAMES[lv]} 등급</p>
              </div>

              {/* 보유 수량 */}
              <div className="mt-3 flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2">
                <span className="text-xs text-white/40 font-bold">보유</span>
                <span className={`text-lg font-black ${countOf(selected) >= 2 ? "text-emerald-400" : "text-rose-400"}`}>
                  {countOf(selected)}
                </span>
                <span className="text-white/20 font-bold">/ 2</span>
              </div>

              {/* 변경 버튼 */}
              <button
                onClick={() => setPanelOpen(true)}
                className="mt-3 text-white/40 hover:text-white/70 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                캐릭터 변경 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            /* 미선택 상태 */
            <div className="flex flex-col items-center gap-6">
              <div
                className="w-44 h-44 rounded-3xl border-2 border-dashed border-emerald-500/60 flex items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-500/10 hover:shadow-[0_0_35px_rgba(16,185,129,0.3)] transition-all group scale-110 mb-2 animate-pulse-border"
                onClick={() => setPanelOpen(true)}
              >
                <div className="relative">
                  <Sparkles className="w-16 h-16 text-emerald-400 opacity-100 group-hover:scale-125 transition-all duration-500 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                </div>
              </div>
              <button
                onClick={() => setPanelOpen(true)}
                className="text-white/90 hover:text-white font-black text-xl cursor-pointer transition-colors flex items-center gap-2 drop-shadow-lg"
              >
                강화할 캐릭터 선택 <ChevronRight className="w-6 h-6 text-emerald-400" />
              </button>
            </div>
          )}

          {/* ── 강화 버튼 (앤빌 스타일) ── */}
          {selected && !isMax && (() => {
            const cnt = countOf(selected);
            const canUpgrade = cnt >= 2;
            const isDisabled = busy || !canUpgrade;
            return (
              <button
                onClick={handleUpgrade}
                disabled={isDisabled}
                className={`relative group px-12 py-5 rounded-2xl font-black text-xl transition-all select-none
                  ${busy
                    ? "bg-gray-700 text-gray-500 cursor-wait"
                    : !canUpgrade
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed opacity-60"
                      : "bg-gradient-to-b from-amber-500 to-amber-700 text-white hover:from-amber-400 hover:to-amber-600 active:scale-95 cursor-pointer shadow-[0_8px_0_rgb(146,64,14)] hover:shadow-[0_6px_0_rgb(146,64,14)]"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className={`w-6 h-6 ${(!busy && canUpgrade) ? "group-hover:animate-spin" : ""}`} />
                  {busy ? "강화 중..." : !canUpgrade ? `⚒️ 재료 부족 (${cnt}/2)` : "⚒️ 강화 시도"}
                </div>
              </button>
            );
          })()}

          {selected && isMax && (
            <div className="px-8 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-lg flex items-center gap-2">
              👑 최대 레벨 달성
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          결과 오버레이
         ════════════════════════════════════════════════ */}
      {phase === "result" && lastResult && (() => {
        const c = {
          success: { text: "LEVEL UP!", emoji: "🎉", color: "#f59e0b", bg: "rgba(0,0,0,0.85)" },
          stay: { text: "레벨 유지", emoji: "🤔", color: "#94a3b8", bg: "rgba(0,0,0,0.85)" },
          down: { text: "레벨 하락", emoji: "📉", color: "#ef4444", bg: "rgba(0,0,0,0.85)" },
          reset: { text: "파괴!", emoji: "💥", color: "#dc2626", bg: "rgba(0,0,0,0.85)" },
        }[lastResult.result];
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none backdrop-blur-md">
            <div className="absolute inset-0" style={{ background: c.bg }} />
            {lastResult.result === "success" && Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="absolute text-2xl" style={{ left: `${Math.random() * 100}%`, top: "-5%", animation: `confetti ${1.5 + Math.random() * 1.5}s ease-out forwards`, animationDelay: `${Math.random() * .3}s` }}>
                {["✨", "⭐", "🌟", "💫"][i % 4]}
              </div>
            ))}
            <div className="flex flex-col items-center gap-4" style={{ animation: "result-pop .5s ease-out forwards" }}>
              <span className="text-9xl">{c.emoji}</span>
              <span className="text-6xl font-black" style={{ color: c.color, textShadow: `0 0 40px ${c.color}60` }}>{c.text}</span>
              {lastResult.result !== "stay" && (
                <span className="text-2xl font-black text-white/70 mt-1">
                  → Lv.{lastResult.newLevel} {WORKER_LEVEL_NAMES[lastResult.newLevel] ?? ""}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════
          인벤토리 사이드 패널
         ════════════════════════════════════════════════ */}
      {panelOpen && (
        <div className="absolute inset-y-0 right-0 w-[380px] z-[60]" style={{ animation: "slideIn .2s ease-out" }}>
          <div className="h-full flex flex-col" style={{ background: "linear-gradient(180deg, #0f0f1a 0%, #141420 100%)", borderLeft: "1px solid rgba(255,255,255,.08)" }}>
            <div className="flex justify-between items-center p-5 pb-4 border-b border-white/8">
              <h2 className="text-lg font-black text-white">강화 가능한 캐릭터</h2>
              <button onClick={() => setPanelOpen(false)} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors">
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2 custom-scrollbar">
                {/* 강화 가능한 캐릭터 목록 */}
                {allWorkerGroups.length === 0 ? (
                  <div className="flex flex-col items-center mt-12 gap-5 px-6">
                    <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                      <span className="text-5xl drop-shadow-lg">🔒</span>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-black text-lg text-center">강화 가능한 캐릭터가 없습니다</p>
                      <p className="text-white/70 text-sm text-center leading-relaxed mt-1">미니게임에서 캐릭터를 획득하세요</p>
                    </div>
                  </div>
              ) : allWorkerGroups.map(({ item, total }) => {
                const d = getWorkerDefByLevel(item.level ?? 1);
                const itemLv = item.level ?? 1;
                const sel = selected?.name === item.name && selected?.level === item.level;
                const c = LEVEL_COLORS[itemLv] ?? "#6b7280";
                const canUpgrade = total >= 2;
                return (
                  <div
                    key={`${item.name}_${itemLv}`}
                    className="relative"
                  >
                    <button
                      onClick={() => {
                        if (!canUpgrade) return;
                        setSelected(item);
                        setPanelOpen(false);
                      }}
                      disabled={!canUpgrade}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all border-2
                        ${canUpgrade 
                          ? "cursor-pointer border-transparent hover:border-orange-500 hover:bg-orange-500/10 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]" 
                          : "cursor-not-allowed border-transparent opacity-60"
                        }`}
                      style={{
                        background: sel ? `${c}15` : "rgba(255,255,255,.03)",
                        border: `1px solid ${sel ? `${c}40` : "rgba(255,255,255,.05)"}`,
                      }}
                    >
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: `${c}15`, border: `2px solid ${c}30` }}>
                        <img
                          src={WORKER_LEVEL_IMAGES[itemLv] ?? WORKER_LEVEL_IMAGES[1]}
                          alt={d.displayName}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black truncate ${canUpgrade ? "text-white/95" : "text-white/60"}`}>{d.displayName}</p>
                        <p className="text-xs font-bold" style={{ color: canUpgrade ? `${c}` : "rgba(255,255,255,0.4)" }}>Lv.{itemLv} — {WORKER_LEVEL_NAMES[itemLv]}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-sm font-black ${canUpgrade ? "text-emerald-400" : "text-white/25"}`}>x{total}</span>
                        {!canUpgrade && (
                          <span className="text-[10px] font-bold text-rose-400/70">2개 필요</span>
                        )}
                      </div>
                    </button>

                    {/* 2개 미만 마스킹 오버레이 */}
                    {!canUpgrade && (
                      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.5px)" }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-black text-white bg-black/60 border border-white/20 px-3 py-1 rounded-full shadow-lg">🔒 {2 - total}개 부족</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── 장착중인 일꾼 섹션 ── */}
              <div className="mt-6 mb-3 px-1">
                <p className="text-xs font-black text-white/70 uppercase tracking-widest">장착중인 일꾼</p>
              </div>

              {equippedWorkerItem ? (
                <div className="relative group/equipped p-1">
                  <div
                    className="w-full flex items-center gap-4 p-5 rounded-2xl relative overflow-hidden transition-all hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)",
                      border: "2px solid rgba(234, 179, 8, 0.5)",
                      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl relative z-10" style={{ background: "rgba(234, 179, 8, 0.2)", border: "2px solid rgba(234, 179, 8, 0.4)" }}>
                      {getWorkerDefByLevel(equippedWorkerItem.level ?? 1).icon}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <p className="font-black text-lg truncate text-white">{equippedWorkerItem.name}</p>
                      <p className="text-sm font-bold text-white/90 flex items-center gap-2 mt-0.5">
                        Lv.{equippedWorkerItem.level ?? 1}
                        <span className="text-[11px] font-black text-white/70 bg-black/60 px-2 py-0.5 rounded-full border border-white/10">강화 불가</span>
                      </p>
                    </div>
                    <div className="relative z-10">
                      <span className="text-xs font-black text-amber-950 bg-amber-400 px-4 py-1.5 rounded-full border-2 border-white/20 whitespace-nowrap">장착중</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-8 px-6 rounded-2xl bg-white/10 border-2 border-dashed border-white/20 gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-3xl opacity-80">🔒</span>
                  </div>
                  <p className="text-white/90 font-black text-sm text-center">아직 장착된 일꾼이 없습니다</p>
                </div>
              )}
            </div>

            <div className="p-4 pt-3 border-t border-white/5">
              <p className="text-white/15 text-[11px] font-bold text-center">동일 레벨 캐릭터 2개를 합성하여 강화</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 하단 장식: 대장간 바닥 그라데이션 ── */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ background: "linear-gradient(0deg, rgba(180,80,20,.08) 0%, transparent 100%)" }} />
    </div>
  );
}