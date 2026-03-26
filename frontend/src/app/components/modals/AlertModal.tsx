import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useGame } from "../../../store/gameStore";

export function AlertModal() {
  const { state, markAllAlertsAsRead, dismissAlert } = useGame();

  // 모달 진입 시점의 읽지 않은 알람 기록. 여기서 기록된 알람은 모달 내내 NEW로 보임
  const [initialUnreadIds] = useState(() =>
    new Set(state.alerts.filter((a) => !a.read).map((a) => a.id))
  );

  useEffect(() => {
    markAllAlertsAsRead();
  }, [markAllAlertsAsRead]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <Bell className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>알림</h2>
        <span className="text-sm text-gray-400 ml-2">
          {state.alerts.filter((n) => initialUnreadIds.has(n.id) || !n.read).length}개 읽지 않음
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar pb-4"
      >
        {state.alerts.map((notification) => {
          const isNew = initialUnreadIds.has(notification.id) || !notification.read;

          return (
            <div
              key={notification.id}
              className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${isNew
                  ? "bg-white border-gray-400 shadow-sm"
                  : "bg-gray-50 border-gray-200"
                }`}
            >
              <div className="flex-1">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-gray-800" style={{ fontWeight: isNew ? 700 : 400 }}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2">
                    {isNew && (
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        NEW
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissAlert(notification.id);
                      }}
                      className="p-1 -mr-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {notification.detail && (
                  <p className="text-sm text-gray-500 mt-0.5">{notification.detail}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {notification.timeAgo}
                  </span>
                </div>
              </div>

            </div>
          )
        })}

        {state.alerts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>새로운 알림이 없습니다</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] text-gray-400 text-center flex-shrink-0">
        알림은 24시간 이내까지만 보관됩니다
      </div>
    </div>
  );
}
