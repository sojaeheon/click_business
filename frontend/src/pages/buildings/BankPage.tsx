import React, { useState } from "react";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { useGame } from "../../app/store/gameStore";

export function BankPage() {
  const { state, closeBuildingPage } = useGame();
  const { bankData, news } = state;
  const [activeTab, setActiveTab] = useState<"loan" | "deposit">("loan");

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
          <span className="text-gray-500">은행</span>
        </div>
        <div className="text-center">
          <h1 className="text-3xl tracking-wider" style={{ fontWeight: 900 }}>
            DK <span style={{ fontWeight: 400 }}>BANK</span>
          </h1>
        </div>
        <button className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer">
          <HelpCircle className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 flex flex-col gap-5 max-w-2xl mx-auto w-full">
        {/* Action buttons grid */}
        <div className="grid grid-cols-3 gap-4 flex-1">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            <button className="flex-1 bg-white border-2 border-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
              <span className="text-2xl tracking-[0.3em]" style={{ fontWeight: 800 }}>대 출</span>
            </button>
            <button className="flex-1 bg-white border-2 border-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
              <span className="text-2xl tracking-[0.3em]" style={{ fontWeight: 800 }}>상 환</span>
            </button>
          </div>

          {/* Center column - Info */}
          <div className="flex flex-col gap-4">
            <div className="flex-1 bg-white border-2 border-gray-400 rounded-xl p-4 flex flex-col items-center justify-center">
              <h3 className="text-sm text-gray-600 mb-3" style={{ fontWeight: 600 }}>오늘의 금리</h3>
              <div className="space-y-2 text-center">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">대출:</span>
                  <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>{bankData.loanRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">예금:</span>
                  <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>{bankData.depositRate}%</span>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-white border-2 border-gray-400 rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center mb-2">
                <span className="text-[10px] text-gray-500">Ads</span>
              </div>
              <p className="text-sm text-gray-600 text-center">
                {news[0]?.headline || "여기에 뉴스!"}
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <button className="flex-1 bg-white border-2 border-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
              <span className="text-2xl tracking-[0.3em]" style={{ fontWeight: 800 }}>예 금</span>
            </button>
            <button className="flex-1 bg-white border-2 border-gray-400 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer active:scale-[0.98]">
              <span className="text-2xl tracking-[0.3em]" style={{ fontWeight: 800 }}>인 출</span>
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex bg-white border-2 border-gray-400 rounded-xl overflow-hidden">
            <button
              onClick={() => setActiveTab("loan")}
              className={`flex-1 py-3 text-center text-sm cursor-pointer transition-colors ${activeTab === "loan"
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
                }`}
              style={{ fontWeight: activeTab === "loan" ? 700 : 400 }}
            >
              대출금
            </button>
            <div className="w-[2px] bg-gray-400" />
            <button
              onClick={() => setActiveTab("deposit")}
              className={`flex-1 py-3 text-center text-sm cursor-pointer transition-colors ${activeTab === "deposit"
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
                }`}
              style={{ fontWeight: activeTab === "deposit" ? 700 : 400 }}
            >
              예금
            </button>
          </div>

          {/* Amount display */}
          <div className="bg-white border-2 border-gray-400 rounded-xl px-4 py-3 min-w-[140px] text-center">
            <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>
              {activeTab === "loan"
                ? bankData.currentLoan.toLocaleString()
                : bankData.currentDeposit.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 ml-1">₵</span>
          </div>

          <button
            onClick={closeBuildingPage}
            className="bg-gray-800 text-white px-8 py-3 rounded-full hover:bg-gray-700 transition-colors cursor-pointer active:scale-95"
            style={{ fontWeight: 700 }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
