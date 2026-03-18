import { useState, useMemo } from "react";
import { Lock, ShoppingBag, HelpCircle, X, Package } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";
import { useAlertStore } from "../../../store/useAlertStore";
import type { InventoryItem } from "../../../store/gameStore";

export function InventoryModal() {
  const { inventoryItems, inventoryExpandTickets, inventoryMax, useInventoryTicket } = useGameStore();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [unlockedSlotsCount, setUnlockedSlotsCount] = useState(4); // 4개 슬롯만 열려 있게
  const [localItems, setLocalItems] = useState(() => {
    // 4개 슬롯에 맞게 아이템 배치
    const items = [...inventoryItems];
    return items;
  });

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const isLocked = index >= unlockedSlotsCount;
    const item = localItems[index];
    if (isLocked || !item) {
      e.preventDefault();
      return;
    }
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const isLocked = targetIndex >= unlockedSlotsCount;
    if (isLocked) return; // 잠금 슬롯은 변경 불가

    const newItems = [...localItems];
    const temp = newItems[draggingIndex];
    newItems[draggingIndex] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setLocalItems(newItems);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleUnlockSlot = () => {
    if (inventoryExpandTickets <= 0) {
      useAlertStore.getState().openAlert("확장권이 부족합니다.", "경고");
      return;
    }
    const success = useInventoryTicket();
    if (success) {
      setUnlockedSlotsCount((prev) => prev + 1);
    }
  };

  // 슬롯 그리드 렌더링을 계산하는 로직 
  // 잠겨있는 슬롯이 2개 이하이면 다음 자물쇠 슬롯 3개(1줄) 동적 생성
  const slotsToDisplay = useMemo(() => {
    let lockedSlotsCount = 0;
    while (lockedSlotsCount <= 2) {
      lockedSlotsCount += 3;
    }
    const totalCount = unlockedSlotsCount + lockedSlotsCount;
    // 3열에 맞춰 보정
    const paddedCount = Math.ceil(totalCount / 3) * 3;
    return new Array(paddedCount).fill(null);
  }, [unlockedSlotsCount]);

  return (
    <div className="relative h-full flex flex-col">
      {/* 헤더 부분 */}
      <div className="flex items-center justify-between mb-2"> {/* mb-4 -> mb-2 축소 */}
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl text-gray-800 tracking-tight font-black">인벤토리</h2>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-2">
            사용중 {inventoryItems.length} / 최대 {unlockedSlotsCount}
          </span>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-6 flex-1 mt-1 min-h-0">
        {/* 인벤토리 슬롯 그리드 (전체 너비 사용) */}
        <div className="w-full flex flex-col h-full bg-white rounded-[24px] border-4 border-gray-200 shadow-xl overflow-hidden p-5 relative">

          {/* 헤더 좌우 배치 및 높이 일치 */}
          <div className="flex items-center justify-between mb-3 mt-1 px-2">
            <h3 className="text-sm font-bold text-gray-500">보유 아이템 목록</h3>
            <div className="text-xs font-bold text-gray-400 flex gap-1 items-center">
              확장권 <span className="text-indigo-600 font-black">{inventoryExpandTickets}</span>개 보유
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 8px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            <div className="grid grid-cols-3 gap-5 pb-4">
              {slotsToDisplay.map((_, idx) => {
                const isLocked = idx >= unlockedSlotsCount;
                const isExpandable = isLocked && idx === unlockedSlotsCount; // 바로 다음 잠긴 슬롯만 확장 가능하게
                const item = localItems[idx];
                const isSelected = item && selectedSlot === item.id;
                const hasTickets = inventoryExpandTickets > 0;

                const isDragOver = dragOverIndex === idx;

                return (
                  <button
                    key={'slot-' + idx}
                    draggable={!isLocked && !!item}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDragEnter={() => !isLocked && setDragOverIndex(idx)}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => {
                      if (hasTickets && isExpandable) handleUnlockSlot();
                      if (item) setSelectedSlot(selectedSlot === item.id ? null : item.id);
                    }}
                    className={`relative rounded-[20px] flex flex-col items-center justify-center transition-all duration-300 min-h-[140px] transform group
                      ${isLocked
                        ? hasTickets
                          ? "bg-gray-50/50 border-2 border-dashed border-gray-200 hover:bg-amber-50/40 hover:border-amber-400 cursor-pointer shadow-sm"
                          : "bg-gray-100/30 border-2 border-dashed border-gray-200 opacity-60 cursor-not-allowed"
                        : item
                          ? isSelected
                            ? "bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-400 shadow-[0_8px_20px_rgba(79,70,229,0.2)] cursor-pointer ring-4 ring-indigo-200 ring-offset-2 scale-105 z-10"
                            : "bg-white border-2 border-slate-200 hover:border-indigo-300 hover:shadow-lg cursor-pointer hover:-translate-y-1 shadow-sm"
                          : "bg-gray-50/50 border-2 border-dashed border-slate-200 hover:bg-slate-100/50 cursor-pointer"
                      }
                      ${isDragOver ? "ring-4 ring-blue-300 ring-offset-2 scale-105 z-10 border-blue-400" : ""}
                    `}
                  >
                    <span className="absolute top-2 left-3 text-[10px] font-black text-gray-400 tracking-wider">
                      #{idx + 1}
                    </span>

                    {isLocked ? (
                      <div className="flex flex-col items-center pointer-events-none">
                        <Lock className={`w-8 h-8 mb-2 ${hasTickets ? "group-hover:text-amber-500 group-hover:scale-110 transition-all" : "text-gray-300"}`} />
                      </div>
                    ) : item ? (
                      <div className="flex flex-col items-center z-10 p-2 pointer-events-none">
                        <span className="text-4xl mb-2 drop-shadow-md group-hover:scale-110 transition-transform">{item.icon}</span>
                        <div className={`px-3 py-1 rounded-full shadow-sm truncate max-w-[100px] text-xs
                          ${isSelected ? "bg-indigo-500 text-white font-black" : "bg-white border text-gray-700 font-bold"}`}>
                          {item.type.startsWith("ticket_") ? item.name : `Lv.${item.level} ${item.name}`}
                        </div>
                        {item.type.startsWith("ticket_") && (
                          <span className="absolute top-2 right-3 font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full text-[10px]">x{item.quantity}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">빈 슬롯</span>
                    )}

                    {isExpandable && (
                      <div className="absolute bottom-3 right-4 text-[10px] font-black text-amber-600">
                        {inventoryExpandTickets}/1
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 사용법 모달 */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
          <div className="relative bg-white rounded-[32px] border-[6px] border-slate-800 shadow-2xl p-8 w-[450px] animate-fade-in">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-5 right-5 w-10 h-10 bg-slate-100 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6 text-slate-600" />
            </button>
            <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-600 p-2 rounded-2xl"><HelpCircle className="w-6 h-6" /></span>
              인벤토리 가이드
            </h3>

            <div className="space-y-6">
              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
                <p className="font-black text-slate-700 mb-2 text-lg">🎒 인벤토리 슬롯 변경 및 확장</p>
                <ul className="space-y-2 text-slate-600 font-bold text-sm ml-2">
                  <li className="flex gap-2"><span className="text-amber-500">•</span> 미니게임 등에서 획득한 <strong className="text-amber-600 bg-amber-50 px-2 rounded">확장권</strong> 사용</li>
                  <li className="flex gap-2"><span className="text-amber-500">•</span> 자물쇠 슬롯을 클릭하면 슬롯이 해제됩니다.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-8 w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-lg hover:bg-slate-700 transition-transform active:scale-95 shadow-lg"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

