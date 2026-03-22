import React, { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { useGame } from "../../../store/gameStore";

import { useAlertStore } from "../../../store/useAlertStore";
import { getWorkerIcon, WorkerCard } from "../ui/WorkerCard";
import { useGameStore } from "../../../store/gameStore";
import { getWorkerDefByLevel, WORKER_LEVEL_IMAGES, IndustryKey } from "../../../constants/workers";
import { WarehouseAPI, WorkstationAPI } from "../../../api/gameApi";

export interface ConfirmData {
  type: "building" | "workstation";
  label: string;
  action?: () => void;
  isWorking?: boolean;
  onStart?: (quantity: number, workerLevel: number) => void;
  onStop?: () => void;
}

export function GlobalDialog({ data, onClose }: { data: ConfirmData; onClose: () => void }) {
  const R: React.CSSProperties = { fontFamily: "'KerisKeduR', sans-serif" };
  const { state } = useGame();
  const [qty, setQty] = useState(1);
  const [isCollecting, setIsCollecting] = useState(false);
  const [particles, setParticles] = useState<{ id: number, x: number, y: number, tx: number, ty: number, delay: number }[]>([]);

  const { equippedWorkerId, setEquippedWorkerId, hasNewWorker, setHasNewWorker } = useGameStore();
  const slots = useGameStore(s => s.inventoryItems);

  const equippedItem = slots.find(i => i.id === equippedWorkerId);
  const equippedWorker = equippedItem ? { id: equippedItem.id, name: equippedItem.name, level: equippedItem.level || 1 } : null;

  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCollecting) onClose();
      if (e.code === "Space" && !isCollecting && data.type === "building" && data.action) {
        e.preventDefault(); data.action(); onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isCollecting, data]);

  const { resProd, batchSize } = data.type === "workstation" ? state.getIndustryItemNames() : { resProd: 1, batchSize: 10 };

  useEffect(() => {
    if (data.type === "workstation" && !data.isWorking && qty === 1) setQty(resProd);
  }, [data.type, data.isWorking, resProd]);

  const [liveMatStock, setLiveMatStock] = useState<number | null>(null);
  useEffect(() => {
    if (data.type !== "workstation") return;
    WarehouseAPI.getWarehouseItems(0).then(res => {
      const total = res.data.filter((i: any) => i.type === "material").reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
      setLiveMatStock(total);
    }).catch(() => { });
  }, [data.type]);

  // ★ 모달 내 1초 카운트다운
  const [dialogRemSec, setDialogRemSec] = useState<number | null>(null);
  useEffect(() => {
    if (data.type !== "workstation" || !data.isWorking) return;
    const wsState = state.workstationState;
    const effectiveEnd = (wsState.startTime && wsState.totalMs) ? wsState.startTime + wsState.totalMs : wsState.endTime ?? 0;
    if (effectiveEnd <= 0) return;
    const calc = () => Math.max(0, Math.ceil((effectiveEnd - Date.now()) / 1000));
    setDialogRemSec(calc());
    const tick = setInterval(() => setDialogRemSec(calc()), 1000);
    return () => clearInterval(tick);
  }, [data.type, data.isWorking, state.workstationState.startTime, state.workstationState.totalMs, state.workstationState.endTime]);

  if (data.type === "workstation") {
    const { material, product, reqMat } = state.getIndustryItemNames();
    const warehouseStock = liveMatStock ?? (state.warehouseItems.find(i => i.type === "material")?.quantity || 0);
    const wsState = state.workstationState;

    const laps = Math.floor(qty / resProd);
    const totalMaterial = laps * reqMat;
    const totalProduced = laps * resProd;

    // ✅ 속도 가중치: 백엔드에서 받은 값 우선, 없으면 로컬 일꾼 정의에서 계산
    const industryName = state.industry as IndustryKey;
    let speedMult = 1.0;
    if (wsState.speedMultiplier) {
      // 백엔드에서 이미 가중치를 내려줌 (가장 정확)
      speedMult = wsState.speedMultiplier;
    } else if (equippedWorker) {
      // 폴백: 로컬 정의 기반 계산
      const def = getWorkerDefByLevel(equippedWorker.level);
      speedMult = def.speedMultiplier[industryName] || 1.0;
    }

    // ✅ 분당 생산량: 백엔드 minuteOutput 우선, 없으면 resProd(산업 기본값)
    const effMinuteOutput = wsState.minuteOutput ?? resProd;

    // 총 소요 시간(초) = (총 생산량 / 분당생산량) * 60초 / 속도가중치
    const totalSecs = effMinuteOutput > 0
      ? Math.ceil((totalProduced / effMinuteOutput) * 60 / speedMult)
      : Math.ceil((laps * 60) / speedMult);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const timeLabel = mins > 0 ? (secs === 0 ? `${mins}분` : `${mins}분 ${secs}초`) : `${secs}초`;
    const hasEnough = warehouseStock >= totalMaterial;

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm" onClick={() => !isCollecting && onClose()}>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` }} />

        <div className="bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col gap-5 border-4 border-slate-200" style={{ ...R, minWidth: 400 }} onClick={(e) => e.stopPropagation()}>

          {/* 헤더 + 일꾼 슬롯 */}
          <div className="flex items-center gap-5 border-b-2 border-slate-100 pb-5">
            <button
              onClick={() => { if (!data.isWorking) { setIsInventoryOpen(true); if (hasNewWorker) setHasNewWorker(false); } }}
              className={`relative w-[88px] h-[88px] flex flex-col items-center justify-center rounded-2xl shadow-inner border-[3px] transition-all overflow-hidden group flex-shrink-0 ${equippedWorker ? "bg-gradient-to-br from-blue-100 to-indigo-50 border-blue-300" : data.isWorking ? "bg-slate-100 border-slate-300 opacity-50 cursor-not-allowed grayscale" : "bg-slate-50 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"}`}
            >
              {equippedWorker ? (
                <>
                  <img src={WORKER_LEVEL_IMAGES[equippedWorker.level] ?? WORKER_LEVEL_IMAGES[1]} alt={equippedWorker.name} className="w-14 h-14 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                  <span className="absolute bottom-1 bg-blue-600/90 text-white font-black px-2 py-0.5 rounded text-[10px] shadow-sm">Lv.{equippedWorker.level}</span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"><UserPlus className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition-colors" /></div>
              )}
              {!data.isWorking && (<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">{equippedWorker ? "변경" : "배치"}</span></div>)}
              {hasNewWorker && !data.isWorking && !equippedWorker && (<span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-bounce pointer-events-none">NEW!</span>)}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <h2 className="text-[26px] font-black text-slate-800 tracking-widest leading-none mb-1.5">작업장</h2>
              <div className="flex items-center gap-2">
                <p className={`text-[15px] font-bold ${data.isWorking ? 'text-orange-500 animate-pulse' : 'text-slate-500'}`}>
                  {data.isWorking ? '🔥 생산 가동 중...' : (equippedWorker ? `✔️ ${equippedWorker.name} 대기 중` : '💤 일꾼을 배치해주세요')}
                </p>
                {data.isWorking && <span className="text-lg animate-[spinSlow_4s_linear_infinite]">⚙️</span>}
              </div>
            </div>
          </div>

          {/* ★ 작업 설정 (대기 중) or 진행 상황 (가동 중) */}
          {!data.isWorking ? (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 flex flex-col gap-5 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute -right-6 -top-6 text-9xl opacity-5 pointer-events-none">🏭</div>
              <div className="text-center relative z-10">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest">생산 수량 설정</label>
                <div className="text-[10px] text-slate-500 font-bold mt-0.5">분당 {resProd}개 생산 · 재료 {reqMat}개/{resProd}개당</div>
              </div>

              <div className="flex items-center justify-center gap-3 relative z-10">
                <button className="w-14 h-14 rounded-2xl bg-white border-b-4 border-2 border-slate-200 border-b-slate-300 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:translate-y-1 active:border-b-0 transition-all text-2xl shadow-sm flex items-center justify-center cursor-pointer select-none"
                  onClick={(e) => { e.stopPropagation(); setQty(q => Math.max(resProd, q - resProd)); }}>−</button>
                <div className="relative group flex-1">
                  <input type="number" min={resProd} step={resProd} value={qty}
                    onChange={e => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val >= resProd) setQty(val); else if (e.target.value === '') setQty(resProd); }}
                    onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()}
                    onFocus={e => { e.stopPropagation(); e.target.select(); }} onClick={e => e.stopPropagation()}
                    style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    className="w-full text-center text-4xl font-black border-2 border-b-4 border-slate-200 rounded-2xl py-3 bg-white text-indigo-900 focus:outline-none focus:border-indigo-400 focus:border-b-indigo-500 shadow-inner hover:border-indigo-300 transition-colors [appearance:none] [-webkit-appearance:none]"
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none"><span className="text-indigo-300 font-bold text-base select-none bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">개</span></div>
                </div>
                <button className="w-14 h-14 rounded-2xl bg-white border-b-4 border-2 border-slate-200 border-b-slate-300 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:translate-y-1 active:border-b-0 transition-all text-2xl shadow-sm flex items-center justify-center cursor-pointer select-none"
                  onClick={(e) => { e.stopPropagation(); setQty(q => q + resProd); }}>+</button>
              </div>

              <div className="flex gap-2 justify-center relative z-10 w-full px-2">
                {[{ label: `- ${batchSize}`, val: -batchSize }, { label: `+ ${batchSize}`, val: batchSize }].map((btn, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setQty(q => Math.max(1, q + btn.val)); }}
                    className="flex-1 px-1 py-2 rounded-lg text-xs font-black border-2 border-b-4 transition-all cursor-pointer select-none bg-indigo-50 text-indigo-500 border-indigo-200 border-b-indigo-300 hover:bg-indigo-100 active:translate-y-1 active:border-b-2">{btn.label}개</button>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-5 border-t-2 border-slate-200 bg-white/50 rounded-xl px-4 py-3 relative z-10 mt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5"><span className="text-lg">📦</span> 소모 재료 ({material})</span>
                  <div className={`font-black tracking-widest px-3 py-1.5 rounded-lg border-b-2 flex items-center gap-2 ${hasEnough ? 'text-indigo-600 bg-indigo-50 border-indigo-200 border-b-indigo-300' : 'text-rose-500 border-rose-200 border-b-rose-300 bg-rose-50'}`}>
                    <span>{totalMaterial}</span><span className="text-xs text-slate-300 font-bold">/</span><span className={hasEnough ? 'text-indigo-400' : 'text-rose-400'}>{warehouseStock}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5"><span className="text-lg">✨</span> 예상 수확물 ({product})</span>
                  <div className="font-black tracking-widest px-3 py-1.5 rounded-lg border-b-2 flex items-center gap-2 text-emerald-600 bg-emerald-50 border-emerald-200 border-b-emerald-300"><span>{totalProduced}개</span></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5"><span className="text-lg">⏱️</span> 예상 소요 시간</span>
                  <div className="font-black tracking-widest px-3 py-1.5 rounded-lg border-b-2 flex items-center gap-2 text-violet-600 bg-violet-50 border-violet-200 border-b-violet-300"><span>{timeLabel}</span></div>
                </div>
                {!hasEnough && (<p className="text-xs font-bold text-rose-500 mt-1 flex items-center gap-1.5 justify-center animate-pulse bg-rose-100/50 py-2 rounded-lg border border-rose-200">⚠️ 재료가 <strong className="text-rose-600">{totalMaterial - warehouseStock}개</strong> 더 필요해요!</p>)}
              </div>
            </div>
          ) : (
            /* ★ 가동 중: 타이머만 표시, 수령 버튼 없음 */
            <div className="bg-orange-50 rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-orange-200 gap-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 border-8 border-orange-200 rounded-full" />
                <div className="absolute inset-0 border-8 border-transparent border-t-orange-500 rounded-full animate-spin" />
                <span className="text-4xl relative z-10 animate-bounce">🏭</span>
              </div>
              <div className="text-center">
                <h3 className="text-orange-600 font-black text-xl mb-1">열심히 생산하는 중...</h3>
                <div className="flex flex-col items-center">
                  <p className="text-slate-500 font-bold text-sm">남은 시간</p>
                  <p className="text-indigo-600 font-black text-2xl tracking-widest mt-1">
                    {(() => {
                      const r = dialogRemSec ?? 0;
                      const m = Math.floor(r / 60); const s = r % 60;
                      return r > 0 ? (m > 0 ? `${m}분 ${s}초` : `${s}초`) : "잠시 후 완료";
                    })()}
                  </p>
                  <div className="mt-3 flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-orange-200 shadow-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[11px] text-slate-400 font-black">
                      {state.workstationState.producedCount} / {state.workstationState.requestedQty > 0 ? state.workstationState.requestedQty : '?'} 생산 완료
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 mt-2">
            {!data.isWorking ? (
              <button
                className={`flex-1 py-4 rounded-xl font-black text-lg transition-all shadow-lg ${(hasEnough && equippedWorker) ? 'bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white shadow-indigo-200 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                disabled={!hasEnough || !equippedWorker}
                onClick={() => { if (hasEnough && equippedWorker) { data.onStart?.(qty, equippedWorker.level); onClose(); } }}
              >
                {!equippedWorker ? "일꾼을 배치해주세요" : (!hasEnough ? "재료 부족" : "작업 시작 ▶")}
              </button>
            ) : (
              <button className="flex-1 py-4 rounded-xl bg-slate-200 text-slate-400 font-black text-lg cursor-not-allowed shadow-none" disabled>
                작업이 진행 중입니다
              </button>
            )}
            <button className="px-6 py-4 rounded-xl bg-slate-100 text-slate-500 border-2 border-slate-200 font-black hover:bg-slate-200 cursor-pointer" onClick={() => !isCollecting && onClose()}>닫기</button>
          </div>
        </div>

        {/* 인벤토리 팝업 */}
        {isInventoryOpen && (
          <div className="absolute inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 z-[200] flex flex-col border-l-4 border-slate-200 animate-[slideInRight_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-200">
              <h2 className="text-2xl font-black text-slate-800">보유 아이템</h2>
              <button onClick={() => setIsInventoryOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xl cursor-pointer">X</button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
              {!slots || slots.length === 0 ? (
                <div className="text-center text-slate-400 mt-10">인벤토리가 비어 있습니다.</div>
              ) : (
                slots.filter(item => item.type.startsWith("worker_")).map((item) => {
                  const isEquipped = item.id === equippedWorkerId;
                  return (
                    <div key={item.id} className="w-full relative">
                      <WorkerCard
                        item={item}
                        isSmall={false}
                        onClick={async () => {
                          try {
                            if (isEquipped) {
                              await useGameStore.getState().unequipWorker();
                              useAlertStore.getState().openAlert("일꾼 장착이 해제되었습니다.", "안내");
                            } else {
                              if (item.slotIndex !== undefined) {
                                await useGameStore.getState().equipWorker(item.slotIndex);
                                useAlertStore.getState().openAlert(`${item.name}이(가) 배치되었습니다.`, "배치 완료");
                              }
                            }
                          } catch (e: any) {
                            useAlertStore.getState().openAlert("장착 상태 변경에 실패했습니다.", "오류");
                          }
                          setIsInventoryOpen(false);
                        }}
                      />
                      {isEquipped && (
                        <div className="absolute inset-0 bg-black/50 border border-white/20 rounded-2xl flex flex-col items-center justify-center pointer-events-none z-10 backdrop-blur-[3px]">
                          <div className="flex items-center px-5 py-1.5 bg-white/15 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/30 mb-2 backdrop-blur-md"><span className="text-white font-black text-sm tracking-widest drop-shadow-md">장착중</span></div>
                          <p className="text-[11px] text-white/80 font-bold bg-black/60 px-3 py-1 rounded-full border border-white/10 shadow-inner drop-shadow-sm">다시 클릭하면 해제</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }` }} />
          </div>
        )}
      </div>
    );
  }

  // 일반 건물 모달
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (data.type !== "building" || !data.action) return;
    let frameId: number;
    const start = performance.now();
    const duration = 2000;
    const animate = (time: number) => {
      const passed = time - start;
      if (passed >= duration) { setProgress(100); data.action?.(); onClose(); }
      else { setProgress((passed / duration) * 100); frameId = requestAnimationFrame(animate); }
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [data, onClose]);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col items-center gap-6 min-w-[320px] border-4 border-slate-200 relative overflow-hidden" style={R} onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-3 bg-slate-100"><div className="h-full bg-indigo-500 transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} /></div>
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center border-4 border-indigo-100 shadow-inner mt-4 px-2 py-2"><span className="text-4xl animate-bounce">🏛️</span></div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xl font-black text-slate-800 text-center leading-relaxed"><span className="text-indigo-600 text-2xl">[{data.label}]</span> 입장을 보실 수 있습니다.</p>
          <p className="text-sm text-slate-500 font-bold animate-pulse">잠시 후 자동으로 입장합니다...</p>
        </div>
        <div className="flex w-full mt-2 gap-3">
          <button className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 border-2 border-slate-200 font-black text-lg hover:bg-slate-200 active:scale-95 cursor-pointer transition-colors" onClick={onClose}>취소 (ESC)</button>
          <button className="flex-1 py-4 rounded-xl bg-indigo-500 text-white font-black text-lg hover:bg-indigo-600 active:scale-95 cursor-pointer shadow-lg transition-colors" onClick={() => { setProgress(100); data.action?.(); onClose(); }}>즉시 입장 (SPACE)</button>
        </div>
      </div>
    </div>
  );
}