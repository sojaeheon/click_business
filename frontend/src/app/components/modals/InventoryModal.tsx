import { useState } from "react";
import { Lock, ShoppingBag, HelpCircle, X } from "lucide-react";

interface InventorySlot {
  id: number;
  name?: string;
  level?: number;
  locked?: boolean;
}

// 임시 인벤토리 슬롯 데이터 (백엔드 연동 시 교체)
const defaultSlots: InventorySlot[] = [
  { id: 1, name: "일꾼A", level: 2 },
  { id: 2 },
  { id: 3 },
  { id: 4, locked: true },
];

export function InventoryModal() {
  const [slots, setSlots] = useState<InventorySlot[]>(defaultSlots);
  const [expandTickets, setExpandTickets] = useState(1); // 테스트용: 보유 확장권 1개
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // 현재 장착된 일꾼 (단일 슬롯)
  const [equippedSlot] = useState<InventorySlot | null>({
    id: 101,
    name: "일꾼",
    level: 2,
  });

  // 슬롯 더블클릭 로직
  const handleSlotDoubleClick = (slot: InventorySlot) => {
    if (slot.locked) return;
    // 선택 토글 등 필요한 로직
    setSelectedSlot(selectedSlot === slot.id ? null : slot.id);
  };

  // 슬롯 확장 (잠금 해제)
  const handleUnlockSlot = (slotId: number) => {
    if (expandTickets <= 0) return;
    setExpandTickets((t) => t - 1);
    setSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, locked: false } : slot))
    );
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
        {/* 왼쪽: 현재 장착된 일꾼 화면 */}
        <div className="w-1/2 bg-white rounded-xl border-2 border-gray-300 flex flex-col items-center justify-center p-6 relative">
          {/* 캐릭터 렌더링 영역 */}
          {equippedSlot ? (
            <div className="flex flex-col items-center animate-fade-in">
              <span className="text-9xl mb-4 drop-shadow-md">🧑‍🔧</span>
              {/* 캐릭터 발판 모양 (디자인 참고) */}
              <div className="relative w-48 h-12">
                <div className="absolute inset-0 bg-gray-200 rounded-lg shadow-inner border-2 border-gray-300 transform perspective-100 rotate-x-12 scale-x-110"></div>
                {/* 텍스트 라벨 (Lv.2 일꾼) */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border-2 border-gray-400 rounded px-6 py-1 whitespace-nowrap shadow-sm">
                  <span className="font-bold text-gray-800 text-lg">
                    Lv.{equippedSlot.level} {equippedSlot.name}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center opacity-40">
              <span className="text-8xl mb-4">👤</span>
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded px-5 py-1">
                장착 안됨
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 인벤토리 슬롯 (2x2 그리드) */}
        <div className="w-1/2 bg-white rounded-xl border-2 border-gray-300 p-4 flex flex-col">
          <div className="grid grid-cols-2 gap-4 h-full">
            {slots.map((slot) => {
              const isExpandable = slot.locked && expandTickets > 0;
              const isSelected = selectedSlot === slot.id;

              return (
                <button
                  key={slot.id}
                  onDoubleClick={() => handleSlotDoubleClick(slot)}
                  onClick={() => {
                    if (isExpandable) {
                      handleUnlockSlot(slot.id);
                    }
                  }}
                  className={`relative rounded-xl border-2 flex flex-col items-center justify-center transition-all h-full min-h-[140px]
                    ${slot.locked
                      ? isExpandable
                        ? "bg-gray-50 border-gray-300 hover:border-yellow-400 hover:bg-yellow-50 cursor-pointer opacity-100"
                        : "bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed"
                      : slot.name
                        ? isSelected
                          ? "bg-blue-50 border-blue-400 cursor-pointer shadow-md"
                          : "bg-white border-gray-300 hover:border-gray-400 shadow-sm cursor-pointer"
                        : "bg-gray-50 border-gray-300 hover:border-gray-400 cursor-pointer"
                    }`}
                >
                  {/* 슬롯 번호 좌측 상단 (카드형 디자인) */}
                  <span className="absolute top-2 left-3 text-sm font-semibold text-gray-500">
                    {slot.id}
                  </span>

                  {slot.locked ? (
                    <div className="flex flex-col items-center text-gray-400">
                      <Lock className="w-10 h-10 mb-1" />
                    </div>
                  ) : slot.name ? (
                    <div className="flex flex-col items-center">
                      <span className="text-5xl mb-2 drop-shadow-sm">🧑‍🔧</span>
                      <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-0.5 rounded-full">
                        Lv.{slot.level} {slot.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">비어있음</span>
                  )}

                  {/* 자물쇠 슬롯 하단의 0/1 표시 */}
                  {slot.locked && (
                    <div className="absolute bottom-2 right-3 text-sm font-bold text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">
                      {expandTickets}/1
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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
