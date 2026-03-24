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
  const inGameDate = useGameStore(s => s.inGameDate);
  const dayProgress = useGameStore(s => s.dayProgress);
  const unreadAlerts = state.alerts.filter((n) => !n.read).length;

  const [year, month, day] = inGameDate.split('-');
  const progressPct = Math.min(Math.max(dayProgress * 100, 0), 100);

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ── HUD 상단 바 ── */}
      <div className="flex items-start p-4 gap-6 font-sans">

        {/* 왼쪽 상단: 기업 프로필 */}
        <button
          onClick={() => openModal("profile")}
          className="pointer-events-auto w-40 relative flex flex-col items-center justify-start hover:scale-105 transition-transform cursor-pointer active:scale-95 flex-shrink-0"
          title="기업 프로필"
        >
          <div className="relative w-40 h-40 flex items-start justify-center">
            <img src="/ui_icons/Group 59.png" alt="Profile BG" className="absolute inset-0 w-full h-full object-contain drop-shadow-md" />
            <img src="/ui_icons/building.png" alt="Building" className="relative w-20 h-20 mt-4 object-contain drop-shadow" />
          </div>
          {/* 회사 이름 — 아이콘 너비(120px) 내에서 줄바꿈 */}
          <span className="max-w-[120px] text-white font-bold text-sm tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] -mt-10 text-center break-all leading-snug">
            {state.companyName}
          </span>
        </button>

        {/* 중앙: 잔액 + 재고량 */}
        <div className="flex-1 flex items-start justify-center gap-10 mt-4 pointer-events-auto">

          {/* 현 잔액 영역 */}
          <div className="relative flex items-center bg-[#292631] rounded-r-full rounded-l-3xl h-12 min-w-[300px] shadow-lg border border-gray-700">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center z-10">
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

        {/* ── 오른쪽 상단: 날짜 패널 (알림+설정 내장) ── */}
        <div className="pointer-events-auto flex-shrink-0 mr-2 mt-1 flex items-start gap-3">

          {/* 날짜 + 슬라이더 */}
          <div className="flex flex-col items-end gap-2">
            {/* 연도 */}
            <span className="text-white/60 text-lg mb-2 font-bold tracking-[0.2em] drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
              20XX년
            </span>
            {/* 월일 — 큰 텍스트 */}
            <span className="text-white font-black text-4xl tracking-wider leading-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]">
              {`${parseInt(month)}월 ${parseInt(day)}일`}
            </span>
            {/* 하루 경과 슬라이더 */}
            <div className="relative w-full mt-3 h-3 bg-[#292631] rounded-full border border-gray-600 shadow-inner mt-0.5">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-linear bg-gradient-to-r from-amber-500 to-amber-300"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute -top-2.5 -translate-x-1/2 z-10 text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] transition-all duration-1000 ease-linear select-none"
                style={{ left: `${Math.max(8, progressPct)}%` }}
              >
                ☀️
              </div>
            </div>
          </div>

          {/* 알림 + 설정 */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => openModal("alert")}
              className="relative w-14 h-14 hover:scale-110 transition-transform cursor-pointer"
              title="알림"
            >
              <img src="/ui_icons/notification.png" alt="알림" className="w-full h-full object-contain drop-shadow-lg" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 border-[3px] border-white text-white font-black text-[10px] w-6 h-6 flex items-center justify-center rounded-full shadow-md">
                  {unreadAlerts}
                </span>
              )}
            </button>
            <button
              onClick={() => openModal("settings")}
              className="w-14 h-14 hover:scale-110 transition-transform cursor-pointer"
              title="설정"
            >
              <img src="/ui_icons/setting.png" alt="설정" className="w-full h-full object-contain drop-shadow-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 왼쪽 세로: 프로필 버튼 아래에 간격 두고 배치 ── */}
      <div className="absolute left-6 top-[200px] flex flex-col gap-6 pointer-events-auto">
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
