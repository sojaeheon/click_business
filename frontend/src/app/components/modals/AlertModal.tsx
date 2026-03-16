import { X, Bell } from "lucide-react";
import { useGame } from "../../../store/gameStore";

export function AlertModal() {
  const { state, dismissAlert } = useGame();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>알림</h2>
        <span className="text-sm text-gray-400 ml-2">
          {state.alerts.filter((n) => !n.read).length}개 읽지 않음
        </span>
      </div>

      <div className="flex-1 overflow-y-scroll space-y-2 pr-2" style={{ maxHeight: '400px' }}>
        {state.alerts.map((notification, index) => (
          <div
            key={notification.id}
            className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
              !notification.read
                ? "bg-white border-gray-400 shadow-sm"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            {/* 최신 알림 파란 점 (가장 최신에만 표시) */}
            {index === 0 && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow" />
            )}

            <div className="flex-1">
              <p className="text-gray-800" style={{ fontWeight: !notification.read ? 600 : 400 }}>
                {notification.message}
              </p>
              {notification.detail && (
                <p className="text-sm text-gray-500 mt-0.5">{notification.detail}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {notification.timeAgo}
                </span>
              </div>
            </div>

            {/* X 버튼: 알림 삭제 */}
            <button
              onClick={() => dismissAlert(notification.id)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ))}

        {state.alerts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>새로운 알림이 없습니다</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] text-gray-400 text-center">
        알림은 24시간 이내까지만 보관됩니다
      </div>
    </div>
  );
}
