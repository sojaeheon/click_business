import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  className?: string; 
}

export function BackButton({ onClick, className = "" }: BackButtonProps) {
  const [errImg, setErrImg] = useState(false);

  return (
    <button
      onClick={onClick}
      // ✨ 마법의 클래스: bg-transparent(배경 투명), border-none(테두리 없음), p-0(여백 없음)
      className={`bg-transparent border-none p-0 outline-none flex items-center justify-center transition-transform cursor-pointer hover:scale-110 active:scale-95 z-[60] ${className}`}
    >
      {!errImg ? (
        <img 
          src="/ui_icons/ButtonIcon_12.png" 
          alt="back" 
          // ✨ w-14 h-14 정도로 크기를 살짝 키우고, 그림자(drop-shadow)를 주어 배경 없이도 잘 보이게 합니다.
          className="w-14 h-14 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" 
          onError={() => setErrImg(true)} 
        />
      ) : (
        <ArrowLeft className="w-10 h-10 text-white drop-shadow-md" />
      )}
    </button>
  );
}