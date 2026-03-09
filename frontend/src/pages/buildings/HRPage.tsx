import React, { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useGame } from "../../store/gameStore";

export function HRPage() {
  const { state, closeBuildingPage } = useGame();
  const { hrData } = state;
  const [leverPulled, setLeverPulled] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const pullLever = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setLeverPulled(true);
    setResultMessage(null);

    setTimeout(() => {
      const success = Math.random() * 100 < hrData.successRate;
      setResultMessage(success ? "강화 성공!" : "강화 실패...");
      setIsAnimating(false);

      setTimeout(() => {
        setLeverPulled(false);
      }, 1500);
    }, 1200);
  }, [hrData.successRate, isAnimating]);

  return (
    <div className="absolute inset-0 z-40 bg-[#f5f0e8] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-300">
        <div className="flex items-center gap-3">
          <button
            onClick={closeBuildingPage}
            className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-gray-500">인력소</span>
        </div>
        <h1 className="text-2xl" style={{ fontWeight: 800 }}>
          인력소
        </h1>
        <div className="w-10" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex items-end gap-16 max-w-3xl">
          {/* Info panels + Character */}
          <div className="flex flex-col items-center gap-4">
            {/* Level info */}
            <div className="flex gap-4">
              <div className="bg-white border-2 border-gray-400 rounded-xl px-5 py-3">
                <div className="text-sm text-gray-500">현재 레벨</div>
                <div className="text-3xl text-gray-800 text-center" style={{ fontWeight: 800 }}>
                  {hrData.currentLevel}
                </div>
                <div className="text-sm text-gray-500 mt-1">예상 레벨</div>
                <div className="text-3xl text-gray-800 text-center" style={{ fontWeight: 800 }}>
                  {hrData.expectedLevel}
                </div>
              </div>

              <div className="bg-white border-2 border-gray-400 rounded-xl px-5 py-3">
                <div className="text-sm text-gray-500">성공 확률</div>
                <div className="text-2xl text-gray-800" style={{ fontWeight: 800 }}>
                  {hrData.successRate}%
                </div>
                <div className="text-sm text-gray-500 mt-2">재료</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                  <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>
                    {hrData.materialCurrent}/{hrData.materialMax}
                  </span>
                </div>
              </div>
            </div>

            {/* Character */}
            <div className="relative">
              {/* Dashed orbit ring */}
              <svg
                width="180"
                height="80"
                viewBox="0 0 180 80"
                className="absolute bottom-12 left-1/2 -translate-x-1/2"
              >
                <ellipse
                  cx="90"
                  cy="40"
                  rx="80"
                  ry="30"
                  fill="none"
                  stroke="#999"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              </svg>

              {/* Character body */}
              <div className="flex flex-col items-center relative z-10">
                {/* Head */}
                <div className="w-16 h-16 rounded-full border-3 border-gray-700 bg-gradient-to-b from-gray-100 to-gray-200" />
                {/* Body */}
                <div className="relative -mt-1">
                  {/* Torso */}
                  <div className="w-24 h-20 bg-gradient-to-b from-gray-200 to-gray-300 rounded-b-lg border-2 border-gray-600 flex items-center justify-center">
                    <div
                      className={`w-6 h-6 rounded-full border-2 transition-colors duration-500 ${
                        leverPulled
                          ? resultMessage?.includes("성공")
                            ? "border-green-500 bg-green-300"
                            : resultMessage?.includes("실패")
                            ? "border-red-500 bg-red-300"
                            : "border-yellow-500 bg-yellow-300 animate-pulse"
                          : "border-gray-400 bg-gray-100"
                      }`}
                    />
                  </div>
                  {/* Arms */}
                  <div className="absolute top-2 -left-10 w-10 h-3 bg-gray-300 border border-gray-500 rounded-full" />
                  <div className="absolute top-2 -right-10 w-10 h-3 bg-gray-300 border border-gray-500 rounded-full" />
                </div>
                {/* Legs */}
                <div className="flex gap-4 -mt-1">
                  <div className="w-5 h-14 bg-gray-300 border border-gray-500 rounded-b-lg" />
                  <div className="w-5 h-14 bg-gray-300 border border-gray-500 rounded-b-lg" />
                </div>
                {/* Feet (platforms) */}
                <div className="flex gap-8 -mt-1">
                  <div className="w-8 h-3 bg-gray-400 rounded-full" />
                  <div className="w-8 h-3 bg-gray-400 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Lever */}
          <div className="flex flex-col items-center">
            <div className="text-xl text-gray-700 mb-4" style={{ fontWeight: 800 }}>
              당겨!
            </div>
            <button
              onClick={pullLever}
              disabled={isAnimating}
              className="relative cursor-pointer active:scale-95 transition-transform disabled:cursor-not-allowed group"
            >
              {/* Lever handle */}
              <div
                className="relative flex flex-col items-center transition-transform duration-300"
                style={{
                  transform: leverPulled ? "rotate(30deg)" : "rotate(0deg)",
                  transformOrigin: "bottom center",
                }}
              >
                {/* Ball */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-gray-300 to-gray-500 border-2 border-gray-600 group-hover:from-gray-200 group-hover:to-gray-400" />
                {/* Stick */}
                <div className="w-4 h-28 bg-gradient-to-b from-gray-400 to-gray-600 border border-gray-600 rounded-b-sm -mt-1" />
              </div>
              {/* Base */}
              <div className="w-20 h-5 bg-gradient-to-b from-gray-500 to-gray-700 rounded-lg border border-gray-700 -mt-1" />
              <div className="w-16 h-3 bg-gray-600 rounded-b-lg mx-auto" />
            </button>
          </div>
        </div>
      </div>

      {/* Result message */}
      {resultMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div
            className={`text-4xl px-8 py-4 rounded-2xl shadow-2xl ${
              resultMessage.includes("성공")
                ? "bg-green-100 text-green-700 border-2 border-green-400"
                : "bg-red-100 text-red-700 border-2 border-red-400"
            }`}
            style={{ fontWeight: 900 }}
          >
            {resultMessage}
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="p-6 flex justify-center">
        <button
          onClick={closeBuildingPage}
          className="bg-gray-800 text-white px-10 py-3 rounded-full hover:bg-gray-700 transition-colors cursor-pointer active:scale-95"
          style={{ fontWeight: 700 }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
