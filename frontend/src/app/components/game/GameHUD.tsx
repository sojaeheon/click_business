import React from "react";
import {
  Building2,
  Newspaper,
  Trophy,
  Landmark,
  Bell,
  Coins,
  Settings,
} from "lucide-react";
import { useGame } from "../../store/gameStore";

export function GameHUD() {
  const { state, openModal } = useGame();

  const unreadNotifications = state.notifications.filter((n) => !n.read).length;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar */}
      <div className="flex items-start p-3 gap-3">
        {/* Left: Company button (2x bigger) */}
        <button
          onClick={() => openModal("profile")}
          className="pointer-events-auto flex items-center justify-center w-16 h-16 bg-white/90 backdrop-blur-sm rounded-xl border-2 border-gray-300 shadow-lg hover:bg-gray-100 transition-all cursor-pointer active:scale-95 flex-shrink-0"
          title="기업 프로필"
        >
          <Building2 className="w-8 h-8 text-gray-700" />
        </button>

        {/* Center: Balance + Inventory side by side */}
        <div className="flex-1 flex items-start justify-center gap-3">
          {/* Money display */}
          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-xl border-2 border-gray-300 shadow-lg px-4 py-2 flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400">현 잔액</div>
              <span className="text-base text-gray-800" style={{ fontWeight: 700 }}>
                {state.money.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Inventory gauge */}
          <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-xl border-2 border-gray-300 shadow-lg px-4 py-2">
            <div className="text-[10px] text-gray-400 mb-1">재고량</div>
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
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

        {/* Right: Bell + Settings side by side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => openModal("notification")}
            className="pointer-events-auto relative w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full border-2 border-gray-300 shadow-lg flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
            title="알림"
          >
            <Bell className="w-5 h-5 text-gray-700" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                {unreadNotifications}
              </span>
            )}
          </button>
          <button
            onClick={() => openModal("settings")}
            className="pointer-events-auto w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full border-2 border-gray-300 shadow-lg flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
            title="설정"
          >
            <Settings className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Left side buttons - icons only, no box background */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto">
        <button
          onClick={() => openModal("news")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/60 transition-all cursor-pointer active:scale-90"
          title="NEWS"
        >
          <Newspaper className="w-6 h-6 text-gray-600 drop-shadow-sm" />
        </button>
        <button
          onClick={() => openModal("politics")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/60 transition-all cursor-pointer active:scale-90"
          title="정치"
        >
          <Landmark className="w-6 h-6 text-gray-600 drop-shadow-sm" />
        </button>
        <button
          onClick={() => openModal("incentive")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/60 transition-all cursor-pointer active:scale-90"
          title="명예의 전당"
        >
          <Trophy className="w-6 h-6 text-gray-600 drop-shadow-sm" />
        </button>
      </div>
    </div>
  );
}
