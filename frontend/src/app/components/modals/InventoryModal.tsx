import { useState, useMemo } from "react";
import { Lock, ShoppingBag, HelpCircle, X, Package } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";
import { useAlertStore } from "../../../store/useAlertStore";
import { WorkerEquippedDisplay, type WorkerItem } from "../ui/WorkerCard";
import type { InventoryItem } from "../../../store/gameStore";

export function InventoryModal() {
  const { inventoryItems, inventoryExpandTickets, inventoryMax, useInventoryTicket } = useGameStore();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // 현재 장착된 일꾼 (임시) - 실제로는 별도 장착 상태를 관리해야 함
  const [equippedSlot, setEquippedSlot] = useState<WorkerItem | null>({
    id: 101,
    name: "수습 광부",
    level: 1,
  });

  // 슬롯 더블클릭 로직
  const handleSlotDoubleClick = (item: InventoryItem | null, idx: number) => {
    // 확장 불가능/빈 슬롯이면 무시
    if (!item) return;

    // 더블클릭시 장착 처리 (현재는 일꾼만)
    if (item.type.startsWith("worker_")) {
      setEquippedSlot({
        id: parseInt(item.id.replace(/\D/g, "") || "0"),
        name: item.name,
        level: item.level || 1,
      });
    }
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

  // 총 슬롯 표시용 (ex: 20개 표시, 잠긴 슬롯 포함)
  const totalSlotsDisplay = Math.max(20, Math.ceil(inventoryMax / 4) * 4);
  const slots = useMemo(() => {
    const list = new Array(totalSlotsDisplay).fill(null);
    inventoryItems.forEach((item, i) => {
      if (i < inventoryMax) {
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
        {/* 왼쪽: 현재 장착된 일꾼 */}
        <div className="w-1/2 flex flex-col h-full bg-gradient-to-b from-blue-50/80 to-indigo-50/80 rounded-[32px] border-4 border-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] relative overflow-hidden">
          <WorkerEquippedDisplay worker={equippedSlot} />
        </div>

        {/* 오른쪽: 인벤토리 슬롯 그리드 */}
        <div className="w-1/2 flex flex-col h-full bg-white rounded-[32px] border-4 border-gray-200 shadow-xl overflow-hidden p-6 relative">
          <div className="absolute top-4 right-6 text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-full flex gap-2 items-center">
            <span className="text-lg">🎒</span> 
            확장권 <span className="text-indigo-600 font-black">{inventoryExpandTickets}</span> 개 보유
          </div>

          <h3 className="text-xl font-bold text-gray-700 mb-6 mt-2 ml-2">슬롯 목록</h3>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 8px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {slots.map((item, idx) => {
                const isLocked = idx >= inventoryMax;
                const isExpandable = isLocked && idx === inventoryMax; // 바로 다음 잠긴 슬롯만 확장 가능하게
                const isSelected = item && selectedSlot === item.id;

                return (
                  <button
                    key={'slot-' + idx}
                    onDoubleClick={() => handleSlotDoubleClick(item, idx)}
                    onClick={() => {
                      if (isExpandable) handleUnlockSlot();
                      if (item) setSelectedSlot(item.id);
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
                <p className="font-black text-slate-700 mb-2 text-lg">👷 장착 및 해제</p>
                <ul className="space-y-2 text-slate-600 font-bold text-sm ml-2">
                  <li className="flex gap-2"><span className="text-indigo-500">•</span> 목롁에서 장착할 일꾼을 <strong className="text-indigo-600 bg-indigo-50 px-2 rounded">더블 클릭</strong></li>
                  <li className="flex gap-2"><span className="text-indigo-500">•</span> 왼쪽 메인 화면에 즉시 장착됩니다.</li>
                </ul>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
                <p className="font-black text-slate-700 mb-2 text-lg">🎒 인벤토리 확장</p>
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

