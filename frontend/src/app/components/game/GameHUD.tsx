import { useGame } from "../../../store/gameStore";
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

export function GameHUD() {
  const { state, openModal } = useGame();
  const unreadAlerts = state.alerts.filter((n) => !n.read).length;

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ── 폰트는 기본적으로 전체 프로젝트가 sans를 따르도록 하되, HUD 전체에 명시적 적용 ── */}
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
            딸깍 컴퍼니
          </span>
        </button>

        {/* 중앙: 잔액 + 재고량 (분리 및 디자인 변경) */}
        <div className="flex-1 flex items-start justify-center gap-10 mt-4 pointer-events-auto">

          {/* 현 잔액 영역 */}
          <div className="relative flex items-center bg-[#292631] rounded-r-full rounded-l-3xl h-12 min-w-[300px] shadow-lg border border-gray-700">
            {/* 좌측 튀어나온 둥근 아이콘 (동전) */}
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-16 h-16  flex items-center justify-center z-10">
              <img src="/ui_icons/Coins.png" alt="Coins" className="w-16 h-16 object-contain drop-shadow" />
            </div>
            {/* 텍스트 영역 */}
            <div className="pl-14 pr-6 w-full flex flex-col items-center justify-center">
              <span className="text-white font-black text-xl tracking-wider drop-shadow-md">
                {state.money.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 재고량 영역 */}
          <div className="relative flex items-center bg-[#292631] rounded-r-full rounded-l-3xl h-12 min-w-[300px] shadow-lg border border-gray-700">
            {/* 좌측 튀어나온 둥근 아이콘 (별) */}
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center z-10">
              <img src="/ui_icons/star_128x128_4.png" alt="Star" className="w-16 h-16 object-contain drop-shadow" />
            </div>

            {/* 진행바 영역 */}
            <div className="pl-14 pr-4 w-full flex items-center justify-center h-full">
              <div className="relative w-full h-5">
                {/* 채워지는 게이지 이미지 마스킹 */}
                <div
                  className="absolute left-[-10%] h-[100%] overflow-hidden transition-all duration-700 ease-out flex justify-start items-center rounded-sm"
                  style={{ width: `${state.inventoryPercent * 0.9}%` }}
                >
                  <img src="/ui_icons/Progressbar_Gold_3.png" alt="Gauge Fill" className="h-full w-[130px] max-w-none object-fill" />
                </div>
                {/* 텍스트 표기 (진행바 위) */}
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-[12px] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-widest pointer-events-none">
                  {state.inventoryPercent.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 상단: 알림 + 설정 (비율 1.5배~2배 확대) */}
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

      {/* ── 왼쪽 세로: 앱 아이콘들도 1.5배~2배 확대 ── */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-6 pointer-events-auto">
        {leftButtons.map(({ key, label, imgSrc }) => (
          <button
            key={key}
            onClick={() => openModal(key)}
            className="flex flex-col items-center gap-2 w-24 hover:scale-110 transition-transform cursor-pointer active:scale-95 group"
            title={label}
          >
            {/* 투명 테두리 상자 완전 제거, 순수 이미지만 노출 */}
            <div className="relative w-20 h-20 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src={imgSrc} alt={label} className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <span className="text-sm text-white font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,1)] tracking-widest leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
