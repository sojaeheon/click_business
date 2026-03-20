import React, { useState, useMemo, useEffect } from "react";
import { Lock, ShoppingBag, HelpCircle, X, Trash2 } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";
import { useAlertStore } from "../../../store/useAlertStore";
import type { InventoryItem } from "../../../store/gameStore";
import { WORKER_LEVEL_IMAGES } from "../../../constants/workers";

export function InventoryModal() {
  const { inventoryItems, inventoryExpandTickets, inventoryMax, useInventoryTicket, removeInventoryItem } = useGameStore();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);

  // localItems: inventoryItems와 동기화 (모달 열릴 때 최신 상태 반영)
  const [localItems, setLocalItems] = useState(() => [...inventoryItems]);

  // inventoryItems(Zustand) 변경 시 localItems 자동 동기화
  useEffect(() => {
    setLocalItems([...inventoryItems]);
  }, [inventoryItems]);

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const isLocked = index >= inventoryMax;  // ← inventoryMax 사용
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
    const isLocked = targetIndex >= inventoryMax;  // ← inventoryMax 사용
    if (isLocked) return;

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
    // useInventoryTicket()이 gameStore의 inventoryMax를 +1 하므로
    // 로컬 state 별도 관리 불필요 — 자동으로 반영됨
    if (success) {
      useAlertStore.getState().openAlert("인벤토리 슬롯이 확장되었습니다.", "안내");
    }
  };

  const handleDeleteItem = () => {
    if (confirmDelete) {
      removeInventoryItem(confirmDelete.id);
      setLocalItems((prev) => prev.filter((item) => item?.id !== confirmDelete.id));
      if (selectedSlot === confirmDelete.id) setSelectedSlot(null);
      useAlertStore.getState().openAlert(`${confirmDelete.name}을(를) 버렸습니다.`, "아이템 폐기");
      setConfirmDelete(null);
    }
  };

  // 슬롯 그리드 렌더링 계산 (잠긴 슬롯은 최소 3칸 추가로 표시)
  const slotsToDisplay = useMemo(() => {
    const lockedSlotsCount = 3; // 항상 잠긴 슬롯 3칸 미리 보여줌
    const totalCount = inventoryMax + lockedSlotsCount;
    const paddedCount = Math.ceil(totalCount / 3) * 3;
    return new Array(paddedCount).fill(null);
  }, [inventoryMax]);  // ← inventoryMax 의존

  return (
    <div className="relative h-full flex flex-col">
      {/* 헤더 부분 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl text-gray-800 tracking-tight font-black">인벤토리</h2>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-2">
            사용중 {inventoryItems.length} / 최대 {inventoryMax}
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
        <div className="w-full flex flex-col h-full bg-white rounded-[24px] border-4 border-gray-200 shadow-xl overflow-hidden p-5 relative">

          <div className="flex items-center justify-between mb-3 mt-1 px-2">
            <h3 className="text-sm font-bold text-gray-500">보유 아이템 목록</h3>
            <div className="text-xs font-bold text-gray-400">
              {/* 확장권은 인벤토리 슬롯 아이템으로 직접 표시됩니다 */}
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
                const isLocked = idx >= inventoryMax;
                const isExpandable = isLocked && idx === inventoryMax;
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
                      else if (isLocked) useAlertStore.getState().openAlert("확장권이 없습니다. 미니게임에서 획득할 수 있습니다.", "슬롯 잠금");
                      else if (item) setSelectedSlot(selectedSlot === item.id ? null : item.id);
                    }}
                    className={`relative rounded-[20px] flex flex-col items-center justify-center transition-all duration-300 min-h-[140px] transform group
                      ${isLocked
                        ? hasTickets && isExpandable
                          ? "bg-amber-50/50 border-2 border-dashed border-amber-300 hover:bg-amber-100 hover:border-amber-400 cursor-pointer hover:-translate-y-1 shadow-sm"
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
                        <Lock className={`w-8 h-8 mb-2 ${hasTickets && isExpandable ? "text-amber-500 group-hover:scale-110 group-hover:animate-pulse transition-all" : "text-gray-300"}`} />
                        {isExpandable && hasTickets && (
                          <span className="text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-full shadow-sm mt-1">
                            확장 가능
                          </span>
                        )}
                      </div>
                      ) : item ? (
                      <div className="flex flex-col items-center z-10 p-2 pointer-events-none">
                        {item.type?.startsWith("worker_") ? (
                          <img
                            src={WORKER_LEVEL_IMAGES[item.level ?? 1] ?? WORKER_LEVEL_IMAGES[1]}
                            alt={item.name}
                            className="w-12 h-12 object-contain mb-1 drop-shadow-md group-hover:scale-110 transition-transform"
                          />
                        ) : item.type?.startsWith("ticket_") ? (
                          <span className="text-3xl mb-1 drop-shadow-md group-hover:scale-110 transition-transform">🎫</span>
                        ) : (
                          <span className="text-4xl mb-2 drop-shadow-md group-hover:scale-110 transition-transform">{item.icon}</span>
                        )}
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

                    {/* 🗑️ 휴지통 버튼 */}
                    {!isLocked && item && (
                      <button
                        className="absolute top-2 right-2 w-8 h-8 bg-red-50 border border-red-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 cursor-pointer z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(item);
                        }}
                        title="아이템 버리기"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl border-4 border-red-200 shadow-2xl p-6 w-[350px] animate-fade-in">
            <h3 className="text-lg font-black text-gray-800 mb-3">아이템 폐기</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-bold text-red-600">{confirmDelete.name}</span>을(를) 정말 버리시겠습니까?
            </p>
            <p className="text-xs text-gray-400 mb-5">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleDeleteItem}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors cursor-pointer"
              >
                버리기
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <li className="flex gap-2"><span className="text-blue-500">•</span> 아이템을 드래그하여 슬롯 위치를 변경할 수 있습니다.</li>
                  <li className="flex gap-2"><span className="text-red-500">•</span> 슬롯에 마우스를 올리면 🗑️ 버튼으로 아이템을 버릴 수 있습니다.</li>
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