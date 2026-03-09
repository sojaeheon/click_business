import { useState } from "react";
import { Mail, Volume2, LogOut, UserX } from "lucide-react";

// 💡 [백엔드 연동] 실제 구현 시 로그인된 유저 정보를 props 또는 context에서 받아오세요.
const MOCK_USER = {
  email: "user@gmail.com",
  loginMethod: "소셜 연동", // "소셜 연동" | "게스트 모드"
};

export function SettingsModal() {
  const [volume, setVolume] = useState(70);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const handleLogout = () => {
    // 💡 [백엔드 연동] POST /api/v1/auth/logout
    if (window.confirm("로그아웃 하시겠습니까?")) {
      alert("로그아웃 되었습니다. (로그인 페이지로 이동 예정)");
      // navigate("/")
    }
  };

  const handleWithdraw = () => {
    // 💡 [백엔드 연동] 회원 탈퇴 API 연동 필요
    alert("회원 탈퇴가 완료되었습니다. 모든 데이터가 삭제됩니다.");
    setShowWithdrawConfirm(false);
  };

  return (
    <div className="relative">
      <h2 className="text-xl text-gray-800 mb-4" style={{ fontWeight: 700 }}>설정</h2>

      <div className="bg-white rounded-xl border-2 border-gray-300 p-5 space-y-5">

        {/* 계정 정보 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-28 flex-shrink-0">로그인 한 계정 :</span>
            <span className="text-gray-800 font-medium">{MOCK_USER.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-28 flex-shrink-0">로그인 방식 :</span>
            <div className="flex gap-2">
              {["소셜 연동", "게스트 모드"].map((method) => (
                <span
                  key={method}
                  className={`text-xs px-3 py-1 rounded-full border ${MOCK_USER.loginMethod === method
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-gray-100 text-gray-400 border-gray-200"
                    }`}
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* 문의하기 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-28 flex-shrink-0">문의 :</span>
          <button
            onClick={() => window.open("mailto:support@example.com")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-700 transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            이메일 문의
          </button>
        </div>

        <hr className="border-gray-200" />

        {/* 음량조절 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-28 flex-shrink-0">음량조절 :</span>
          <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 accent-gray-700"
          />
          <span className="text-sm text-gray-500 w-8 text-right">{volume}%</span>
        </div>

        <hr className="border-gray-200" />

        {/* 하단 버튼들 */}
        <div className="flex justify-end gap-3 pt-1">
          {/* 로그아웃 (왼쪽) */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-white font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>

          {/* 회원탈퇴 (오른쪽) */}
          <button
            onClick={() => setShowWithdrawConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-red-50 border border-gray-300 hover:border-red-300 rounded-xl text-sm text-gray-500 hover:text-red-500 transition-all cursor-pointer"
          >
            <UserX className="w-4 h-4" />
            회원탈퇴
          </button>
        </div>
      </div>

      {/* 회원탈퇴 확인 팝업 */}
      {showWithdrawConfirm && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="absolute inset-0 bg-black/30 rounded-2xl" onClick={() => setShowWithdrawConfirm(false)} />
          <div className="relative bg-white rounded-2xl border-2 border-red-300 shadow-2xl p-6 w-80 text-center space-y-4">
            <UserX className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-bold text-gray-800">정말 탈퇴하시겠습니까?</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              회원 탈퇴 시 모든 데이터가 영구적으로<br />
              <span className="text-red-500 font-semibold">삭제</span>되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-semibold cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
