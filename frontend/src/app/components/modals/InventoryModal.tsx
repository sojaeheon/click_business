import React, { useState, useMemo, useEffect } from "react";
import { Lock, ShoppingBag, HelpCircle, X, Trash2, ShoppingCart } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";
import { useAlertStore } from "../../../store/useAlertStore";
import type { InventoryItem } from "../../../store/gameStore";
import { WORKER_LEVEL_IMAGES } from "../../../constants/workers";
import { InventoryAPI } from "../../../api/gameApi";

export function InventoryModal() {
  const { inventoryItems, inventoryExpandTickets, inventoryMax, money } = useGameStore();
  const inventoryPurchaseCount = useGameStore(s => s.inventoryPurchaseCount);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);

  // localItems: inventoryItems와 동기화 (모달 열릴 때 최신 상태 반영)
  const [localItems, setLocalItems] = useState(() => [...inventoryItems]);

  // inventoryItems(Zustand) 변경 시 localItems 자동 동기화
  useEffect(() => {
    setLocalItems([...inventoryItems]);
  }, [inventoryItems]);

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 다음 슬롯 구매 가격 계산: 슬롯 번호 기준 (유저마다 동일, 한 줄=3칸 마다 2배)
  // Row 1 (1-3): 무료(기본), Row 2 (4-6): 30만원, Row 3 (7-9): 60만원, Row 4 (10-12): 120만원...
  const nextSlotCost = useMemo(() => {
    const nextSlot = inventoryMax + 1; // 구매할 슬롯 번호
    const rowIndex = Math.ceil(nextSlot / 3); // 1-indexed 행 번호
    const basePrice = 300000;
    return rowIndex <= 1 ? 0 : basePrice * Math.pow(2, rowIndex - 2);
  }, [inventoryMax]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const isLocked = index >= inventoryMax;
    const item = localItems.find((itm) => itm.slotIndex === index);
    if (isLocked || !item) {
      e.preventDefault();
      return;
    }
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const isLocked = targetIndex >= inventoryMax;
    if (isLocked) return;

    try {
      // ✅ 출발 아이템이 장착 중인지 확인
      const fromItem = localItems.find(i => i.slotIndex === draggingIndex);
      if (fromItem?.equipped) {
        useAlertStore.getState().openAlert("장착 중인 아이템은 슬롯을 변경할 수 없습니다. 장착 해제 후 다시 시도해주세요.", "알림");
        setDraggingIndex(null);
        setDragOverIndex(null);
        return;
      }

      // ✅ 대상 슬롯에 이미 아이템이 있고 그 아이템이 장착 중인 경우도 체크
      const targetItem = localItems.find(i => i.slotIndex === targetIndex);
      if (targetItem?.equipped) {
        useAlertStore.getState().openAlert("장착 중인 슬롯으로는 이동할 수 없습니다. 장착 해제 후 다시 시도해주세요.", "알림");
        setDraggingIndex(null);
        setDragOverIndex(null);
        return;
      }

      await InventoryAPI.moveSlot({ fromIdx: draggingIndex, toIdx: targetIndex });
      await useGameStore.getState().fetchCompanyData(1);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "슬롯 이동에 실패했습니다.";
      useAlertStore.getState().openAlert(msg, "오류");
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleUnlockSlot = async () => {
    if (inventoryExpandTickets <= 0) {
      useAlertStore.getState().openAlert("확장권이 부족합니다.", "경고");
      return;
    }
    const ticketItem = inventoryItems.find((i: any) => i.type === "ticket_inventory");
    if (!ticketItem || ticketItem.slotIndex === undefined) {
      useAlertStore.getState().openAlert("확장권 아이템의 슬롯 정보를 찾을 수 없습니다.", "에러");
      return;
    }

    try {
      await InventoryAPI.unlockSlot({ ticketSlotIndex: ticketItem.slotIndex });
      await useGameStore.getState().fetchCompanyData(1);
      useAlertStore.getState().openAlert("인벤토리 슬롯이 확장되었습니다.", "안내");
    } catch (e) {
      useAlertStore.getState().openAlert("인벤토리 확장에 실패했습니다.", "오류");
    }
  };

  const handlePurchaseConfirm = () => {
    setShowPurchaseConfirm(false);
    useAlertStore.getState().openAlert("아직 오픈되지 않은 기능입니다. 백엔드 통신이 연결되면 다시 시도해주세요.", "기능 미구현");
  };

  const handleDeleteItem = async () => {
    if (confirmDelete && confirmDelete.slotIndex !== undefined) {
      try {
        await InventoryAPI.decreaseItem({ slotIndex: confirmDelete.slotIndex, amount: confirmDelete.quantity });
        await useGameStore.getState().fetchCompanyData(1);
        if (selectedSlot === confirmDelete.id) setSelectedSlot(null);
        useAlertStore.getState().openAlert(`${confirmDelete.name}을(를) 버렸습니다.`, "아이템 폐기");
        setConfirmDelete(null);
      } catch (e: any) {
        const msg = e?.response?.data?.message || "아이템 버리기에 실패했습니다.";
        useAlertStore.getState().openAlert(msg, "오류");
        setConfirmDelete(null);
      }
    }
  };

  const handleEquipWorker = async (slotIndex: number) => {
    try {
      await useGameStore.getState().equipWorker(slotIndex);
      useAlertStore.getState().openAlert("일꾼이 장착되었습니다.", "안내");
    } catch (e: any) {
      useAlertStore.getState().openAlert("일꾼 장착에 실패했습니다.", "오류");
    }
  };

  const handleUnequipWorker = async () => {
    try {
      await useGameStore.getState().unequipWorker();
      useAlertStore.getState().openAlert("일꾼 장착이 해제되었습니다.", "안내");
    } catch (e: any) {
      useAlertStore.getState().openAlert("일꾼 해제에 실패했습니다.", "오류");
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
                // 실제 백엔드 DB의 slotIndex를 가진 아이템을 찾아서 해당 칸에 렌더링
                const item = localItems.find((itm) => itm.slotIndex === idx);
                const isSelected = item && selectedSlot === item.id;
                const hasTickets = inventoryExpandTickets > 0;
                const isDragOver = dragOverIndex === idx;
                const canAffordPurchase = money >= nextSlotCost;

                return (
                  <div
                    key={'slot-' + idx}
                    draggable={!isLocked && !!item}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDragEnter={() => !isLocked && setDragOverIndex(idx)}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => {
                      if (hasTickets && isExpandable) handleUnlockSlot();
                      else if (isLocked) useAlertStore.getState().openAlert("확장권이 없습니다. 미니게임에서 획득하거나 구매할 수 있습니다.", "슬롯 잠금");
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
                        {/* ✅ 장착 뱃지 표시 */}
                        {item.equipped && (
                          <span className="absolute top-2 right-3 font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full text-[10px] shadow-sm animate-bounce">E</span>
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

                    {/* 🛒 구매하기 버튼 (잠긴 슬롯 첫 번째에만 표시) */}
                    {isExpandable && (
                      <button
                        className={`absolute bottom-3 left-3 w-7 h-7 rounded-full flex items-center justify-center z-20 cursor-pointer transition-all border transform
                          ${canAffordPurchase
                            ? "text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white hover:scale-110 border-blue-200"
                            : "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed"
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPurchaseConfirm(true);
                        }}
                        title={`${nextSlotCost.toLocaleString()}원으로 슬롯 구매`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* 🗑️ 휴지통 버튼 (장착 중이면 숨김 혹은 비활성화) */}
                    {!isLocked && item && !item.equipped && (
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

                    {/* ✅ 장착/해제 버튼 (일꾼 아이템이 활성화된 경우) */}
                    {!isLocked && item && item.type.startsWith("worker_") && isSelected && (
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           if (item.equipped) handleUnequipWorker();
                           else handleEquipWorker(item.slotIndex!);
                         }}
                         className={`absolute -bottom-2 px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl transform transition-all hover:scale-110 active:scale-95 z-30
                           ${item.equipped 
                             ? "bg-rose-500 text-white hover:bg-rose-600" 
                             : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
                       >
                         {item.equipped ? "장착 해제" : "일꾼 장착"}
                       </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 슬롯 구매 확인 모달 */}
      {showPurchaseConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPurchaseConfirm(false)} />
          <div className="relative bg-white rounded-2xl border-4 border-blue-200 shadow-2xl p-6 w-[360px] animate-fade-in">
            <h3 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              슬롯 구매
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-black text-blue-600">{nextSlotCost.toLocaleString()}원</span>에 슬롯을 구매하시겠습니까?
            </p>
            <p className="text-xs text-gray-400 mb-5">현재 보유 금액: <span className={`font-bold ${money >= nextSlotCost ? "text-emerald-600" : "text-rose-500"}`}>{money.toLocaleString()}원</span></p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPurchaseConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handlePurchaseConfirm}
                disabled={money < nextSlotCost}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl border-4 border-red-200 shadow-2xl p-6 w-[350px] animate-fade-in">
            <h3 className="text-lg font-black text-gray-800 mb-3">아이템 폐기</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-bold text-red-600">{confirmDelete?.name}</span>을(를) 정말 버리시겠습니까?
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
                  <li className="flex gap-2"><span className="text-blue-500">•</span> <strong className="text-blue-600">구매하기</strong> 버튼으로 돈을 내고 슬롯을 하나 살 수 있습니다. (칸이 늘수록 가격이 2배)</li>
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