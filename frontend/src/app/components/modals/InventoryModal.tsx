import { useState, useEffect } from "react";
import { Lock, ShoppingBag, HelpCircle, X, Loader2 } from "lucide-react";
import { InventoryAPI } from "../../../api/gameApi";
import { useAlertStore } from "../../../store/useAlertStore";
import { WorkerCard, WorkerEquippedDisplay, type WorkerItem } from "../ui/WorkerCard";

interface InventorySlot extends WorkerItem {
  icon?: string;
  modelPath?: string;
  quantity?: number;
  workerType?: string;
}

export function InventoryModal() {
  const [slots, setSlots] = useState<InventorySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandTickets, setExpandTickets] = useState(1); // 테스트용: 보유 확장권 1개
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // 현재 장착된 일꾼 (단일 슬롯)
  const [equippedSlot, setEquippedSlot] = useState<WorkerItem | null>({
    id: 101,
    name: "수습 광부",
    level: 2,
  });

  // 슬롯 더블클릭 로직
  const handleSlotDoubleClick = (slot: InventorySlot) => {
    if (slot.locked) return;
    // 선택 토글 등 필요한 로직
    setSelectedSlot(selectedSlot === slot.id ? null : slot.id);
  };

  // 초기 데이터 불러오기
  useEffect(() => {
    let isMounted = true;
    InventoryAPI.getInventory(1) // 임시 companyId: 1
      .then((res) => {
        if (!isMounted) return;
        setSlots(res.data);
        setError(false);
      })
      .catch((err) => {
        console.error("인벤토리 조회 오류:", err);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  // 슬롯 확장 (잠금 해제) - API 연동 추가
  const handleUnlockSlot = async (slotId: number) => {
    if (expandTickets <= 0) return;
    try {
      await InventoryAPI.unlockSlot({ companyId: 1, slotId });
      setExpandTickets((t) => t - 1);
      setSlots((prev) =>
        prev.map((slot) => (slot.id === slotId ? { ...slot, locked: false } : slot))
      );
    } catch (err: any) {
      useAlertStore.getState().openAlert(err?.response?.data?.message || "슬롯 확장에 실패했습니다.", "경고");
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* 헤더 부분 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>인벤토리</h2>
        </div>
        {/* 인벤토리 사용법 버튼 */}
        <button
          onClick={() => setShowHelp(true)}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-4 flex-1 mt-2">
        {/* 왼쪽: 현재 장착된 일꾼 - WorkerEquippedDisplay로 통일 */}
        <div className="w-1/2 bg-gradient-to-b from-blue-50/50 to-indigo-50/80 rounded-2xl border border-white shadow-[inset_0_2px_15px_rgba(255,255,255,0.8),0_10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <WorkerEquippedDisplay worker={equippedSlot ? { ...equippedSlot, name: equippedSlot.name } : null} />
        </div>

        {/* 오른쪽: 인벤토리 슬롯 (2x2 그리드) */}
        <div className="w-1/2 bg-white rounded-xl border-2 border-gray-300 p-4 flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-semibold">인벤토리 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-rose-500">
              <p className="font-bold">통신 오류 발생</p>
              <p className="text-sm">서버 또는 목업 연결을 확인하세요.</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-4 h-full">
            {slots.map((slot) => {
              const isExpandable = slot.locked && expandTickets > 0;
              const isSelected = selectedSlot === slot.id;

              return (
                <button
                  key={slot.id}
                  onDoubleClick={() => handleSlotDoubleClick(slot)}
                  onClick={() => {
                    if (isExpandable) handleUnlockSlot(slot.id);
                    else if (!slot.locked && slot.name) {
                      setEquippedSlot(slot);
                      setSelectedSlot(slot.id);
                    }
                  }}
                  className={`relative rounded-2xl flex flex-col items-center justify-center transition-all duration-300 h-full min-h-[140px] transform group
                    ${slot.locked
                      ? isExpandable
                        ? "bg-slate-50 border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 cursor-pointer opacity-100 hover:-translate-y-1"
                        : "bg-slate-100/50 border border-slate-200 opacity-60 cursor-not-allowed"
                      : slot.name
                        ? isSelected
                          ? "bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-300 shadow-md ring-2 ring-blue-400 ring-offset-2 scale-105"
                          : "bg-white border border-gray-200 hover:border-blue-300 hover:shadow-lg cursor-pointer hover:-translate-y-1 shadow-sm"
                        : "bg-gray-50/80 border border-dashed border-gray-300 hover:border-gray-400 hover:bg-white cursor-pointer"
                    }`}
                >
                  <span className="absolute top-2 left-3 text-sm font-bold text-gray-400/80 tracking-widest">#{slot.id}</span>
                  {slot.locked ? (
                    <div className="flex flex-col items-center text-gray-400">
                      <Lock className={`w-10 h-10 mb-1 transition-transform ${isExpandable && "group-hover:scale-110 group-hover:text-yellow-600"}`} />
                    </div>
                  ) : slot.name ? (
                    <div className="flex flex-col items-center relative z-10 mt-2">
                      {/* ✨ 통일된 아이콘 */}
                      <span className="text-4xl mb-2 drop-shadow-md transition-transform group-hover:scale-110">
                        {slot.icon ?? "🧑\u200d🔧"}
                      </span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full shadow-sm ${isSelected ? "bg-blue-500 text-white" : "text-gray-700 bg-white border border-gray-100"}`}>
                        Lv.{slot.level} {slot.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">비어있음</span>
                  )}
                  {slot.locked && (
                    <div className="absolute bottom-2 right-3 text-sm font-bold text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">
                      {expandTickets}/1
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {/* 사용법 팝업 (전체화면 모달) */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHelp(false)} />
          <div className="relative bg-white rounded-2xl border-2 border-gray-300 shadow-2xl p-8 w-[400px]">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              인벤토리 사용법
            </h3>

            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <p className="font-semibold text-gray-700 mb-1">📦 장착 및 해제</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs ml-1">
                  <li>오른쪽 인벤토리 목록에서 장착할 일꾼을 두 번 클릭</li>
                  <li>왼쪽 메인 화면에 장착된 일꾼이 나타납니다.</li>
                </ul>
              </div>
              <hr className="border-gray-200" />
              <div>
                <p className="font-semibold text-gray-700 mb-1">🔓 인벤토리 확장</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs ml-1">
                  <li>자물쇠 슬롯 우측 하단에 확장권 보유량이 표시됩니다.</li>
                  <li>보유한 확장권이 1개 이상일 경우, 자물쇠를 클릭하면 해제됩니다.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
