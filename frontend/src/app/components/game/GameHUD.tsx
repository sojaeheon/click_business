import { useGame, useGameStore } from "../../../store/gameStore";
import type { ModalTab } from "../../../store/gameStore";

interface HudButton {
  key: ModalTab;
  label: string;
  imgSrc: string;
}

// 왼쪽 세로 버튼: 뉴스, 명예의전당, 인벤토리
const leftButtons: HudButton[] = [
  { key: "news", label: "뉴스", imgSrc: "/ui_icons/news.png" },
  { key: "ranking", label: "명예의 전당", imgSrc: "/ui_icons/cup_128x128.png" },
  { key: "inventory", label: "인벤토리", imgSrc: "/ui_icons/inventory.png" },
];

/** onOpenGuide: App.tsx에서 ControlGuideModal 상태를 올려서 관리 (pointer-events-none 이슈 방지) */
export function GameHUD({ onOpenGuide }: { onOpenGuide?: () => void }) {
  const { state, openModal } = useGame();
  const percent = useGameStore(state => state.getWarehouseUsage().percent);
  const companyName = useGameStore(s => s.companyName);
  const unreadAlerts = state.alerts.filter((n) => !n.read).length;

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ── HUD 상단 바 ── */}
      <div className="flex items-start p-4 gap-6 font-sans">

        {/* 왼쪽 상단: 기업 프로필 */}
        <button
          onClick={() => openModal("profile")}
          className="pointer-events-auto relative flex flex-col items-center justify-start w-32 h-36 hover:scale-105 transition-transform cursor-pointer active:scale-95 flex-shrink-0"
          title="기업 프로필"
        >
          {/* 기업프로필 배경 (Group 59) */}
          <div className="relative w-32 h-32 flex items-start justify-center">
            <img src="/ui_icons/Group 59.png" alt="Profile BG" className="absolute inset-0 w-full h-full object-contain drop-shadow-md" />
            <img src="/ui_icons/building.png" alt="Building" className="relative w-20 h-20 mt-1 object-contain drop-shadow" />
          </div>
          {/* 하단 회사 이름 텍스트 */}
          <span className="text-white font-bold text-sm tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] -mt-6">
            {state.companyName}
          </span>
        </button>

        {/* 중앙: 잔액 + 재고량 */}
        <div className="flex-1 flex items-start justify-center gap-10 mt-4 pointer-events-auto">

          {/* 현 잔액 영역 */}
          <div className="relative flex items-center bg-[#292631] rounded-r-full rounded-l-3xl h-12 min-w-[300px] shadow-lg border border-gray-700">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-16 h-16  flex items-center justify-center z-10">
              <img src="/ui_icons/Coins.png" alt="Coins" className="w-16 h-16 object-contain drop-shadow" />
            </div>
            <div className="pl-14 pr-6 w-full flex flex-col items-center justify-center">
              <span className="text-white font-black text-xl tracking-wider drop-shadow-md">
                {state.money.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 재고량 영역 */}
          <div className="relative flex items-center bg-[#292631] rounded-full rounded-3xl ml-10 h-12 min-w-[300px] shadow-lg border border-gray-700">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center z-10">
              <img src="/ui_icons/box.png" alt="Box" className="w-20 h-20 object-contain drop-shadow" />
            </div>

            <div className="pl-10 pr-4 w-full flex items-center justify-center h-full">
              <div className="relative w-full h-5 bg-gray-900 rounded overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-400 to-amber-600"
                  style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-base drop-shadow-[0_2px_3px_rgba(0,0,0,1)] tracking-widest pointer-events-none z-10">
                  {percent.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 상단: 알림 + 설정 */}
        <div className="flex items-center gap-5 flex-shrink-0 pt-2 pr-4">
          <button
            onClick={() => openModal("alert")}
            className="pointer-events-auto relative w-20 h-20 hover:scale-110 transition-transform cursor-pointer"
            title="알림"
          >
            <img src="/ui_icons/notification.png" alt="Notification" className="w-full h-full object-contain drop-shadow-lg" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1 -right-1 bg-red-600 border-[3px] border-white text-white font-black text-xs w-7 h-7 flex items-center justify-center rounded-full shadow-md">
                {unreadAlerts}
              </span>
            )}
          </button>
          <button
            onClick={() => openModal("settings")}
            className="pointer-events-auto relative w-20 h-20 hover:scale-110 transition-transform cursor-pointer"
            title="설정"
          >
            <img src="/ui_icons/setting.png" alt="Settings" className="w-full h-full object-contain drop-shadow-lg" />
          </button>
        </div>
      </div>

      {/* ── 왼쪽 세로: 앱 아이콘들 ── */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-6 pointer-events-auto">
        {leftButtons.map(({ key, label, imgSrc }) => (
          <button
            key={key}
            onClick={() => openModal(key)}
            className="flex flex-col items-center gap-2 w-24 hover:scale-110 transition-transform cursor-pointer active:scale-95 group"
            title={label}
          >
            <div className="relative w-20 h-20 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src={imgSrc} alt={label} className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <span className="text-sm text-white font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,1)] tracking-widest leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>

      {/* ── ? 조작 가이드 버튼 (우측 하단 고정) ── */}
      <button
        onClick={() => onOpenGuide?.()}
        className="pointer-events-auto absolute bottom-6 right-6 w-12 h-12 rounded-full bg-gray-800/90 border-2 border-gray-600 text-white font-black text-xl hover:bg-indigo-600 hover:border-indigo-400 hover:scale-110 transition-all shadow-lg flex items-center justify-center"
        title="조작 가이드"
      >
        ?
      </button>

    </div>
  );
}
