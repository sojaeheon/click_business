import React, { useState } from "react";
import { HelpCircle, ArrowLeft, Delete } from "lucide-react";
import { useGame } from "../../app/store/gameStore";
import { BankAPI } from "../../api/gameApi";

type BankMode = "loan" | "repay" | "deposit" | "withdraw" | null;

export function BankPage() {
  const { state, closeBuildingPage } = useGame();
  const { bankData, news, companyName } = state;

  const [mode, setMode] = useState<BankMode>(null);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNumpad = (num: string) => {
    if (inputValue.length < 12) {
      setInputValue((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setInputValue((prev) => prev.slice(0, -1));
  };

  const handleUnit = (unit: number) => {
    setInputValue((prev) => (Number(prev) * unit).toString());
  };

  const handleConfirm = async () => {
    const amount = Number(inputValue);
    if (!amount || !mode) return;
    
    setIsProcessing(true);
    try {
      // TODO: 실제 companyId 사용 (현재는 임시 1)
      const mappedType = mode === "loan" ? "BORROW" : mode === "repay" ? "REPAY" : mode === "deposit" ? "DEPOSIT" : "WITHDRAW";
      await BankAPI.processLoan({ companyId: 1, type: mappedType, amount });
      
      console.log(`${mappedType} 요청: ${amount}원`);
      alert("은행 처리가 완료되었습니다.");
      setMode(null);
      setInputValue("");
    } catch (e: any) {
      console.error(e);
      // 예외처리: 백엔드 미구축 또는 통신 에러 시 피드백
      alert(e?.response?.data?.message || "서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentRate = mode === "loan" || mode === "repay" ? bankData.loanRate : bankData.depositRate;
  const estimatedInterest = Math.floor(Number(inputValue || 0) * (currentRate / 100));

  return (
    <div className="absolute inset-0 z-40 bg-[#f5f0e8] flex flex-col pt-8">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { mode ? setMode(null) : closeBuildingPage() }}
            className="w-12 h-12 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-4xl tracking-widest text-slate-800" style={{ fontWeight: 900 }}>
            DK <span className="font-light text-slate-600">BANK</span>
          </h1>
        </div>
        <button className="w-12 h-12 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
          <HelpCircle className="w-6 h-6 text-slate-700" />
        </button>
      </div>

      {!mode ? (
        // --- DEPTH 1: 메인 메뉴 ---
        <div className="flex flex-1 p-6 gap-6 max-w-5xl mx-auto w-full items-center justify-center">
          {/* Left Buttons */}
          <div className="flex flex-col gap-6 w-1/4">
            <button onClick={() => setMode("loan")} className="h-32 bg-white rounded-2xl border-4 border-slate-300 shadow-xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
              <span className="text-3xl font-black text-slate-800 tracking-widest">대 출</span>
            </button>
            <button onClick={() => setMode("repay")} className="h-32 bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
              <span className="text-3xl font-black text-white tracking-widest">상 환</span>
            </button>
          </div>

          {/* Center Info Panel */}
          <div className="w-2/4 flex flex-col gap-6 h-full py-10">
            {/* Rates */}
            <div className="bg-white rounded-3xl border-4 border-slate-300 shadow-xl p-8 flex flex-col items-center justify-center">
              <h2 className="text-lg font-bold text-slate-500 mb-6 bg-slate-100 px-6 py-2 rounded-full">오늘의 금리</h2>
              <div className="flex w-full justify-around text-center">
                <div className="flex flex-col gap-2">
                  <span className="text-slate-500 font-medium">대출 금리</span>
                  <span className="text-4xl font-black text-rose-600">{bankData.loanRate}%</span>
                </div>
                <div className="w-1 bg-slate-200"></div>
                <div className="flex flex-col gap-2">
                  <span className="text-slate-500 font-medium">예금 금리</span>
                  <span className="text-4xl font-black text-emerald-600">{bankData.depositRate}%</span>
                </div>
              </div>
            </div>

            {/* Ads / News */}
            <div className="bg-white rounded-3xl border-4 border-slate-300 shadow-xl p-6 flex items-center gap-4 flex-1">
              <div className="w-16 h-16 rounded-xl bg-indigo-100 flex-shrink-0 flex items-center justify-center font-black text-indigo-400">
                Ads
              </div>
              <p className="text-lg font-bold text-slate-700 leading-snug">
                {news[0]?.headline || "[광고] 최고 우대 금리 적용! 지금 바로 상담하세요."}
              </p>
            </div>
          </div>

          {/* Right Buttons */}
          <div className="flex flex-col gap-6 w-1/4">
            <button onClick={() => setMode("deposit")} className="h-32 bg-white rounded-2xl border-4 border-slate-300 shadow-xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
              <span className="text-3xl font-black text-slate-800 tracking-widest">예 금</span>
            </button>
            <button onClick={() => setMode("withdraw")} className="h-32 bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
              <span className="text-3xl font-black text-white tracking-widest">인 출</span>
            </button>
          </div>
        </div>
      ) : (
        // --- DEPTH 2: Numpad & Detail ---
        <div className="flex-1 p-6 flex flex-col items-center justify-start max-w-lg mx-auto w-full mt-4">
          <div className="w-full text-center mb-8">
            <h2 className="text-2xl font-black text-slate-700 bg-white inline-block px-8 py-3 rounded-full shadow-sm border-2 border-slate-200">
              {mode === "loan" ? "대출하기" : mode === "repay" ? "상환하기" : mode === "deposit" ? "예금하기" : "인출하기"}
            </h2>
          </div>

          {/* Amount Display */}
          <div className="w-full bg-white rounded-2xl border-4 border-slate-300 p-6 mb-4 shadow-lg flex flex-col items-end">
            <span className="text-sm font-bold text-slate-400 mb-2 w-full text-left">금액 입력</span>
            <div className="flex items-end gap-2 text-slate-800">
              <span className="text-4xl font-black tracking-tight">{Number(inputValue || 0).toLocaleString()}</span>
              <span className="text-xl font-bold pb-1">원</span>
            </div>
          </div>

          {/* Interest estimate */}
          <div className="w-full flex justify-between items-center px-4 mb-8">
            <span className="text-slate-500 font-bold">예상 발생 이자</span>
            <span className="text-rose-500 font-black text-lg">+{estimatedInterest.toLocaleString()}원</span>
          </div>

          {/* Numpad */}
          <div className="w-full grid grid-cols-4 gap-3 bg-white p-4 rounded-3xl border-4 border-slate-300 shadow-xl">
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => handleNumpad(n.toString())} className="h-16 bg-slate-100 rounded-xl text-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{n}</button>
            ))}
            <button onClick={() => handleUnit(10000)} className="h-16 bg-indigo-50 rounded-xl text-lg font-black text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all">만</button>
            
            {[4, 5, 6].map(n => (
              <button key={n} onClick={() => handleNumpad(n.toString())} className="h-16 bg-slate-100 rounded-xl text-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{n}</button>
            ))}
            <button onClick={() => handleUnit(100000000)} className="h-16 bg-indigo-50 rounded-xl text-lg font-black text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all">억</button>
            
            {[7, 8, 9].map(n => (
              <button key={n} onClick={() => handleNumpad(n.toString())} className="h-16 bg-slate-100 rounded-xl text-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">{n}</button>
            ))}
            <button onClick={() => setInputValue("")} className="h-16 bg-rose-50 rounded-xl text-lg font-black text-rose-600 hover:bg-rose-100 active:scale-95 transition-all">전액<br/><span className="text-xs">초기화</span></button>
            
            <button onClick={() => handleNumpad("00")} className="h-16 bg-slate-100 rounded-xl text-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">00</button>
            <button onClick={() => handleNumpad("0")} className="h-16 bg-slate-100 rounded-xl text-2xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all">0</button>
            <button onClick={handleBackspace} className="h-16 flex items-center justify-center col-span-2 bg-slate-200 rounded-xl text-slate-700 hover:bg-slate-300 active:scale-95 transition-all">
              <Delete className="w-8 h-8" />
            </button>
          </div>

          {/* Bottom Actions */}
          <div className="w-full flex gap-4 mt-8">
            <button onClick={() => setMode(null)} className="flex-1 py-4 bg-slate-200 rounded-xl text-slate-700 font-black text-xl hover:bg-slate-300 active:scale-95 transition-all">
              취소
            </button>
            <button onClick={handleConfirm} disabled={!inputValue || isProcessing} className="flex-1 py-4 bg-slate-800 rounded-xl text-white font-black text-xl hover:bg-slate-700 active:scale-95 transition-all shadow-lg disabled:opacity-50">
              {isProcessing ? "처리중..." : "확인"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
