import React, { useState, useEffect } from "react";
import { Package, Lock, Trash2, X, AlertTriangle } from "lucide-react";
import { useGame, useGameStore, MAX_PER_SLOT } from "../../store/gameStore";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { WarehouseAPI } from "../../api/gameApi";
import { getPropsImage } from "../../constants/workers";

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

// ── 창고 폐기 패널 ──────────────────────────────────────────────────
interface DiscardPanelProps {
  totalMaterial: number;
  totalProduct: number;
  materialName: string;
  productName: string;
  onClose: () => void;
  onDiscard: (type: "material" | "product", qty: number) => void;
}

function DiscardPanel({ totalMaterial, totalProduct, materialName, productName, onClose, onDiscard }: DiscardPanelProps) {
  const [selectedType, setSelectedType] = useState<"material" | "product">("material");
  const [qty, setQty] = useState<string>("");

  const maxQty = selectedType === "material" ? totalMaterial : totalProduct;
  const inputNum = Math.max(0, Math.min(Number(qty) || 0, maxQty));
  const isOver = Number(qty) > maxQty;
  const canDiscard = inputNum > 0 && !isOver;

  const handleConfirm = () => {
    if (!canDiscard) return;
    onDiscard(selectedType, inputNum);
    setQty("");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* 딤드 배경 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl border-4 border-red-300 shadow-2xl p-8 w-[420px] animate-fade-in">
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* 제목 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-800">창고 아이템 폐기</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">폐기한 아이템은 복구할 수 없습니다</p>
          </div>
        </div>

        {/* 아이템 종류 선택 */}
        <div className="mb-5">
          <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">폐기할 종류 선택</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setSelectedType("material"); setQty(""); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm cursor-pointer ${selectedType === "material"
                ? "bg-yellow-50 border-yellow-400 text-yellow-800"
                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
            >
              <div className={`w-3 h-3 rounded-full ${selectedType === "material" ? "bg-yellow-500" : "bg-gray-300"}`} />
              <div className="text-left">
                <div>{materialName}</div>
                <div className="text-xs font-black mt-0.5 text-yellow-700 opacity-80">{totalMaterial.toLocaleString()} 개 보유</div>
              </div>
            </button>
            <button
              onClick={() => { setSelectedType("product"); setQty(""); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm cursor-pointer ${selectedType === "product"
                ? "bg-blue-50 border-blue-400 text-blue-800"
                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
            >
              <div className={`w-3 h-3 rounded-full ${selectedType === "product" ? "bg-blue-500" : "bg-gray-300"}`} />
              <div className="text-left">
                <div>{productName}</div>
                <div className="text-xs font-black mt-0.5 text-blue-700 opacity-80">{totalProduct.toLocaleString()} 개 보유</div>
              </div>
            </button>
          </div>
        </div>

        {/* 수량 입력 */}
        <div className="mb-2">
          <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">폐기 수량 입력</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={`최대 ${maxQty.toLocaleString()}개`}
              className={`flex-1 border-2 rounded-xl px-4 py-3 text-right text-xl font-black focus:outline-none transition-colors ${isOver ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-800 focus:border-gray-400"
                }`}
            />
            <button
              onClick={() => setQty(String(maxQty))}
              className="px-3 py-2 text-xs font-black bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 whitespace-nowrap"
            >
              전체
            </button>
          </div>
          {/* 보유 / 초과 안내 */}
          <p className={`text-xs font-bold mt-1.5 text-right ${isOver ? "text-red-500" : "text-gray-400"}`}>
            {isOver
              ? `보유량 초과! 최대 ${maxQty.toLocaleString()}개까지 폐기 가능`
              : qty ? `${inputNum.toLocaleString()}개 폐기 예정` : "수량을 입력하세요"
            }
          </p>
        </div>

        {/* 경고 배너 */}
        {canDiscard && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 mt-3">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-700">
              <span className={selectedType === "material" ? "text-yellow-700" : "text-blue-700"}>
                {selectedType === "material" ? materialName : productName}
              </span>{" "}
              {inputNum.toLocaleString()}개를 영구 폐기합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-600 font-black hover:bg-gray-50 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canDiscard}
            className={`flex-1 py-3 rounded-2xl font-black transition-all ${canDiscard
              ? "bg-red-500 text-white hover:bg-red-600 cursor-pointer shadow-lg shadow-red-200"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
          >
            폐기 확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────
export function WarehousePage() {
  const closeBuildingPage = useGameStore(s => s.closeBuildingPage);
  const warehouseItems = useGameStore(s => s.warehouseItems);
  const warehouseExpandTickets = useGameStore(s => s.warehouseExpandTickets);
  const maxSlots = useGameStore(s => s.warehouseMaxSlots);
  const material = useGameStore(s => s.getIndustryItemNames().material);
  const product = useGameStore(s => s.getIndustryItemNames().product);
  const useWarehouseTicket = useGameStore(s => s.useWarehouseTicket);
  const updateMaterial = useGameStore(s => s.updateMaterial);
  const updateProduct = useGameStore(s => s.updateProduct);

  const totalMaterial = warehouseItems.filter(i => i.type === "material").reduce((sum, i) => sum + i.quantity, 0);
  const totalProduct = warehouseItems.filter(i => i.type === "product").reduce((sum, i) => sum + i.quantity, 0);

  const [slots, setSlots] = useState<SlotData[]>([]);
  const [showDiscard, setShowDiscard] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    // maxSlots 이상의 예비 슬롯(자물쇠)칸을 화면에 보이도록, 6의 배수에 맞춰 동적 계산
    const totalSlots = maxSlots + (6 - (maxSlots % 6 === 0 ? 6 : maxSlots % 6)) + 6;
    const initialSlots: SlotData[] = Array(totalSlots).fill(null).map((_, i) => ({
      id: i,
      item: null,
      locked: i >= maxSlots
    }));

    let currentSlotIdx = 0;
    const materials = warehouseItems.filter((i) => i.type === "material");
    const products = warehouseItems.filter((i) => i.type === "product");

    materials.forEach(item => {
      let remaining = item.quantity;
      while (remaining > 0) {
        const amount = Math.min(remaining, MAX_PER_SLOT);
        if (currentSlotIdx < maxSlots) {
          initialSlots[currentSlotIdx].item = { type: "material", quantity: amount, name: material, id_: item.id };
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
          initialSlots[currentSlotIdx].item = { type: "product", quantity: amount, name: product, id_: item.id };
          currentSlotIdx++;
        }
        remaining -= amount;
      }
    });

    setSlots(initialSlots);
  }, [warehouseItems, maxSlots, material, product]);

  const handleUnlockSlot = (slotId: number) => {
    if (warehouseExpandTickets <= 0) {
      useAlertStore.getState().openAlert("창고 확장권이 부족합니다. 미니게임에서 획득할 수 있습니다.", "확장 불가");
      return;
    }
    const success = useWarehouseTicket();
    if (success) {
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, locked: false } : s));
      useAlertStore.getState().openAlert("창고 슬롯이 확장되었습니다!", "확장 완료");
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggingIndex(index);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    setDraggingIndex(null);
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

  // 폐기 처리
  const handleDiscard = async (type: "material" | "product", qty: number) => {
    try {
      await WarehouseAPI.discardItems(type, qty);
      if (type === "material") updateMaterial(-qty);
      else updateProduct(-qty);
      useAlertStore.getState().openAlert(
        `${type === "material" ? material : product} ${qty.toLocaleString()}개를 폐기했습니다.`,
        "폐기 완료"
      );
    } catch {
      useAlertStore.getState().openAlert("폐기 중 오류가 발생했습니다.", "폐기 실패");
    }
    setShowDiscard(false);
  };

  const localUnlocked = slots.filter(s => !s.locked).length;
  const localUsed = slots.filter(s => !s.locked && s.item !== null).length;
  const localPercent = localUnlocked > 0 ? Math.min((localUsed / localUnlocked) * 100, 100) : 0;
  const visibleCount = Math.max(15, Math.ceil(localUnlocked / 3) * 3 + (localUnlocked % 3 === 0 && localUnlocked >= 15 ? 3 : 0));
  const hasAnyItem = totalMaterial > 0 || totalProduct > 0;

  return (
    <div
      className="absolute inset-0 z-40 bg-[#f5f0e8] flex flex-col pt-8"
      style={{
        backgroundImage: "url('/images/warehouse.png')",
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: '#cee7be'
      }}
    >
      <BackButton onClick={closeBuildingPage} className="absolute top-6 left-6" />

      {/* 우측 상단 인디케이터 */}
      <div className="absolute top-6 right-6 flex gap-4 items-center z-10">
        <div className="flex gap-6 bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/50 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shadow-inner bg-yellow-500" />
            <span className="text-gray-700 font-bold tracking-tight">
              원자재 총 <span className="text-yellow-700 font-black ml-1">{totalMaterial.toLocaleString()}</span> 개
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shadow-inner bg-blue-500" />
            <span className="text-gray-700 font-bold tracking-tight">
              생산품 총 <span className="text-blue-700 font-black ml-1">{totalProduct.toLocaleString()}</span> 개
            </span>
          </div>
        </div>

        {/* 🗑️ 폐기 버튼 (아이템이 있을 때만 활성화) */}
        <button
          onClick={() => {
            if (!hasAnyItem) {
              useAlertStore.getState().openAlert("창고에 폐기할 아이템이 없습니다.", "폐기 불가");
              return;
            }
            setShowDiscard(true);
          }}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 font-black text-sm transition-all shadow-lg cursor-pointer ${hasAnyItem
            ? "bg-red-50 border-red-300 text-red-600 hover:bg-red-100 hover:border-red-400 hover:shadow-red-200"
            : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60"
            }`}
          title="아이템 폐기"
        >
          <Trash2 className="w-4 h-4" />
          아이템 폐기
        </button>
      </div>

      <div className="flex-1 px-6 pb-6 pt-16 flex flex-col max-w-5xl mx-auto w-full overflow-hidden">
        {/* 창고 용량 표시 */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-4 mb-6 shrink-0 flex items-center justify-between border border-white/50 shadow-sm mx-4">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-gray-600" />
            <span className="text-lg text-gray-800 font-black tracking-wide">창고 수용량</span>
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

        {/* 슬롯 그리드 */}
        <div className="relative bg-white/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/50 shadow-2xl mx-4 flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-3 gap-6">
            {slots.slice(0, visibleCount).map((slot, idx) => {
              const hasItem = slot.item !== null;

              return (
                <div
                  key={slot.id}
                  draggable={!slot.locked && hasItem}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDragEnter={() => !slot.locked && setDragOverIndex(idx)}
                  onDragLeave={() => dragOverIndex === idx && setDragOverIndex(null)}
                  onDragEnd={() => { setDragOverIndex(null); setDraggingIndex(null); }}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => {
                    if (slot.locked) handleUnlockSlot(slot.id);
                  }}
                  className={`relative w-full aspect-[4/3] rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 group
                    ${slot.locked
                      ? warehouseExpandTickets > 0
                        ? "bg-amber-50 border-amber-300 border-dashed hover:border-amber-400 hover:bg-amber-100 hover:shadow-md cursor-pointer"
                        : "bg-slate-100/50 border-slate-200 border-dashed opacity-60 cursor-not-allowed"
                      : hasItem
                        ? "bg-white/60 border-transparent shadow-md hover:shadow-xl hover:-translate-y-1 cursor-grab active:cursor-grabbing backdrop-blur-md"
                        : "bg-white/30 border-dashed border-gray-400 hover:bg-white/50 hover:border-gray-500"
                    }
                    ${dragOverIndex === idx && !slot.locked ? "ring-4 ring-blue-400 ring-offset-2 scale-105 z-10 border-blue-400 bg-blue-50/40" : ""}
                    ${draggingIndex === idx ? "opacity-40 scale-95" : ""}
                  `}
                >
                  <span className="absolute top-3 left-4 text-lg font-bold text-gray-500/80 tracking-widest z-10">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {slot.locked ? (
                    <div className="flex flex-col items-center justify-center text-gray-400 w-full h-full">
                      <Lock className={`w-12 h-12 mb-2 transition-all ${warehouseExpandTickets > 0
                        ? "group-hover:scale-110 group-hover:text-amber-500 text-slate-400"
                        : "text-gray-300"
                        }`} />
                      {warehouseExpandTickets > 0 ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-full shadow-sm mt-1">확장 가능</span>
                      ) : (
                        <span className="text-xs font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">확장권 없음</span>
                      )}
                      <div className="absolute bottom-3 right-4 text-sm font-bold text-gray-400 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">
                        {warehouseExpandTickets}/1
                      </div>
                    </div>
                  ) : hasItem ? (
                    <div className="w-full h-full relative overflow-hidden rounded-2xl">
                      {/* 이미지 꽉 채우기 */}
                      {(() => {
                        const imgSrc = getPropsImage(slot.item!.name);
                        return imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={slot.item!.name}
                            className="absolute inset-0 w-full h-full object-contain p-4 drop-shadow-lg"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className={`w-12 h-12 drop-shadow-md ${slot.item!.type === "material" ? "text-yellow-600" : "text-blue-500"}`} />
                          </div>
                        );
                      })()}

                      {/* 하단 정보 바 */}
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-4 py-2 bg-black/55 rounded-b-2xl">
                        <span className="text-white font-extrabold text-[14px] leading-tight drop-shadow truncate max-w-[58%]">
                          {slot.item!.name}
                        </span>
                        <span className="text-white font-black text-[13px] bg-black/40 px-2 py-1 rounded-full shrink-0">
                          {slot.item!.quantity.toLocaleString()}개
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

      {/* 폐기 패널 모달 */}
      {showDiscard && (
        <DiscardPanel
          totalMaterial={totalMaterial}
          totalProduct={totalProduct}
          materialName={material}
          productName={product}
          onClose={() => setShowDiscard(false)}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}