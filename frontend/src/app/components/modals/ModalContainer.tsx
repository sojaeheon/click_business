import { X, Building2, Newspaper, Trophy, Backpack, Bell, Settings, LucideIcon } from "lucide-react";
import { useGame } from "../../store/gameStore";
import type { ModalTab } from "../../store/gameStore";
import { CompanyProfile } from "./CompanyProfile";
import { NewsModal } from "./NewsModal";
import { IncentiveModal } from "./IncentiveModal";
import { InventoryModal } from "./InventoryModal";
import { NotificationModal } from "./NotificationModal";
import { SettingsModal } from "./SettingsModal";

interface TabConfig {
  key: ModalTab;
  label: string;
  icon: LucideIcon;
}

// 탭 순서: 기업 프로필 / 뉴스 / 명예의 전당 / 인벤토리 / 알림 / 설정
const tabs: TabConfig[] = [
  { key: "profile",      label: "기업 프로필", icon: Building2  },
  { key: "news",         label: "뉴스",        icon: Newspaper  },
  { key: "incentive",    label: "명예의 전당", icon: Trophy     },
  { key: "inventory",    label: "인벤토리",    icon: Backpack   },
  { key: "notification", label: "알림",        icon: Bell       },
  { key: "settings",     label: "설정",        icon: Settings   },
];

function ModalTabContent({ tab }: { tab: ModalTab }) {
  switch (tab) {
    case "profile":      return <CompanyProfile />;
    case "news":         return <NewsModal />;
    case "incentive":    return <IncentiveModal />;
    case "inventory":    return <InventoryModal />;
    case "notification": return <NotificationModal />;
    case "settings":     return <SettingsModal />;
    default:             return null;
  }
}

export function ModalContainer() {
  const { state, closeModal, switchTab } = useGame();

  if (!state.activeModal) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

      {/* Modal */}
      <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 rounded-2xl shadow-2xl border-2 border-gray-400 w-[720px] h-[520px] max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Tab bar — 아이콘만 표시 */}
        <div className="flex items-center bg-transparent border-b-2 border-gray-400 px-4 pt-2">
          <div className="flex gap-2 flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = state.activeModal === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  title={tab.label}
                  className={`flex items-center justify-center w-24 h-12 rounded-t-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-gray-100 border-2 border-b-0 border-gray-400 text-gray-800 -mb-[2px] shadow-[0_-2px_6px_-2px_rgba(0,0,0,0.1)]"
                      : "bg-transparent border-2 border-transparent text-gray-500 hover:bg-black/5"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </button>
              );
            })}
          </div>
          {/* 닫기 버튼 */}
          <button
            onClick={closeModal}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-400/50 transition-colors cursor-pointer ml-2 mb-1"
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <ModalTabContent tab={state.activeModal} />
        </div>
      </div>
    </div>
  );
}
