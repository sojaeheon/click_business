import React, { useState } from 'react';

import { useAlertStore } from "../store/useAlertStore";

// 배경 3D 씬
import { IsometricScene } from '../app/components/game/IsometricScene';
import { AuthAPI as authApi, CompanyAPI } from '../api/gameApi';

function checkGuestConflict() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("error")?.includes("GUEST_CONFLICT")) {
    window.history.replaceState({}, "", "/");
    return true;
  }
  return false;
}

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showGuestConflict, setShowGuestConflict] = useState(checkGuestConflict);

  const handleLogin = () => {
    setIsLoading(true);
    // 💡 백엔드 연동: 구글 OAuth2 로그인 요청
    sessionStorage.removeItem('isGuest');
    window.location.href = authApi.getLoginUrl();
  };

const handleGuestMode = async () => {
    setIsLoading(true);
    try {
      // ★ 기존 게스트 토큰이 있으면 재사용
      const existingToken = sessionStorage.getItem('accessToken');
      const isGuest = sessionStorage.getItem('isGuest') === 'true';

      if (existingToken && isGuest) {
        try {
          const company = await CompanyAPI.getStatus();
          if (company.data?.name) {
            window.location.href = '/main';
            return;
          }
        } catch { /* 토큰 만료 또는 기업 없음 → 아래에서 새로 생성 */ }
      }

      // 새 게스트 계정 생성
      const { data } = await authApi.createGuest();
      sessionStorage.removeItem('game-storage');
      sessionStorage.setItem('accessToken', data.data.accessToken);
      sessionStorage.setItem('isGuest', 'true');

      try {
        const company = await CompanyAPI.getStatus();
        if (company.data?.name) {
          window.location.href = '/main';
          return;
        }
      } catch { /* 기업 없음 → 산업선택으로 */ }

      window.location.href = '/onboarding';
    } catch (error) {
      console.error("게스트 로그인 실패:", error);
      useAlertStore.getState().openAlert("서버와 연결할 수 없습니다. 백엔드(8000번 포트)가 켜져 있는지 확인해 주세요.", "서버 오류");
      setIsLoading(false);
    }
};

  return (
    // 전체 화면을 채우고, 삐져나가는 배경을 숨깁니다 (overflow-hidden)
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#0a3d6b]">
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* 1. 배경 레이어 (3D 씬 + 블러 + 애니메이션) */}
      {/* ───────────────────────────────────────────────────────── */}
      
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ 
          animation: 'panCamera 20s linear infinite', // 40초 동안 아주 천천히 좌우로 움직임
          filter: 'blur(8px) brightness(0.7)' // 블러 처리 및 버튼이 잘 보이도록 살짝 어둡게
        }}
      >
        <IsometricScene isLoginMode={true}/>
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* 2. 로그인 UI 레이어 (기존 코드 유지, z-index 높임) */}
      {/* ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        <div className="mb-12 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          <img src="/logo.png" alt="딸깍 비즈니스 로고" className="w-[600px] object-contain" />
        </div>

        <div className="flex flex-col items-center gap-5">
          <button
            className="relative w-64 h-20 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer bg-transparent border-none p-0 group"
            onClick={handleLogin}
          >
            <img 
              src="/ui_icons/Button_Play_Blue.png" 
              alt="Login BG" 
              className="absolute inset-0 w-full h-full object-fill drop-shadow-lg group-hover:brightness-110 transition-all" 
            />
            <span className="relative text-white font-black text-2xl tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]">
              로 그 인
            </span>
          </button>
          
          <button
            className="relative w-64 h-20 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer bg-transparent border-none p-0 group"
            onClick={handleGuestMode}
          >
            <img 
              src="/ui_icons/Button_Exit_Yellow.png" 
              alt="Guest BG" 
              className="absolute inset-0 w-full h-full object-fill drop-shadow-lg group-hover:brightness-110 transition-all" 
            />
            <span className="relative text-white font-black text-2xl tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]">
              게스트 모드
            </span>
          </button>
        </div>
      </div>
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* 3. 전체 화면 로딩 오버레이 */}
      {/* ───────────────────────────────────────────────────────── */}
      {/* 게스트 연동 충돌 팝업 */}
      {showGuestConflict && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-2xl p-8 w-96 text-center space-y-4">
            <h3 className="text-lg font-bold text-gray-800">이미 가입된 계정입니다</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              해당 Google 계정은 이미 가입되어 있습니다.<br />
              계속 진행하면 현재 게스트 모드에서 진행된<br />
              <span className="text-red-500 font-semibold">모든 데이터가 삭제</span>됩니다.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowGuestConflict(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-semibold cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  // confirm 쿠키 설정 후 다시 소셜 연동
                  document.cookie = "GUEST_LINK_CONFIRM=true; path=/; max-age=600";
                  authApi.linkSocial();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                기존 계정으로 로그인
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center flex-col animate-fade-in">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-white rounded-full animate-spin shadow-[0_0_15px_#60a5fa] mb-6"></div>
          <h2 className="text-white text-2xl font-bold tracking-widest animate-pulse drop-shadow-md">
            서버와 연결 중입니다...
          </h2>
        </div>
      )}
    </div>
  );
};