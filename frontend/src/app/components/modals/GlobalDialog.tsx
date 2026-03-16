import React, { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { useGame } from "../../../store/gameStore"; // ⚠️ 경로를 프로젝트에 맞게 수정해 주세요!
import { useInventoryStore } from "../../../store/useAppStore";
import { useAlertStore } from "../../../store/useAlertStore";

// 다른 곳에서도 쓸 수 있게 export 해줍니다.
export interface ConfirmData {
  type: "building" | "workstation";
  label: string;
  action?: () => void;
  isWorking?: boolean;
  onStart?: (quantity: number) => void;
  onStop?: () => void;
}

export function GlobalDialog({ data, onClose }: { data: ConfirmData; onClose: () => void }) {
  const R: React.CSSProperties = { fontFamily: "'KerisKeduR', sans-serif" };
  const { state } = useGame();
  const [qty, setQty] = useState(1);
  const [isCollecting, setIsCollecting] = useState(false);
  const [particles, setParticles] = useState<{ id: number, x: number, y: number, tx: number, ty: number, delay: number }[]>([]);

  // 장착 일꾼 데이터
  const [equippedWorker, setEquippedWorker] = useState<{id: number, name: string, level: number} | null>(null);

  const [slots, setSlots] = useState<any[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  useEffect(() => {
    // InventoryModal과 동일하게 목업 데이터를 불러옵니다.
    import("../../../api/gameApi").then(({ InventoryAPI }) => {
      InventoryAPI.getInventory(1).then(res => setSlots(res.data));
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCollecting) onClose();
      // 스페이스바 직시입장 로직 (일반 건물인 경우)
      if (e.code === "Space" && !isCollecting && data.type === "building" && data.action) {
        e.preventDefault();
        data.action();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isCollecting, data]);

  if (data.type === "workstation") {
    const materialPerUnit = 3;
    const warehouseStock = state.warehouseItems.find(i => i.type === "material")?.quantity || 0;
    const totalMaterial = qty * materialPerUnit;
    const hasEnough = warehouseStock >= totalMaterial;

    const handleCollect = (e: React.MouseEvent) => {
      setIsCollecting(true);
      const rect = (e.target as HTMLButtonElement).getBoundingClientRect();
      const newParticles = Array.from({ length: 15 }).map((_, i) => ({
        id: Date.now() + i,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        tx: (Math.random() - 0.5) * 150,
        ty: (Math.random() - 0.5) * 150 - 50,
        delay: Math.random() * 0.15
      }));
      setParticles(newParticles);

      setTimeout(() => {
        data.onStop?.();
        onClose();
      }, 1000);
    };

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm" onClick={() => !isCollecting && onClose()}>
        {particles.map((p) => (
          <React.Fragment key={p.id}>
            <style dangerouslySetInnerHTML={{
              __html: `
               @keyframes particleFly_${p.id} {
                 0% { transform: scale(0) translate(0, 0); opacity: 0; }
                 20% { transform: scale(1.5) translate(${p.tx}px, ${p.ty}px); opacity: 1; }
                 100% { transform: scale(0.5) translate(400px, -400px); opacity: 0; }
               }
             `}} />
            <div
              className="fixed w-8 h-8 bg-amber-400 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.8)] pointer-events-none z-[100] flex items-center justify-center text-xl"
              style={{
                left: p.x, top: p.y,
                animation: `particleFly_${p.id} 1s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                animationDelay: p.delay + "s"
              }}
            >
              ⭐️
            </div>
          </React.Fragment>
        ))}
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}} />

        <div className="bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col gap-5 border-4 border-slate-200" style={{ ...R, minWidth: 400 }} onClick={(e) => e.stopPropagation()}>
          
          {/* 모달 헤더 */}
          <div className="flex items-center gap-4 border-b-2 border-slate-100 pb-4">
            <div className={`w-16 h-16 flex items-center justify-center rounded-2xl shadow-inner ${data.isWorking ? 'bg-orange-100 border-2 border-orange-300' : 'bg-slate-100 border-2 border-slate-300'}`}>
              <span className={`text-4xl ${data.isWorking ? 'animate-[spinSlow_4s_linear_infinite]' : ''}`}>⚙️</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-widest">작업장</h2>
              <p className={`text-sm font-bold mt-1 ${data.isWorking ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`}>
                {data.isWorking ? '🔥 기계 가동 중...' : '💤 대기 중'}
              </p>
            </div>
          </div>

          {/* 일꾼 장착 슬롯 */}
          {!data.isWorking && (
            <div className="bg-blue-50/50 rounded-2xl p-4 border-2 border-blue-100">
              <label className="text-xs font-black text-blue-500 uppercase tracking-widest mb-2 block">담당 일꾼 배치</label>
              <button 
                onClick={() => {
                  setIsInventoryOpen(true);
                }}
                className={`w-full h-20 rounded-xl border-[3px] flex items-center px-4 cursor-pointer transition-all hover:-translate-y-1 active:scale-95 group
                  ${equippedWorker 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-600 shadow-md' 
                    : 'bg-white border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/80'
                  }`
                }
              >
                {equippedWorker ? (
                  <div className="flex items-center gap-4 w-full animate-fade-in">
                    <span className="text-4xl drop-shadow-md group-hover:scale-110 transition-transform">🧑‍🔧</span>
                    <div className="flex flex-col items-start text-white">
                      <span className="bg-blue-800/50 font-black px-2 py-0.5 rounded text-[10px] shadow-sm mb-0.5 border border-blue-400/50">
                        Lv.{equippedWorker.level}
                      </span>
                      <span className="font-bold text-lg tracking-wide">{equippedWorker.name}</span>
                    </div>
                    <span className="ml-auto text-blue-100 text-xs font-bold px-3 py-1.5 bg-black/20 rounded-lg hover:bg-black/40 transition-colors">
                      변경하기
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity w-full justify-center">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border-2 border-slate-200 group-hover:border-blue-400 group-hover:bg-blue-100">
                      <UserPlus className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <span className="text-slate-600 font-bold text-sm">클릭하여 인벤토리 열기</span>
                  </div>
                )}
              </button>
            </div>
          )}

          {/* 작업 설정 */}
          {!data.isWorking ? (
            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col gap-4 border-2 border-slate-100">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">생산 수량 설정</label>
              <div className="flex items-center gap-4">
                <button className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition-all text-xl shadow-sm cursor-pointer" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                <input
                  type="number" min={1} value={qty}
                  onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-3xl font-black border-2 border-slate-200 rounded-xl py-2 bg-white text-slate-800 focus:outline-none focus:border-indigo-400"
                />
                <button className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition-all text-xl shadow-sm cursor-pointer" onClick={() => setQty(q => q + 1)}>+</button>
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t-2 border-slate-200 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-500">필요 재료</span>
                  <span className={`${hasEnough ? 'text-slate-800' : 'text-rose-500'}`}>{totalMaterial}개</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-500">창고 재고</span>
                  <span className="text-slate-800">{warehouseStock}개</span>
                </div>
                {!hasEnough && (
                  <p className="text-xs font-bold text-rose-500 mt-2 bg-rose-50 border-2 border-rose-100 rounded-xl p-3">
                    ⚠️ 재료가 부족합니다. ({totalMaterial - warehouseStock}개 더 필요)
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-orange-200 gap-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 border-8 border-orange-200 rounded-full" />
                <div className="absolute inset-0 border-8 border-transparent border-t-orange-500 rounded-full animate-spin" />
                <span className="text-4xl relative z-10 animate-bounce">🎁</span>
              </div>
              <span className="text-orange-600 font-black tracking-widest text-lg">생산이 완료되었습니다!</span>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 mt-2">
            {!data.isWorking ? (
              <button
                className={`flex-1 py-4 rounded-xl font-black text-lg transition-all shadow-lg ${hasEnough ? 'bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white shadow-indigo-200 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                disabled={!hasEnough}
                onClick={() => { if (hasEnough) { data.onStart?.(qty); onClose(); } }}
              >작업 시작 ▶</button>
            ) : (
              <button
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-white font-black text-lg hover:from-emerald-500 active:scale-95 cursor-pointer shadow-lg shadow-emerald-200"
                onClick={handleCollect}
              >결과물 수령</button>
            )}
            <button className="px-6 py-4 rounded-xl bg-slate-100 text-slate-500 border-2 border-slate-200 font-black hover:bg-slate-200 cursor-pointer" onClick={() => !isCollecting && onClose()}>닫기</button>
          </div>
        </div>

        {/* 인벤토리 오른쪽 팝업 */}
        {isInventoryOpen && (
          <div className="absolute inset-y-0 right-0 w-[400px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 z-[200] flex flex-col border-l-4 border-slate-200 animate-[slideInRight_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-200">
              <h2 className="text-2xl font-black text-slate-800">보유 아이템</h2>
              <button onClick={() => setIsInventoryOpen(false)} className="w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xl cursor-pointer">X</button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
              {(!Array.isArray(slots) || slots.length === 0) && <div className="text-center text-slate-400 mt-10">인벤토리가 비어 있습니다.</div>}
              {Array.isArray(slots) && slots.map((item) => {
                const itemName = item.name || item.item_name;
                const itemId = item.id || item.item_id;
                const isWorker = itemName && (itemName.includes("광부") || itemName.includes("제련") || itemName.includes("대장") || itemName.includes("전사") || itemName.includes("기사") || itemName.includes("도적") || itemName.includes("대장장이"));
                // @ts-ignore
                const isLocked = item.locked !== undefined ? item.locked : false;
                
                return (
                  <button
                    key={itemId || Math.random()}
                    onClick={() => {
                      if (isWorker && !isLocked) {
                        setEquippedWorker({ id: itemId, name: itemName, level: (item as any).level || 1 });
                        setIsInventoryOpen(false);
                      } else if (!isWorker && !isLocked && itemName) {
                        useAlertStore.getState().openAlert("캐릭터(일꾼)만 장착할 수 있습니다.", "장착 불가");
                      }
                    }}
                    className={`w-full text-left rounded-3xl border-[4px] p-5 flex justify-between items-center transition-all ${
                      isWorker && !isLocked
                        ? "bg-white border-slate-200 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                        : isLocked ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed grayscale" : "bg-slate-50 border-slate-200 hover:border-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <div>
                      <h3 className={`text-xl font-black ${isWorker && !isLocked ? "text-slate-800" : "text-slate-500"}`}>{itemName || (isLocked ? "잠긴 슬롯" : "빈 슬롯")}</h3>
                      {isWorker && !isLocked && <p className="text-md font-bold text-amber-600 mt-1">Lv. {(item as any).level || 1}</p>}
                    </div>
                    {isWorker && !isLocked && <span className="text-4xl drop-shadow-md">🧑‍🔧</span>}
                  </button>
                );
              })}
            </div>
            <style dangerouslySetInnerHTML={{
              __html: `
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}} />
          </div>
        )}
      </div>
    );
  }

  // 일반 건물 모달 처리 (은행, 창고 등)
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (data.type !== "building" || !data.action) return;
    let frameId: number;
    let start = performance.now();
    const duration = 2000;
    const animate = (time: number) => {
      let passed = time - start;
      if (passed >= duration) {
        setProgress(100);
        data.action?.();
        onClose();
      } else {
        setProgress((passed / duration) * 100);
        frameId = requestAnimationFrame(animate);
      }
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [data, onClose]);

  const handleImmediateEnter = () => {
    setProgress(100);
    data.action?.();
    onClose();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col items-center gap-6 min-w-[320px] border-4 border-slate-200 relative overflow-hidden" style={R} onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-3 bg-slate-100">
          <div className="h-full bg-indigo-500 transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} />
        </div>
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center border-4 border-indigo-100 shadow-inner mt-4 px-2 py-2">
          <span className="text-4xl animate-bounce">🏛️</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xl font-black text-slate-800 text-center leading-relaxed">
            <span className="text-indigo-600 text-2xl">[{data.label}]</span> 입장을 보실 수 있습니다.
          </p>
          <p className="text-sm text-slate-500 font-bold animate-pulse">잠시 후 자동으로 입장합니다...</p>
        </div>
        <div className="flex w-full mt-2 gap-3">
          <button className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 border-2 border-slate-200 font-black text-lg hover:bg-slate-200 active:scale-95 cursor-pointer transition-colors" onClick={onClose}>취소 (ESC)</button>
          <button className="flex-1 py-4 rounded-xl bg-indigo-500 text-white font-black text-lg hover:bg-indigo-600 active:scale-95 cursor-pointer shadow-lg transition-colors" onClick={handleImmediateEnter}>즉시 입장 (SPACE)</button>
        </div>
      </div>
    </div>
  );
}