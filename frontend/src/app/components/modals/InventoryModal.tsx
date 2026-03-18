import { useState, useMemo } from "react";
import { Lock, ShoppingBag, HelpCircle, X, Trash2 } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";
import { useAlertStore } from "../../../store/useAlertStore";
import type { InventoryItem } from "../../../store/gameStore";

export function InventoryModal() {
  const { inventoryItems, inventoryExpandTickets, inventoryMax, useInventoryTicket, removeInventoryItem } = useGameStore();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);

  // 슬롯 클릭 로직
  const handleSlotClick = (item: InventoryItem | null, idx: number) => {
    if (!item) return;
    setSelectedSlot(selectedSlot === item.id ? null : item.id);
  };

  const handleUnlockSlot = () => {
    if (inventoryExpandTickets <= 0) {
      useAlertStore.getState().openAlert("확장권이 부족합니다.", "경고");
      return;
    }
    const success = useInventoryTicket();
    if (success) {
      useAlertStore.getState().openAlert("인벤토리 슬롯이 확장되었습니다.", "안내");
    }
  };

  const handleDeleteItem = () => {
    if (confirmDelete) {
      removeInventoryItem(confirmDelete.id);
      if (selectedSlot === confirmDelete.id) setSelectedSlot(null);
      useAlertStore.getState().openAlert(`${confirmDelete.name}을(를) 버렸습니다.`, "아이템 폐기");
      setConfirmDelete(null);
    }
  };

  // 총 6개 슬롯 표시 (기본 확장 4개 + 잠긴 슬롯 2개 등)
  const totalSlotsDisplay = 6;
  const slots = useMemo(() => {
    const list = new Array(totalSlotsDisplay).fill(null);
    inventoryItems.forEach((item, i) => {
      if (i < inventoryMax && i < totalSlotsDisplay) {
        list[i] = item;
      }
    });
    return list;
  }, [inventoryItems, inventoryMax, totalSlotsDisplay]);

  return (
    <div className="relative h-full flex flex-col">
      {/* 헤더 부분 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl text-gray-800 tracking-tight font-black">인벤토리</h2>
          <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full ml-2">
            사용중 {inventoryItems.length} / 최대 {inventoryMax}
          </span>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-6 flex-1 mt-2 min-h-0">
        {/* 인벤토리 슬롯 그리드 (전체 너비 사용) */}
        <div className="w-full flex flex-col h-full bg-white rounded-[32px] border-4 border-gray-200 shadow-xl overflow-hidden p-6 relative">
          <div className="absolute top-4 right-6 text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-full flex gap-2 items-center">
            <span className="text-lg">🎒</span> 
            확장권 <span className="text-indigo-600 font-black">{inventoryExpandTickets}</span> 개 보유
          </div>

          <h3 className="text-xl font-bold text-gray-700 mb-6 mt-2 ml-2">보유 아이템 목록</h3>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 8px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pb-4">
              {slots.map((item, idx) => {
                const isLocked = idx >= inventoryMax;
                // 확장권이 있을 때만 바로 다음 잠긴 슬롯 활성화
                const isExpandable = isLocked && idx === inventoryMax && inventoryExpandTickets > 0;
                const isSelected = item && selectedSlot === item.id;

                return (
                  <button
                    key={'slot-' + idx}
                    onClick={() => {
                      if (isExpandable) {
                        handleUnlockSlot();
                      } else if (isLocked) {
                        useAlertStore.getState().openAlert("확장권이 없습니다. 미니게임에서 획득할 수 있습니다.", "슬롯 잠금");
                      } else {
                        handleSlotClick(item, idx);
                      }
                    }}
                    className={`relative rounded-[24px] flex flex-col items-center justify-center transition-all duration-300 min-h-[140px] transform group
                      ${isLocked
                        ? isExpandable
                          ? "bg-amber-50/50 border-2 border-dashed border-amber-300 hover:bg-amber-100 hover:border-amber-400 cursor-pointer hover:-translate-y-1 shadow-sm"
                          : "bg-gray-100/50 border-2 border-dashed border-gray-200 opacity-60 cursor-not-allowed"
                        : item
                          ? isSelected
                            ? "bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-400 shadow-[0_8px_20px_rgba(79,70,229,0.2)] cursor-pointer ring-4 ring-indigo-200 ring-offset-2 scale-105 z-10"
                            : "bg-white border-2 border-gray-200 hover:border-indigo-300 hover:shadow-xl cursor-pointer hover:-translate-y-1 shadow-sm"
                          : "bg-gray-50/50 border-2 border-dashed border-gray-300 hover:bg-gray-100 cursor-pointer"
                      }`}
                  >
                    <span className="absolute top-3 left-4 text-xs font-black text-gray-400 tracking-wider">
                      #{idx + 1}
                    </span>

                    {isLocked ? (
                      <div className="flex flex-col items-center">
                        <Lock className={`w-8 h-8 mb-2 ${isExpandable ? "text-amber-500 group-hover:scale-110 group-hover:animate-pulse transition-all" : "text-gray-300"}`} />
                        {isExpandable && (
                          <span className="text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-full shadow-sm mt-1">
                            확장 가능
                          </span>
                        )}
                      </div>
                    ) : item ? (
                      <div className="flex flex-col items-center z-10 mt-2 pointer-events-none">
                        <span className="text-5xl mb-3 drop-shadow-md group-hover:scale-110 transition-transform">{item.icon}</span>
                        <div className={`px-4 py-1.5 rounded-full shadow-sm truncate max-w-[120px] 
                          ${isSelected ? "bg-indigo-500 text-white font-black" : "bg-white border-2 border-gray-100 text-gray-700 font-bold"}`}>
                          {item.type.startsWith("ticket_") ? item.name : `Lv.${item.level} ${item.name}`}
                        </div>
                        {item.type.startsWith("ticket_") && (
                          <span className="absolute top-3 right-4 font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full text-xs">x{item.quantity}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">빈 슬롯</span>
                    )}

                    {isExpandable && (
                       <div className="absolute bottom-3 right-4 text-xs font-black text-amber-600 bg-white border-2 border-amber-200 px-2.5 py-1 rounded-lg shadow-sm">
                         {inventoryExpandTickets}/1
                       </div>
                    )}

                    {/* 🗑️ 휴지통 버튼: 아이템 있는 슬롯에만, hover 시 표시 */}
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

