import React, { useState, useEffect } from "react";
import { X, MousePointer2 } from "lucide-react";

export function ControlGuideModal({ forceOpen = false, onForceClose }: {
  forceOpen?: boolean;
  onForceClose?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hideForever, setHideForever] = useState(false);

  useEffect(() => {
    // 로컬스토리지에서 다시 보지 않기 여부 확인
    const hide = localStorage.getItem("hideControlGuide");
    if (!hide) {
      setIsOpen(true);
    }
  }, []);

  // forceOpen이 true로 바뀌면 무조건 열기
  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  const handleClose = () => {
    if (hideForever) {
      localStorage.setItem("hideControlGuide", "true");
    }
    setIsOpen(false);
    onForceClose?.();
  };

  if (!isOpen) return null;

  const Key = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`flex items-center justify-center bg-gradient-to-b from-gray-700 to-gray-800 border-b-4 border-b-gray-900 border-x-2 border-x-gray-600 border-t-2 border-t-gray-600 rounded-lg text-white font-bold transition-transform active:translate-y-1 active:border-b-0 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 pointer-events-auto">
      <div className="relative w-full max-w-4xl bg-[#111827] border border-gray-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl p-6 md:p-8 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-6">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            🎮딸-깍 비즈니스 조작 가이드
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-2 bg-gray-800 rounded-full hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-200">

          {/* Left Column: Movement & Basic Action */}
          <div className="space-y-6">
            {/* Movement */}
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 shadow-inner">
              <h3 className="text-lg font-bold text-blue-300 mb-5 text-center">캐릭터 이동</h3>
              <div className="flex flex-col items-center gap-2">
                <Key className="w-14 h-14 text-xl">W</Key>
                <div className="flex gap-2">
                  <Key className="w-14 h-14 text-xl">A</Key>
                  <Key className="w-14 h-14 text-xl">S</Key>
                  <Key className="w-14 h-14 text-xl">D</Key>
                </div>
                <div className="flex gap-4 pt-3 items-center justify-center w-full">
                  <span className="text-sm font-semibold text-gray-400 bg-gray-800 px-4 py-1.5 rounded-full border border-gray-700">
                    또는 방향키 (↑, ↓, ←, →)
                  </span>
                </div>
              </div>
            </div>

            {/* Interaction */}
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 shadow-inner">
              <h3 className="text-lg font-bold text-yellow-300 mb-4 text-center">상호작용 & 액션</h3>
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-4">
                  <Key className="w-16 h-12 text-lg">E</Key>
                  <Key className="w-48 h-12 text-lg tracking-[0.2em]">SPACE</Key>
                </div>
                <div className="bg-gray-800 px-4 py-3 rounded-lg border border-gray-700 w-full text-center space-y-2 text-sm text-gray-300">
                  <p>
                    <span className="text-green-400 font-bold">필드</span>에서 누르면 <strong>점프 (Space)</strong>
                  </p>
                  <p>
                    <span className="text-yellow-400 font-bold">건물 근처</span>에서 누르면 <strong>건물 입장 (Space)</strong>
                  </p>
                  <p>
                    <span className="text-purple-400 font-bold">E 키</span>를 누르면 <strong>감정표현 (이모트)</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: UI Hotkeys & Mouse */}
          <div className="space-y-6">
            {/* UI Hotkeys */}
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 shadow-inner">
              <h3 className="text-lg font-bold text-indigo-300 mb-5 text-center">HUD 단축키</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm justify-items-center mb-2">
                <div className="flex items-center gap-3 w-full max-w-[140px] hover:translate-x-1 transition-transform">
                  <Key className="w-12 h-12 text-lg text-blue-200">I</Key> <span className="font-semibold">인벤토리</span>
                </div>
                <div className="flex items-center gap-3 w-full max-w-[140px] hover:translate-x-1 transition-transform">
                  <Key className="w-12 h-12 text-lg text-yellow-200">K</Key> <span className="font-semibold">명예의 전당</span>
                </div>
                <div className="flex items-center gap-3 w-full max-w-[140px] hover:translate-x-1 transition-transform">
                  <Key className="w-12 h-12 text-lg text-green-200">N</Key> <span className="font-semibold">뉴스</span>
                </div>
                <div className="flex items-center gap-3 w-full max-w-[140px] hover:translate-x-1 transition-transform">
                  <Key className="w-12 h-12 text-lg text-purple-200">P</Key> <span className="font-semibold">기업 프로필</span>
                </div>
                <div className="flex items-center gap-3 w-full max-w-[140px] hover:translate-x-1 transition-transform">
                  <Key className="w-12 h-12 text-lg text-rose-200">L</Key> <span className="font-semibold">알림</span>
                </div>
                <div className="flex items-center gap-3 w-full max-w-[140px] hover:translate-x-1 transition-transform">
                  <Key className="w-12 h-12 text-lg text-gray-300">O</Key> <span className="font-semibold">설정</span>
                </div>
              </div>
              <p className="text-xs text-center text-gray-500 mt-4 bg-gray-800/80 py-1.5 rounded-lg border border-gray-700/30">
                * 동일한 키를 두 번 누르면 창이 전환/닫힘 처리됩니다.
              </p>
            </div>

            {/* Mouse Controls */}
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 shadow-inner">
              <h3 className="text-lg font-bold text-teal-300 mb-5 text-center">마우스 / 카메라 조작</h3>
              <div className="flex flex-col gap-4 px-2">
                <div className="flex items-center gap-4 bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="bg-gray-700 p-2 rounded-lg shadow-inner"><MousePointer2 className="w-6 h-6 text-blue-300" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-200">화면 이동 (Pan)</span>
                    <span className="text-xs text-gray-400">마우스 왼쪽 버튼 클릭 후 드래그</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="bg-gray-700 p-2 rounded-lg shadow-inner flex items-center justify-center font-bold text-blue-300 w-10 h-10 text-xl border border-gray-600">↕</div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-200">화면 줌 (Zoom)</span>
                    <span className="text-xs text-gray-400">마우스 휠 스크롤 위아래</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-between items-center pt-5 border-t border-gray-700">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
              checked={hideForever}
              onChange={(e) => setHideForever(e.target.checked)}
            />
            <span className="font-semibold">이 창 다시 보지 않기</span>
          </label>
          <button
            onClick={handleClose}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95 text-lg"
          >
            게임 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
