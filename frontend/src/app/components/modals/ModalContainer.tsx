import { X, Building2, Newspaper, Landmark, Gift, Bell, Settings, LucideIcon } from "lucide-react";
import { useGame } from "../../store/gameStore";
import type { ModalTab } from "../../store/gameStore";
import { CompanyProfile } from "./CompanyProfile";
import { NewsModal } from "./NewsModal";
import { PoliticsModal } from "./PoliticsModal";
import { IncentiveModal } from "./IncentiveModal";
import { NotificationModal } from "./NotificationModal";
import { SettingsModal } from "./SettingsModal";

interface TabConfig {
  key: ModalTab;
  label: string;
  icon: LucideIcon;
}

const tabs: TabConfig[] = [
  { key: "profile", label: "기·프", icon: Building2 },
  { key: "news", label: "NEWS", icon: Newspaper },
  { key: "politics", label: "정치", icon: Landmark },
  { key: "incentive", label: "인센", icon: Gift },
  { key: "notification", label: "알림", icon: Bell },
  { key: "settings", label: "설정", icon: Settings },
];

function ModalTabContent({ tab }: { tab: ModalTab }) {
  switch (tab) {
    case "profile":
      return <CompanyProfile />;
    case "news":
      return <NewsModal />;
    case "politics":
      return <PoliticsModal />;
    case "incentive":
      return <IncentiveModal />;
    case "notification":
      return <NotificationModal />;
    case "settings":
      return <SettingsModal />;
    default:
      return null;
  }
}

export function ModalContainer() {
  const { state, closeModal, switchTab } = useGame();

  if (!state.activeModal) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 rounded-2xl shadow-2xl border-2 border-gray-400 w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center bg-gray-300/80 border-b-2 border-gray-400 px-2 pt-2">
          <div className="flex gap-1 flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = state.activeModal === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm transition-all cursor-pointer ${isActive
                      ? "bg-gray-100 border-2 border-b-0 border-gray-400 text-gray-800 -mb-[2px]"
                      : "bg-gray-300 border border-transparent text-gray-600 hover:bg-gray-200"
                    }`}
                  style={{ fontWeight: isActive ? 700 : 400 }}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
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
