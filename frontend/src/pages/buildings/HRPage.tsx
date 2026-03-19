import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { useGame, useGameStore } from "../../store/gameStore";
import { HRAPI } from "../../api/gameApi";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { WORKER_LEVEL_NAMES, WORKER_LEVEL_ICONS, getWorkerDefByLevel } from "../../constants/workers";

// ── 강화 확률 (내부 전용) ──
const UPGRADE_TABLE: Record<number, { success: number; stay: number; down: number; reset: number }> = {
  1: { success: 0.45, stay: 0.55, down: 0, reset: 0 },
  2: { success: 0.30, stay: 0.45, down: 0.25, reset: 0 },
  3: { success: 0.15, stay: 0.40, down: 0.35, reset: 0.10 },
  4: { success: 0.07, stay: 0.33, down: 0.40, reset: 0.20 },
  5: { success: 0.03, stay: 0.17, down: 0.50, reset: 0.30 },
};
type UpgradeResult = "success" | "stay" | "down" | "reset";

function rollUpgrade(lv: number): { result: UpgradeResult; newLevel: number } {
  const t = UPGRADE_TABLE[lv];
  if (!t || lv >= 6) return { result: "stay", newLevel: lv };
  const r = Math.random();
  if (r < t.success) return { result: "success", newLevel: lv + 1 };
  if (r < t.success + t.stay) return { result: "stay", newLevel: lv };
  if (r < t.success + t.stay + t.down) return { result: "down", newLevel: Math.max(1, lv - 1) };
  return { result: "reset", newLevel: 1 };
}

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
    return slots.filter(s => s.name === w.name && (s.level || 1) === (w.level || 1)).reduce((a, s) => a + (s.quantity || 1), 0);
  }, [slots]);

  const eligible = useMemo(() => {
    const ws = slots.filter(i => i.type?.startsWith("worker_"));
    const m = new Map<string, { item: any; total: number }>();
    ws.forEach(s => {
      const k = `${s.name}_${s.level ?? 1}`;
      const e = m.get(k);
      if (e) e.total += (s.quantity || 1); else m.set(k, { item: s, total: s.quantity || 1 });
    });
    return [...m.values()].filter(e => e.total >= 2);
  }, [slots]);

  // ── 강화 실행 ──
  const handleUpgrade = async () => {
    if (!selected || busy || isMax) return;
    const cnt = countOf(selected);
    if (cnt < 2) {
      useAlertStore.getState().openAlert(`동일 레벨 캐릭터 2개 필요 (현재 ${cnt}개)`, "재료 부족");
      return;
    }

    setBusy(true);

    // 1) 차징 (에너지 모으는 연출)
    setPhase("charging");
    await new Promise(r => setTimeout(r, 1200));

    // 2) 타격 (화면 흔들림)
    setPhase("striking");
    setShakeClass("animate-shake");
    await new Promise(r => setTimeout(r, 600));
    setShakeClass("");

    // 3) 결과 판정
    let res: { result: UpgradeResult; newLevel: number };
    try {
      const api = await HRAPI.upgradeWorker({ companyId: 1, currentLevel: lv });
      if (api.data?.result && api.data?.newLevel != null) res = { result: api.data.result, newLevel: api.data.newLevel };
      else throw new Error();
    } catch {
      res = rollUpgrade(lv);
    }

    // 4) 결과 표시
    setLastResult(res);
    setPhase("result");
    if (res.result !== "stay") setSelected((p: any) => p ? { ...p, level: res.newLevel } : null);
    if (res.result === "reset") setTimeout(() => setSelected(null), 2000);

    setTimeout(() => { setPhase("idle"); setLastResult(null); setBusy(false); }, 2800);
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
        .animate-shake { animation: shake .5s ease-in-out; }
        .ember { position:absolute; width:4px; height:4px; border-radius:50%; background:#f59e0b; animation: ember 1.5s ease-out forwards; }
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
                <span className="text-8xl select-none" style={{ filter: phase === "striking" ? "brightness(3)" : "none", transition: "filter .2s" }}>
                  {WORKER_LEVEL_ICONS[lv] ?? "⛏️"}
                </span>

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
                className="w-44 h-44 rounded-3xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group"
                onClick={() => setPanelOpen(true)}
              >
                <span className="text-6xl opacity-20 group-hover:opacity-40 transition-opacity">⚒️</span>
              </div>
              <button
                onClick={() => setPanelOpen(true)}
                className="text-amber-400/80 hover:text-amber-400 font-black text-lg cursor-pointer transition-colors flex items-center gap-2"
              >
                강화할 캐릭터 선택 <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ── 강화 버튼 (앤빌 스타일) ── */}
          {selected && !isMax && (
            <button
              onClick={handleUpgrade}
              disabled={busy}
              className={`relative group px-12 py-5 rounded-2xl font-black text-xl transition-all cursor-pointer select-none
                ${busy
                  ? "bg-gray-700 text-gray-500 cursor-wait"
                  : "bg-gradient-to-b from-amber-500 to-amber-700 text-white hover:from-amber-400 hover:to-amber-600 active:scale-95 shadow-[0_8px_0_rgb(146,64,14)] hover:shadow-[0_6px_0_rgb(146,64,14)]"
                }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className={`w-6 h-6 ${busy ? "" : "group-hover:animate-spin"}`} />
                {busy ? "강화 중..." : "⚒️ 강화 시도"}
              </div>
            </button>
          )}

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
          success: { text: "LEVEL UP!", emoji: "🎉", color: "#f59e0b", bg: "rgba(245,158,11,.1)" },
          stay: { text: "변화 없음", emoji: "💨", color: "#94a3b8", bg: "rgba(148,163,184,.05)" },
          down: { text: "레벨 하락", emoji: "📉", color: "#ef4444", bg: "rgba(239,68,68,.08)" },
          reset: { text: "파괴!", emoji: "💥", color: "#dc2626", bg: "rgba(220,38,38,.12)" },
        }[lastResult.result];
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
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

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {eligible.length === 0 ? (
                <div className="flex flex-col items-center mt-20 gap-5">
                  <span className="text-6xl opacity-15">🔒</span>
                  <p className="text-white/30 font-bold text-sm text-center">강화 가능한 캐릭터가 없습니다</p>
                  <p className="text-white/15 text-xs text-center leading-relaxed">같은 레벨 캐릭터 2개 이상 필요</p>
                </div>
              ) : eligible.map(({ item, total }) => {
                const d = getWorkerDefByLevel(item.level ?? 1);
                const itemLv = item.level ?? 1;
                const sel = selected?.name === item.name && selected?.level === item.level;
                const c = LEVEL_COLORS[itemLv] ?? "#6b7280";
                return (
                  <button
                    key={`${item.name}_${itemLv}`}
                    onClick={() => { setSelected(item); setPanelOpen(false); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer text-left transition-all"
                    style={{
                      background: sel ? `${c}15` : "rgba(255,255,255,.03)",
                      border: `1px solid ${sel ? `${c}40` : "rgba(255,255,255,.05)"}`,
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ background: `${c}15`, border: `2px solid ${c}30` }}>
                      {d.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white/90 truncate">{d.displayName}</p>
                      <p className="text-xs font-bold" style={{ color: `${c}99` }}>Lv.{itemLv} — {WORKER_LEVEL_NAMES[itemLv]}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-emerald-400">x{total}</span>
                    </div>
                  </button>
                );
              })}
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