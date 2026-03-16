import React from 'react';
import { useNavigate } from 'react-router-dom';

// 배경 3D 씬
import { IsometricScene } from '../app/components/game/IsometricScene';

export const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    // 💡 [백엔드 연동: 구글 로그인 요청]
    // window.location.href = 'http://localhost:8080/api/v1/auth/google/login';
    alert('실제 구현 시 GET /api/v1/auth/google/login 으로 리다이렉트 됩니다.');
    navigate('/industry-selection');
  };

  const handleGuestMode = () => {
    navigate('/industry-selection');
  };

  return (
    // 전체 화면을 채우고, 삐져나가는 배경을 숨깁니다 (overflow-hidden)
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#0a3d6b]">
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* 1. 배경 레이어 (3D 씬 + 블러 + 애니메이션) */}
      {/* ───────────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes panCamera {
          0%, 100% { transform: scale(1.15) translateX(-3%); }
          50% { transform: scale(1.15) translateX(3%); }
        }
      `}} />
      
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
      
    </div>
  );
};