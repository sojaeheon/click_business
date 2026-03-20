import React, { useState, useEffect } from "react";
import { Delete, HelpCircle, Newspaper, X } from "lucide-react";
import { useGame, useGameStore } from "../../store/gameStore";
import { BankAPI } from "../../api/gameApi";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";

type BankMode = "loan" | "repay" | "deposit" | "withdraw" | null;
type StepMode = "input" | "confirm" | "done" | "thanks";

export function BankPage() {
  const { state, closeBuildingPage } = useGame();
  const { bankData, news, money, debt } = state;

  const [showOverlay, setShowOverlay] = useState(true);
  const [mode, setMode] = useState<BankMode>(null);
  const [step, setStep] = useState<StepMode>("input");
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 뉴스 로테이션 인덱스
  const [newsIndex, setNewsIndex] = useState(0);

  // 백엔드 금리 데이터 연동
  const [bankRates, setBankRates] = useState({ loanRate: 5.5, depositRate: 2.3 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await BankAPI.getSummary(1); // 가짜 회사ID: 1
        setBankRates({
          loanRate: response.data.loanRate,
          depositRate: response.data.depositRate,
        });
      } catch (e) {
        console.error("금리 정보를 불러오는 데 실패했습니다.", e);
      }
    };
    fetchRates();
  }, []);

  // 실시간 시계 설정
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectMode = (m: BankMode) => {
    setMode(m);
    setInputValue("");
    setStep("input");
  };

  // 최근 2일 뉴스 필터링 (현재는 모든 뉴스 사용, 실 데이터 연동 시 날짜 필터링)
  const recentNews = news && news.length > 0 ? news : [];

  // 10초 간격 뉴스 로테이션
  useEffect(() => {
    if (recentNews.length <= 1) return;
    const interval = setInterval(() => {
      setNewsIndex((prev) => (prev + 1) % recentNews.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [recentNews.length]);

  const handleNumpad = (num: string) => {
    if (inputValue.length < 12) {
      setInputValue((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setInputValue((prev) => prev.length > 0 ? prev.slice(0, -1) : prev);
  };

  const handleUnit = (unit: number) => {
    setInputValue((prev) => {
      const next = Number(prev) * unit;
      if (next > 1000000000000000) return prev; // Limit excessively large numbers to avoid float inaccuracies and UI overflow
      return next.toString();
    });
  };

  const handleConfirmInput = () => {
    const amount = Number(inputValue);
    if (!amount || !mode) return;
    setStep("confirm");
  };

  const processTransaction = async () => {
    const amount = Number(inputValue);
    setIsProcessing(true);
    try {
      const mappedType = mode === "loan" ? "BORROW" : mode === "repay" ? "REPAY" : mode === "deposit" ? "DEPOSIT" : "WITHDRAW";
      await BankAPI.processLoan({ companyId: 1, type: mappedType, amount });

      // store 돈/부채 연동
      if (mode === "loan") {
        // 대출: 돈이 들어오고 부채가 증가함
        useGameStore.getState().updateMoney(amount);
        useGameStore.getState().updateDebt(amount);
      } else if (mode === "repay") {
        // 상환: 돈이 나가고 부채가 감소함
        const success = useGameStore.getState().updateMoney(-amount);
        if (!success) {
          useAlertStore.getState().openAlert("보유 금액이 부족합니다.", "경고");
          setStep("input");
          setIsProcessing(false);
          return;
        }
        useGameStore.getState().updateDebt(-amount);
      } else if (mode === "deposit") {
        // 예금: 돈이 나가고 예금이 증가함
        const success = useGameStore.getState().updateMoney(-amount);
        if (!success) {
          useAlertStore.getState().openAlert("보유 금액이 부족합니다.", "경고");
          setStep("input");
          setIsProcessing(false);
          return;
        }
        useGameStore.getState().updateBankData({ 
          currentDeposit: (bankData.currentDeposit || 0) + amount 
        });
      } else if (mode === "withdraw") {
        // 인출: 돈이 들어오고 예금이 감소함
        if ((bankData.currentDeposit || 0) < amount) {
          useAlertStore.getState().openAlert("예금 잔액이 부족합니다.", "경고");
          setStep("input");
          setIsProcessing(false);
          return;
        }
        useGameStore.getState().updateMoney(amount);
        useGameStore.getState().updateBankData({ 
          currentDeposit: (bankData.currentDeposit || 0) - amount 
        });
      }

      setStep("done");

      // done 화면 후 1.5초 뒤 thanks 화면
      setTimeout(() => {
        setStep("thanks");
        // thanks 화면 후 2초 뒤 종료
        setTimeout(() => {
          closeBuildingPage();
        }, 2000);
      }, 1500);

    } catch (e: any) {
      console.error(e);
      useAlertStore.getState().openAlert(e?.response?.data?.message || "서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "경고");
      setStep("input");
    } finally {
      setIsProcessing(false);
    }
  };

  // 키보드 이벤트 연동
  useEffect(() => {
    if (!mode || step !== "input") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleNumpad(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        handleConfirmInput();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, step, inputValue]);

  const currentRate = mode === "loan" || mode === "repay" ? bankRates.loanRate : bankRates.depositRate;
  const estimatedInterest = Math.floor(Number(inputValue || 0) * (currentRate / 100));

  const modeText = mode === "loan" ? "대출" : mode === "repay" ? "상환" : mode === "deposit" ? "예금" : "인출";

  const currentNews = recentNews.length > 0 ? recentNews[newsIndex % recentNews.length] : null;

  return (
    <>
      <style>{`
        @font-face {
            font-family: 'NanumSquareNeo';
            src: url(https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumSquareNeoTTF-aLt.woff2);
            font-weight: 300;
            font-display: swap;
        }
        @font-face {
            font-family: 'NanumSquareNeo';
            src: url(https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumSquareNeoTTF-bRg.woff2);
            font-weight: 400;
            font-display: swap;
        }
        @font-face {
            font-family: 'NanumSquareNeo';
            src: url(https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumSquareNeoTTF-cBd.woff2);
            font-weight: 700;
            font-display: swap;
        }
        @font-face {
            font-family: 'NanumSquareNeo';
            src: url(https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumSquareNeoTTF-dEb.woff2);
            font-weight: 800;
            font-display: swap;
        }
        @font-face {
            font-family: 'NanumSquareNeo';
            src: url(https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumSquareNeoTTF-eHv.woff2);
            font-weight: 900;
            font-display: swap;
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 12s linear infinite;
        }
      `}</style>
      <div
        className="absolute inset-0 z-40 flex flex-col overflow-hidden"
        style={{
          backgroundImage: "url('/images/bank.png')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: '#cee7be',
          fontFamily: 'NanumSquareNeo, sans-serif'
        }}
      >
        {/* 전체 화면 차단 오버레이 (회색 불투명) + 끄기 버튼 */}
        {showOverlay && (
          <div className="absolute inset-0 z-[60] bg-slate-900/40 backdrop-blur-[1px] cursor-not-allowed pointer-events-auto">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowOverlay(false);
              }}
              className="absolute top-6 right-8 z-[80] w-12 h-12 bg-white flex items-center justify-center rounded-full hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xl border-2 border-slate-300"
            >
              <X className="w-6 h-6 text-slate-800" />
            </button>

            {/* 중앙 점검 안내 흐르는 텍스트 배너 */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full overflow-hidden z-[70] pointer-events-none bg-white/95 backdrop-blur-md py-8 border-y-4 border-rose-500 flex shadow-2xl">
              <div className="flex animate-marquee whitespace-nowrap text-4xl font-black text-rose-600 tracking-wider">
                <span className="px-12 flex-shrink-0">은행 서비스를 점검하고 있습니다. 빠르고 안정적인 서비스를 위해 노력중이니 조금만 기다려주세요.</span>
                <span className="px-12 flex-shrink-0">은행 서비스를 점검하고 있습니다. 빠르고 안정적인 서비스를 위해 노력중이니 조금만 기다려주세요.</span>
              </div>
            </div>
          </div>
        )}
        {/* Header Bar */}
        <div className="w-full h-28 bg-[#1E3A8A] flex flex-col shadow-xl relative z-50 flex-shrink-0">
          <div className="max-w-[85%] mx-auto w-full flex flex-col justify-between h-full p-4 relative">
            {/* Top Status inside Header */}
            <div className="flex justify-between items-center w-full text-xs text-slate-200 font-bold">
              <span className="flex items-center gap-2">점번: B109 <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> 정상</span>
              <div className="flex items-center gap-4">
                <button className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded font-bold border border-blue-500 shadow-sm text-[11px] cursor-pointer">도움말</button>
                <button className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded font-bold border border-slate-600 shadow-sm text-[11px] cursor-pointer">언어설정</button>
                <span className="text-slate-100">
                  {currentTime.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\s/g, "")}
                  <span className="font-black text-white ml-2">
                    {currentTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </span>
                </span>
              </div>
            </div>

            {/* Main Title Center (Absolute Center) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <h1 className="text-4xl font-black text-white tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                DK BANK
              </h1>
            </div>
          </div>
        </div>

        {/* ATM 하단 안내 바 */}
        <div className="w-full bg-slate-100 text-slate-800 py-2 shadow-sm z-40 border-b border-slate-300 flex-shrink-0">
          <div className="max-w-[85%] mx-auto w-full flex items-center justify-center gap-3 font-bold">
            <span className="w-5 h-5 flex items-center justify-center bg-[#1E3A8A] text-white rounded-full text-xs font-black">📢</span>
            <span>원하시는 거래를 터치해 주십시오.</span>
          </div>
        </div>

        {/* Header - 뒤로가기 버튼만 */}
        <BackButton
          onClick={() => {
            if (step !== "input" && step !== "confirm") return;
            if (mode) {
              selectMode(null);
            } else {
              closeBuildingPage();
            }
          }}
          className="absolute top-[56px] -translate-y-1/2 left-8 z-[100] cursor-pointer"
        />

        {!mode ? (
          // --- DEPTH 1: 메인 메뉴 ---
          <div className="flex flex-1 p-6 gap-10 max-w-[85%] mx-auto w-full items-center justify-center relative z-10">
            {/* Left Buttons */}
            <div className="flex flex-col gap-6 w-[30%] h-full py-4">
              <button onClick={() => selectMode("loan")} className="flex-1 bg-gradient-to-b from-white to-gray-300 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] flex items-center justify-center hover:scale-105 transition-transform active:scale-95 cursor-pointer">
                <span className="text-5xl font-extrabold text-slate-900 tracking-wide">대 출</span>
              </button>
              <button onClick={() => selectMode("repay")} className="flex-1 bg-gradient-to-b from-white to-gray-300 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] flex items-center justify-center hover:scale-105 transition-transform active:scale-95 cursor-pointer">
                <span className="text-5xl font-extrabold text-slate-900 tracking-wide">상 환</span>
              </button>
            </div>

            {/* Center Info Panel */}
            <div className="w-[40%] flex flex-col gap-6 h-full py-4">
              {/* Rates */}
              <div className="bg-white rounded-3xl border-4 border-slate-300 shadow-xl p-8 flex flex-col items-center justify-center">
                <h2 className="text-lg font-bold text-slate-500 mb-6 bg-slate-100 px-6 py-2 rounded-full">오늘의 금리</h2>
                <div className="flex w-full justify-around text-center">
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-500 font-medium">대출 금리</span>
                    <span className="text-4xl font-black text-rose-600">{bankRates.loanRate}%</span>
                  </div>
                  <div className="w-1 bg-slate-200"></div>
                  <div className="flex flex-col gap-2">
                    <span className="text-slate-500 font-medium">예금 금리</span>
                    <span className="text-4xl font-black text-emerald-600">{bankRates.depositRate}%</span>
                  </div>
                </div>
              </div>

              {/* 광고 / 뉴스 섹션 */}
              <div className="bg-white rounded-3xl border-4 border-slate-200 shadow-xl p-6 flex-1 flex flex-col relative overflow-hidden">
                {/* 상단 타임배너 & 카테고리 */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-slate-500 text-sm font-bold">인기 뉴스</span>
                  {currentNews?.isBreaking && (
                    <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-md">속보</span>
                  )}
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-md border border-amber-200">금융</span>
                  {recentNews.length > 1 && (
                    <span className="text-xs text-slate-400 font-bold ml-auto">{(newsIndex % recentNews.length) + 1} / {recentNews.length}</span>
                  )}
                </div>

                {/* 뉴스 내용 */}
                <div className="flex-1 flex flex-col">
                  {currentNews ? (
                    <div className="flex-1 flex flex-col">
                      {/* 제목 */}
                      <h3 className="text-2xl font-black text-slate-900 leading-tight mb-2 tracking-tight">
                        {currentNews.headline}
                      </h3>

                      {/* 날짜 */}
                      <div className="text-sm text-slate-400 font-bold mb-3">
                        수정 {currentNews.date}
                      </div>

                      <hr className="border-slate-200 mb-4" />

                      {/* 본문 (왼쪽 블랙 바 포인트) */}
                      <div className="flex-1 flex items-start">
                        <div className="w-[4px] self-stretch bg-slate-900 rounded-full mr-4 flex-shrink-0" />
                        <p className="text-lg font-bold text-slate-700 leading-relaxed break-keep">
                          {currentNews.summary || "뉴스 본문 세부 내용이 이 영역에 표시됩니다. 전체 뉴스 목록에서 상세 기사를 확인하실 수 있습니다."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xl font-bold text-slate-600 leading-snug text-center">
                        [광고] 최고 우대 금리 적용!<br />지금 바로 상담하세요.
                      </p>
                    </div>
                  )}
                </div>

                {/* 하단 로테이션 인디케이터 */}
                {recentNews.length > 1 && (
                  <div className="flex gap-1.5 justify-center mt-2">
                    {recentNews.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === newsIndex % recentNews.length
                          ? "w-6 bg-indigo-500"
                          : "w-1.5 bg-indigo-200"
                          }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Buttons */}
            <div className="flex flex-col gap-6 w-[30%] h-full py-4">
              <button onClick={() => selectMode("deposit")} className="flex-1 bg-gradient-to-b from-white to-gray-300 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] flex items-center justify-center hover:scale-105 transition-transform active:scale-95 cursor-pointer">
                <span className="text-5xl font-extrabold text-slate-900 tracking-wide">예 금</span>
              </button>
              <button onClick={() => selectMode("withdraw")} className="flex-1 bg-gradient-to-b from-white to-gray-300 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] flex items-center justify-center hover:scale-105 transition-transform active:scale-95 cursor-pointer">
                <span className="text-5xl font-extrabold text-slate-900 tracking-wide">인 출</span>
              </button>
            </div>
          </div>
        ) : step === "input" ? (
          // --- DEPTH 2: Numpad & Detail ---
          <div className="flex-1 px-8 pt-8 pb-8 flex flex-col items-center justify-center gap-8 max-w-5xl mx-auto w-full relative z-10 overflow-hidden">
            {/* 1. Title Centered At Top */}
            <div className="w-full text-center">
              <h2 className="text-3xl font-black text-slate-700 bg-white inline-block px-12 py-3.5 rounded-full shadow-md border-2 border-slate-200">
                {mode === "loan" ? "대출하기" : mode === "repay" ? "상환하기" : mode === "deposit" ? "예금하기" : "인출하기"}
              </h2>
            </div>

            {/* 2. Content Row */}
            <div className="flex flex-row items-stretch justify-center gap-12 w-full flex-1 min-h-0">
              {/* Left: Numpad */}
              <div className="w-1/2 flex flex-col justify-center h-full max-w-md">
                <div className="w-full grid grid-cols-4 gap-4 bg-white p-6 rounded-3xl border-4 border-slate-300 shadow-2xl h-full">
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => handleNumpad(n.toString())} className="flex items-center justify-center bg-slate-100 rounded-xl text-4xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">{n}</button>
                  ))}
                  <button onClick={() => handleUnit(10000)} className="flex items-center justify-center bg-indigo-50 rounded-xl text-xl font-black text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all cursor-pointer">만</button>

                  {[4, 5, 6].map(n => (
                    <button key={n} onClick={() => handleNumpad(n.toString())} className="flex items-center justify-center bg-slate-100 rounded-xl text-4xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">{n}</button>
                  ))}
                  <button onClick={() => handleUnit(100000000)} className="flex items-center justify-center bg-indigo-50 rounded-xl text-xl font-black text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all cursor-pointer">억</button>

                  {[7, 8, 9].map(n => (
                    <button key={n} onClick={() => handleNumpad(n.toString())} className="flex items-center justify-center bg-slate-100 rounded-xl text-4xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">{n}</button>
                  ))}
                  <button onClick={() => setInputValue("")} className="flex items-center justify-center bg-rose-50 rounded-xl text-xl font-black text-rose-600 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer">전액<br /><span className="text-xs">초기화</span></button>

                  <button onClick={() => handleNumpad("00")} className="flex items-center justify-center bg-slate-100 rounded-xl text-4xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">00</button>
                  <button onClick={() => handleNumpad("0")} className="flex items-center justify-center bg-slate-100 rounded-xl text-4xl font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">0</button>
                  <button onClick={handleBackspace} className="flex items-center justify-center col-span-2 bg-slate-200 rounded-xl text-slate-700 hover:bg-slate-300 active:scale-95 transition-all cursor-pointer">
                    <Delete className="w-10 h-10" />
                  </button>
                </div>
              </div>

              {/* Right: Info Check & Confirm */}
              <div className="w-1/2 flex flex-col justify-center h-full gap-6 max-w-md">
                {/* 보유 금액 및 부채/예금 표시 */}
                <div className="w-full flex flex-col gap-3">
                  <div className="w-full bg-slate-50/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                    <span className="text-lg font-bold text-slate-600">보유 금액</span>
                    <span className="text-blue-600 font-black text-3xl">{money.toLocaleString()} 원</span>
                  </div>
                  {mode === "loan" || mode === "repay" ? (
                    <div className="w-full bg-slate-50/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                      <span className="text-lg font-bold text-slate-600">보유 부채</span>
                      <span className="text-rose-600 font-black text-3xl">{debt.toLocaleString()} 원</span>
                    </div>
                  ) : (
                    <div className="w-full bg-slate-50/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                      <span className="text-lg font-bold text-slate-600">보유 예금</span>
                      <span className="text-emerald-600 font-black text-3xl">{(bankData.currentDeposit || 0).toLocaleString()} 원</span>
                    </div>
                  )}
                </div>

                {/* Amount Display */}
                <div className="w-full bg-white rounded-2xl border-4 border-slate-300 px-6 py-4 shadow-xl flex flex-col flex-1 justify-center min-h-0">
                  <span className="text-sm font-bold text-slate-400 mb-2 w-full text-left">금액 입력</span>
                  {(() => {
                    const displayed = Number(inputValue || 0).toLocaleString();
                    const len = displayed.length;
                    const fontClass = len > 22 ? "text-lg" : len > 17 ? "text-2xl" : len > 12 ? "text-3xl" : "text-5xl";
                    return (
                      <div className="w-full text-right select-none overflow-hidden flex-shrink-0">
                        <span className={`font-black break-all ${fontClass} text-slate-800`}>{displayed}</span>
                        <span className="text-xl font-bold ml-1 text-slate-800">원</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Interest estimate */}
                <div className="w-full flex justify-between items-center px-4">
                  <span className="text-slate-800 font-bold bg-white/70 px-4 py-1.5 rounded-full text-base">예상 발생 이자</span>
                  <span className="text-rose-600 font-black text-xl bg-white/70 px-4 py-1.5 rounded-full">+{estimatedInterest.toLocaleString()}원</span>
                </div>

                {/* Bottom Actions */}
                <div className="w-full flex gap-4 mt-2">
                  <button onClick={() => selectMode(null)} className="flex-1 py-5 bg-slate-200 rounded-xl text-slate-700 font-black text-xl hover:bg-slate-300 active:scale-95 transition-all shadow cursor-pointer">
                    취소
                  </button>
                  <button onClick={handleConfirmInput} disabled={!inputValue || Number(inputValue) === 0} className="flex-1 py-5 bg-slate-800 rounded-xl text-white font-black text-xl hover:bg-slate-700 active:scale-95 transition-all shadow-xl disabled:opacity-50 cursor-pointer">
                    확인
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : step === "confirm" ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full relative z-10">
            <div className="bg-white rounded-3xl border-4 border-slate-300 p-10 shadow-xl flex flex-col items-center text-center w-full">
              <h2 className="text-3xl font-black text-slate-800 mb-6">입력 내용 확인</h2>
              <p className="text-2xl text-slate-600 mb-8 break-keep">
                <strong className="text-4xl text-indigo-600 block mb-2">{Number(inputValue).toLocaleString()} 원</strong>을<br />
                정말 <strong>{modeText}</strong> 하시겠습니까?
              </p>
              <div className="flex w-full gap-4">
                <button
                  onClick={() => setStep("input")}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-slate-200 rounded-xl text-slate-700 font-black text-xl hover:bg-slate-300 active:scale-95 transition-all disabled:opacity-50"
                >
                  아니오
                </button>
                <button
                  onClick={processTransaction}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-indigo-600 rounded-xl text-white font-black text-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {isProcessing ? "처리중..." : "예"}
                </button>
              </div>
            </div>
          </div>
        ) : step === "done" ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full relative z-10">
            <div className="bg-white rounded-3xl border-4 border-slate-300 p-10 shadow-xl flex flex-col items-center text-center w-full animate-pulse opacity-90">
              <div className="text-6xl mb-6">✅</div>
              <h2 className="text-3xl font-black text-slate-800 break-keep">
                {Number(inputValue).toLocaleString()}원<br /> {modeText} 했습니다.
              </h2>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full relative z-10">
            <div className="bg-white rounded-3xl border-4 border-slate-300 p-10 shadow-xl flex flex-col items-center text-center w-full">
              <div className="text-6xl mb-6 animate-bounce">💖</div>
              <h2 className="text-4xl font-black text-slate-800">
                감사합니다
              </h2>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
