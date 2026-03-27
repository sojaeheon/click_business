import { useState, useEffect } from "react";
import { ClipboardList, Volume2, VolumeX, LogOut, Link2 } from "lucide-react";
import { useAlertStore } from "../../../store/useAlertStore";
import { UserAPI, AuthAPI } from "../../../api/gameApi";
import { useGameStore } from "../../../store/gameStore";

export function SettingsModal() {
  const volume = useGameStore(state => state.bgmVolume);
  const setVolume = useGameStore(state => state.setBgmVolume);
  const sfxVolume = useGameStore(state => state.sfxVolume);
  const setSfxVolume = useGameStore(state => state.setSfxVolume);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userProfile, setUserProfile] = useState<{ email: string; loginMethod: string }>({
    email: "로딩 중...",
    loginMethod: sessionStorage.getItem('isGuest') === 'true' ? "게스트 모드" : "소셜 연동",
  });

  useEffect(() => {
    const fetchUser = async () => {
      if (userProfile.loginMethod === "게스트 모드") {
        setUserProfile(prev => ({ ...prev, email: "게스트 사용자" }));
        return;
      }
      try {
        const res = await UserAPI.getMe();
        setUserProfile(prev => ({
          ...prev,
          email: res.data?.data?.email || "이메일 정보 없음",
        }));
      } catch (err) {
        setUserProfile(prev => ({ ...prev, email: "정보를 불러올 수 없습니다" }));
      }
    };
    fetchUser();
  }, [userProfile.loginMethod]);

  const doLogout = async () => {
    try { await AuthAPI.logout(); } catch { /* ignore */ }
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("isGuest");
    window.location.href = "/";
  };



  return (
    <div className="relative">
      <h2 className="text-xl text-gray-800 mb-4" style={{ fontWeight: 700 }}>설정</h2>

      <div className="bg-white rounded-xl border-2 border-gray-300 p-5 space-y-5">

        {/* 계정 정보 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-28 flex-shrink-0">로그인 한 계정 :</span>
            <span className="text-gray-800 font-medium">{userProfile.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-28 flex-shrink-0">로그인 방식 :</span>
            <div className="flex gap-2">
              {["소셜 연동", "게스트 모드"].map((method) => (
                <span
                  key={method}
                  className={`text-xs px-3 py-1 rounded-full border ${userProfile.loginMethod === method
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

        {/* 설문 / 피드백 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-28 flex-shrink-0">피드백 :</span>
          <button
            onClick={() => window.open("https://forms.gle/sj3qf7MkmQmHT4Vw9", "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-700 transition-colors cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            설문 / 피드백
          </button>
        </div>

        <hr className="border-gray-200" />

        {/* BGM 음량 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-28 flex-shrink-0">BGM :</span>
          <button onClick={() => setVolume(volume > 0 ? 0 : 70)} className="flex-shrink-0 cursor-pointer">
            {volume > 0
              ? <Volume2 className="w-4 h-4 text-gray-400" />
              : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
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

        {/* SFX 효과음 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-28 flex-shrink-0">효과음 :</span>
          <button onClick={() => setSfxVolume(sfxVolume > 0 ? 0 : 50)} className="flex-shrink-0 cursor-pointer">
            {sfxVolume > 0
              ? <Volume2 className="w-4 h-4 text-gray-400" />
              : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={sfxVolume}
            onChange={(e) => setSfxVolume(Number(e.target.value))}
            className="flex-1 accent-gray-700"
          />
          <span className="text-sm text-gray-500 w-8 text-right">{sfxVolume}%</span>
        </div>

        <hr className="border-gray-200" />

        {/* 게스트 → 소셜 연동 버튼 */}
        {userProfile.loginMethod === "게스트 모드" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-28 flex-shrink-0">계정 연동 :</span>
            <button
              onClick={() => AuthAPI.linkSocial()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-700 font-semibold transition-colors cursor-pointer"
            >
              <Link2 className="w-4 h-4" />
              Google 계정 연동
            </button>
          </div>
        )}

        <hr className="border-gray-200" />

        {/* 하단 버튼 */}
        <div className="flex justify-end pt-1">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-white font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* 로그아웃 확인 팝업 */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="absolute inset-0 bg-black/30 rounded-2xl" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-2xl border-2 border-gray-300 shadow-2xl p-6 w-80 text-center space-y-4">
            <LogOut className="w-10 h-10 text-gray-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-800">로그아웃 하시겠습니까?</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-semibold cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                onClick={doLogout}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold cursor-pointer transition-colors"
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
