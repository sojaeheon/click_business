import { Building2, Newspaper, Trophy, Backpack, Bell, Settings, LucideIcon } from "lucide-react";
import { useGame } from "../../store/gameStore";
import type { ModalTab } from "../../store/gameStore";

interface HudButton {
  key: ModalTab;
  label: string;
  icon: LucideIcon;
}

// 왼쪽 세로 버튼: 뉴스, 명예의전당, 인벤토리
const leftButtons: HudButton[] = [
  { key: "news",      label: "뉴스",        icon: Newspaper },
  { key: "incentive", label: "명예의 전당", icon: Trophy    },
  { key: "inventory", label: "인벤토리",    icon: Backpack  },
];

export function GameHUD() {
  const { state, openModal } = useGame();
  const unreadNotifications = state.notifications.filter((n) => !n.read).length;

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ── 상단 바 ── */}
      <div className="flex items-start p-3 gap-3">

        {/* 왼쪽 상단: 기업 프로필 (크게, 아이콘만) */}
        <button
          onClick={() => openModal("profile")}
          className="pointer-events-auto flex items-center justify-center w-20 h-20 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-gray-300 shadow-lg hover:bg-gray-100 transition-all cursor-pointer active:scale-95 flex-shrink-0"
          title="기업 프로필"
        >
          <Building2 className="w-10 h-10 text-gray-700" />
        </button>

        {/* 중앙: 잔액 + 재고량 */}
        <div className="flex-1 flex items-start justify-center">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-xl border-2 border-gray-300 shadow-lg px-5 py-2 flex items-center gap-3">
            <div>
              <div className="text-[10px] text-gray-400">현 잔액</div>
              <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>
                {state.money.toLocaleString()} {state.currency}
              </span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <div className="text-[10px] text-gray-400 mb-1">재고량</div>
              <div className="w-28 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${state.inventoryPercent}%`,
                    background: `linear-gradient(90deg, #fbbf24, #f97316, #ef4444)`,
                  }}
                />
              </div>
              <div className="text-right text-[10px] text-gray-400 mt-0.5">
                {state.inventoryPercent.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 상단: 알림 + 설정 (가로) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 알림 */}
          <button
            onClick={() => openModal("notification")}
            className="pointer-events-auto relative w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full border-2 border-gray-300 shadow-lg flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
            title="알림"
          >
            <Bell className="w-5 h-5 text-gray-700" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                {unreadNotifications}
              </span>
            )}
          </button>
          {/* 설정 */}
          <button
            onClick={() => openModal("settings")}
            className="pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full border-2 border-gray-300 shadow-lg flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
            title="설정"
          >
            <Settings className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* ── 왼쪽 세로: 뉴스, 명예의전당, 인벤토리 (아이콘 + 라벨) ── */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
        {leftButtons.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => openModal(key)}
            className="flex flex-col items-center gap-0.5 w-16 py-2.5 rounded-xl bg-white/85 backdrop-blur-sm border border-gray-300 shadow hover:bg-gray-100 transition-all cursor-pointer active:scale-95"
            title={label}
          >
            <Icon className="w-6 h-6 text-gray-700" />
            <span className="text-[10px] text-gray-500 leading-tight text-center">{label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}
