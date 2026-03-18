import React, { useState, useEffect } from "react";
import { Package, Lock } from "lucide-react";
import { useGame, useGameStore, MAX_PER_SLOT } from "../../store/gameStore";
import { BackButton } from "../../app/components/ui/backbutton";

interface SlotData {
  id: number;
  item: null | {
    type: "material" | "product";
    quantity: number;
    name: string;
    id_: string;
  };
  locked: boolean;
}

export function WarehousePage() {
  const { state, closeBuildingPage } = useGame();
  const { warehouseItems, warehouseExpandTickets } = state;
  const maxSlots = useGameStore(s => s.warehouseMaxSlots); // default 10
  const material = useGameStore(s => s.getIndustryItemNames().material);
  const product = useGameStore(s => s.getIndustryItemNames().product);
  const useWarehouseTicket = useGameStore(s => s.useWarehouseTicket);

  const [slots, setSlots] = useState<SlotData[]>([]);

  useEffect(() => {
    // Initialize slots
    const totalSlots = 100; // Total displayable slots limit increased
    const initialSlots: SlotData[] = Array(totalSlots).fill(null).map((_, i) => ({
      id: i,
      item: null,
      locked: i >= maxSlots
    }));

    let currentSlotIdx = 0;
    
    // Group and populate items uniformly
    const materials = warehouseItems.filter((i) => i.type === "material");
    const products = warehouseItems.filter((i) => i.type === "product");

    materials.forEach(item => {
      let remaining = item.quantity;
      while (remaining > 0) {
        const amount = Math.min(remaining, MAX_PER_SLOT);
        if (currentSlotIdx < maxSlots) {
          initialSlots[currentSlotIdx].item = {
             type: "material", quantity: amount, name: material, id_: item.id
          };
          currentSlotIdx++;
        }
        remaining -= amount;
      }
    });

    products.forEach(item => {
      let remaining = item.quantity;
      while (remaining > 0) {
        const amount = Math.min(remaining, MAX_PER_SLOT);
        if (currentSlotIdx < maxSlots) {
          initialSlots[currentSlotIdx].item = {
             type: "product", quantity: amount, name: product, id_: item.id
          };
          currentSlotIdx++;
        }
        remaining -= amount;
      }
    });

    setSlots(initialSlots);
  }, [warehouseItems, maxSlots, material, product]);

  const handleUnlockSlot = (slotId: number) => {
    if (warehouseExpandTickets <= 0) {
      alert("확장권이 부족합니다.");
      return;
    }
    const success = useWarehouseTicket();
    if (success) {
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, locked: false } : s));
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("text/plain");
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (sourceIndex === targetIndex) return;

    setSlots((prev) => {
      const newSlots = [...prev];
      const sourceSlot = newSlots[sourceIndex];
      const targetSlot = newSlots[targetIndex];

      if (targetSlot.locked) return prev;

      const tempItem = sourceSlot.item;
      sourceSlot.item = targetSlot.item;
      targetSlot.item = tempItem;

      return newSlots;
    });
  };

  const localUnlocked = slots.filter(s => !s.locked).length;
  const localUsed = slots.filter(s => !s.locked && s.item !== null).length;
  const localPercent = localUnlocked > 0 ? Math.min((localUsed / localUnlocked) * 100, 100) : 0;
  
  // 한 줄 3칸. 현재 잠금해제된 개수에 기반해 노출할 슬롯 계산.
  const visibleCount = Math.max(15, Math.ceil(localUnlocked / 3) * 3 + (localUnlocked % 3 === 0 && localUnlocked >= 15 ? 3 : 0));

  return (
    <div
      className="absolute inset-0 z-40 bg-[#f5f0e8] flex flex-col pt-8"
      style={{
        backgroundImage: "url('/images/warehouse.머ㅗ')",
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: '#cee7be'
      }}
    >
      <BackButton onClick={closeBuildingPage} className="absolute top-6 left-6" />

      {/* 우측 상단 인디케이터 */}
      <div className="absolute top-6 right-6 flex gap-4 bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/50 shadow-lg z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-inner bg-yellow-500"></div> 
          <span className="text-gray-700 font-bold tracking-tight">원자재</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-inner bg-blue-500"></div> 
          <span className="text-gray-700 font-bold tracking-tight">생산품</span>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 pt-16 flex flex-col max-w-5xl mx-auto w-full overflow-hidden">
        {/* Warehouse capacity display */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-4 mb-6 shrink-0 flex items-center justify-between border border-white/50 shadow-sm mx-4">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-gray-600" />
            <span className="text-lg text-gray-800 font-black tracking-wide">
              창고 수용량
            </span>
            <span className="text-sm text-gray-500 font-bold ml-2">
              ( {localUsed} / {localUnlocked} 슬롯 사용 중 )
            </span>
          </div>
          <div className="w-64 h-4 bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${localPercent >= 90 ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${localPercent}%` }}
            />
          </div>
        </div>

        {/* 그리드 정렬 (스크롤 영역) */}
        <div className="relative bg-white/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/50 shadow-2xl mx-4 flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-3 gap-6">
            {slots.slice(0, visibleCount).map((slot, idx) => {
              const isExpandable = slot.locked && warehouseExpandTickets > 0;
              const hasItem = slot.item !== null;
              
              return (
                <div
                  key={slot.id}
                  draggable={!slot.locked && hasItem}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => {
                    if (slot.locked && isExpandable) {
                      handleUnlockSlot(slot.id);
                    }
                  }}
                  className={`relative w-full aspect-[4/3] rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2
                    ${slot.locked
                      ? isExpandable
                        ? "bg-slate-50 border-slate-300 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-lg cursor-pointer opacity-100 group"
                        : "bg-slate-100/50 border-slate-200 opacity-60 cursor-not-allowed"
                      : hasItem
                        ? "bg-white/60 border-transparent shadow-md hover:shadow-xl hover:-translate-y-2 cursor-grab active:cursor-grabbing backdrop-blur-md"
                        : "bg-white/30 border-dashed border-gray-400 hover:bg-white/50 hover:border-gray-500"
                    }
                  `}
                >
                  <span className="absolute top-3 left-4 text-lg font-bold text-gray-500/80 tracking-widest z-10">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {slot.locked ? (
                    <div className="flex flex-col items-center justify-center text-gray-400 w-full h-full">
                      <Lock className={`w-12 h-12 mb-2 transition-transform ${isExpandable && "group-hover:scale-110 group-hover:text-yellow-600"}`} />
                      <div className="absolute bottom-3 right-4 text-sm font-bold text-gray-400 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">
                        {warehouseExpandTickets}/1
                      </div>
                    </div>
                  ) : hasItem ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 pt-8">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-md relative overflow-hidden ring-1 ring-white/40"
                        style={{
                          background: slot.item!.type === "material"
                            ? "linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(202, 138, 4, 0.3) 100%)"
                            : "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)",
                        }}
                      >
                         <Package
                           className={`w-8 h-8 drop-shadow-md ${slot.item!.type === "material" ? "text-yellow-600" : "text-blue-500"}`}
                         />
                      </div>
                      
                      <div className="bg-white/90 backdrop-blur border border-white/50 shadow-sm rounded-xl px-3 py-2 text-center w-[90%] pointer-events-none">
                        <span className="text-sm text-gray-800 font-extrabold block truncate w-full">
                          {slot.item!.name}
                        </span>
                        <span className="text-xs text-gray-600 font-bold block mt-1 truncate">
                          {slot.item!.quantity.toLocaleString()} 개
                        </span>
                      </div>
                    </div>
                  ) : (
                     <div className="flex w-full h-full items-center justify-center">
                       <span className="text-base text-gray-400 font-bold select-none">비어있음</span>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
