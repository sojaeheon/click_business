import React, { useState, useEffect } from "react";
import { X, MousePointer2 } from "lucide-react";

export function ControlGuideModal({ forceOpen = false, onForceClose }: {
  forceOpen?: boolean;
  onForceClose?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hideForever, setHideForever] = useState(false);

  useEffect(() => {
    const hide = localStorage.getItem("hideControlGuide");
    if (!hide) {
      setIsOpen(true);
    }
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hideForever, onForceClose]);

  if (!isOpen) return null;

  const Key = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`flex items-center justify-center bg-gradient-to-b from-gray-700 to-gray-800 border-b-4 border-b-gray-900 border-x-2 border-x-gray-600 border-t-2 border-t-gray-600 rounded-lg text-white font-bold transition-transform active:translate-y-1 active:border-b-0 ${className}`}>
      {children}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 pointer-events-auto"
      onClick={handleClose}
    >
      {/* ✨ 1. h-full을 없애고, max-w-3xl과 max-h-[90vh]를 줘서 화면 중앙에 쏙 들어가게 수정 */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-[#111827] border border-gray-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl p-5 md:p-6
          [&::-webkit-scrollbar]:w-2
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-gray-600
          [&::-webkit-scrollbar-thumb]:rounded-full
          hover:[&::-webkit-scrollbar-thumb]:bg-gray-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
          <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            🎮딸-깍 비즈니스 조작 가이드
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-1.5 bg-gray-800 rounded-full hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ✨ 2. 간격(gap)을 6에서 4로 줄임 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-200">

          {/* Left Column: Movement & Basic Action */}
          <div className="space-y-4">
            {/* Movement */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 shadow-inner">
              <h3 className="text-base font-bold text-blue-300 mb-3 text-center">캐릭터 이동</h3>
              <div className="flex flex-col items-center gap-2">
                {/* ✨ 3. w-14 -> w-10, text-xl -> text-lg 등 버튼 크기 아담하게 조절 */}
                <Key className="w-10 h-10 text-lg">W</Key>
                <div className="flex gap-2">
                  <Key className="w-10 h-10 text-lg">A</Key>
                  <Key className="w-10 h-10 text-lg">S</Key>
                  <Key className="w-10 h-10 text-lg">D</Key>
                </div>
                <div className="flex gap-4 pt-2 items-center justify-center w-full">
                  <span className="text-[13px] font-semibold text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                    또는 방향키 (↑, ↓, ←, →)
                  </span>
                </div>
              </div>
            </div>

            {/* Interaction */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 shadow-inner">
              <h3 className="text-base font-bold text-yellow-300 mb-3 text-center">상호작용 & 액션</h3>
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-3">
                  <Key className="w-12 h-10 text-base">E</Key>
                  <Key className="w-32 h-10 text-sm tracking-[0.2em]">SPACE</Key>
                </div>
                <div className="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 w-full text-center space-y-1.5 text-[13px] text-gray-300">
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
          <div className="space-y-4">
            {/* UI Hotkeys */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 shadow-inner">
              <h3 className="text-base font-bold text-indigo-300 mb-3 text-center">HUD 단축키</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[13px] justify-items-center mb-1">
                <div className="flex items-center gap-2 w-full max-w-[120px] hover:translate-x-1 transition-transform">
                  <Key className="w-9 h-9 text-base text-blue-200">I</Key> <span className="font-semibold">인벤토리</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[120px] hover:translate-x-1 transition-transform">
                  <Key className="w-9 h-9 text-base text-yellow-200">K</Key> <span className="font-semibold">명예의 전당</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[120px] hover:translate-x-1 transition-transform">
                  <Key className="w-9 h-9 text-base text-green-200">N</Key> <span className="font-semibold">뉴스</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[120px] hover:translate-x-1 transition-transform">
                  <Key className="w-9 h-9 text-base text-purple-200">P</Key> <span className="font-semibold">기업 프로필</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[120px] hover:translate-x-1 transition-transform">
                  <Key className="w-9 h-9 text-base text-rose-200">L</Key> <span className="font-semibold">알림</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[120px] hover:translate-x-1 transition-transform">
                  <Key className="w-9 h-9 text-base text-gray-300">O</Key> <span className="font-semibold">설정</span>
                </div>
              </div>
              <p className="text-[11px] text-center text-gray-500 mt-3 bg-gray-800/80 py-1 rounded-lg border border-gray-700/30">
                * 동일한 키를 두 번 누르면 창이 전환/닫힘 처리됩니다.
              </p>
            </div>

            {/* Mouse Controls */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 shadow-inner">
              <h3 className="text-base font-bold text-teal-300 mb-3 text-center">마우스 / 카메라 조작</h3>
              <div className="flex flex-col gap-3 px-1">
                <div className="flex items-center gap-3 bg-gray-800 p-2.5 rounded-lg border border-gray-700">
                  <div className="bg-gray-700 p-1.5 rounded-lg shadow-inner"><MousePointer2 className="w-5 h-5 text-blue-300" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-200 text-sm">화면 이동 (Pan)</span>
                    <span className="text-[11px] text-gray-400">마우스 왼쪽 클릭 후 드래그</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gray-800 p-2.5 rounded-lg border border-gray-700">
                  <div className="bg-gray-700 p-1.5 rounded-lg shadow-inner flex items-center justify-center font-bold text-blue-300 w-8 h-8 text-lg border border-gray-600">↕</div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-200 text-sm">화면 줌 (Zoom)</span>
                    <span className="text-[11px] text-gray-400">마우스 휠 스크롤 위아래</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-between items-center pt-4 border-t border-gray-700">
          <label className="flex items-center gap-2 text-xs md:text-sm text-gray-400 cursor-pointer hover:text-gray-200 transition-colors bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
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
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95 text-base"
          >
            게임 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}