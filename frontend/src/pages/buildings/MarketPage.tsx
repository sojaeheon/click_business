import React, { useState, useEffect } from "react";
import { ArrowLeft, ShoppingCart, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useGame } from "../../app/store/gameStore";
import { MarketAPI } from "../../api/gameApi";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type MarketMode = "buy" | "sell" | null;

const generateMockChartData = () => {
  const data = [];
  let currentPrice = 3000;
  for (let i = 0; i < 20; i++) {
    const change = (Math.random() - 0.5) * 100;
    currentPrice = Math.max(100, currentPrice + change);
    data.push({ time: `12:${i.toString().padStart(2, '0')}`, price: Math.floor(currentPrice) });
  }
  return data;
};

export function MarketPage() {
  const { closeBuildingPage } = useGame();
  const [mode, setMode] = useState<MarketMode>(null);

  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [showPopup, setShowPopup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errImg, setErrImg] = useState(false);

  const [chartData, setChartData] = useState<{ time: string, price: number }[]>(generateMockChartData());
  const [marketTrend, setMarketTrend] = useState<"up" | "down" | "neutral">("neutral");

  useEffect(() => {
    if (!mode) return;

    const interval = setInterval(() => {
      setChartData(prev => {
        const lastPrice = prev[prev.length - 1].price;
        const change = (Math.random() - 0.5) * 300;
        const newPrice = Math.max(100, Math.floor(lastPrice + change));

        if (change > 100) setMarketTrend("up");
        else if (change < -100) setMarketTrend("down");
        else setMarketTrend("neutral");

        const newData = [...prev.slice(1), {
          time: new Date().toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' }),
          price: newPrice
        }];
        return newData;
      });

      setTimeout(() => setMarketTrend("neutral"), 800);
    }, 2500);

    return () => clearInterval(interval);
  }, [mode]);

  const totalAmount = price * quantity;

  const handleConfirm = async () => {
    if (quantity <= 0 || price <= 0 || !mode) return;

    setIsProcessing(true);
    try {
      await MarketAPI.createOrder({
        companyId: 1,
        itemId: 1,
        type: mode === "buy" ? "BUY" : "SELL",
        price: price,
        qty: quantity
      });

      setShowPopup(true);
      setTimeout(() => {
        setShowPopup(false);
        setPrice(0);
        setQuantity(0);
        setMode(null);
      }, 2000);
    } catch (e) {
      console.error(e);
      alert("주문 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isUpTrend = chartData[chartData.length - 1].price >= chartData[0].price;

  return (
    <div className={`absolute inset-0 z-40 flex flex-col pt-8 transition-colors duration-700 ease-out ${marketTrend === "up" ? "bg-rose-50" : marketTrend === "down" ? "bg-blue-50" : "bg-[#f5f0e8]" // fallback background color if needed
      }`}
      style={{
        backgroundImage: "url('/images/market.png')",
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        // Market trend determines the base color, overridden by the url. 
        // We'll let the transition-colors class handle the base background.
      }}
    >
      {/* Header (Back button only) */}
      <div className="absolute top-6 left-6 z-50">
        <button
          onClick={() => { mode ? setMode(null) : closeBuildingPage() }}
          className="w-12 h-12 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
        >
          {!errImg ? (
            <img src="/ui_icons/Button_Exit_Blue.png" alt="back" className="w-10 h-10 object-contain" onError={() => setErrImg(true)} />
          ) : (
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          )}
        </button>
      </div>

      {/* Main content */}
      {!mode ? (
        // --- DEPTH 1: 메인 화면 (구매/판매 선택) ---
        <div className="flex-1 flex flex-col justify-center items-center gap-12 p-6 max-w-4xl mx-auto w-full relative z-10">
          <div className="flex gap-8 w-full h-80">
            {/* 구매 버튼 */}
            <button
              onClick={() => setMode("buy")}
              className="flex-1 bg-white hover:bg-rose-50 border-4 border-slate-300 hover:border-rose-400 rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-6 group transition-all duration-300 active:scale-95 cursor-pointer"
            >
              <div className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-12 h-12 text-rose-500" />
              </div>
              <span className="text-5xl font-black text-slate-800 tracking-widest">구 매</span>
            </button>

            {/* 판매 버튼 */}
            <button
              onClick={() => setMode("sell")}
              className="flex-1 bg-white hover:bg-blue-50 border-4 border-slate-300 hover:border-blue-400 rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-6 group transition-all duration-300 active:scale-95 cursor-pointer"
            >
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingDown className="w-12 h-12 text-blue-500" />
              </div>
              <span className="text-5xl font-black text-slate-800 tracking-widest">판 매</span>
            </button>
          </div>
          <p className="text-xl font-bold text-slate-500">원하시는 거래 방식을 선택해주세요.</p>
        </div>
      ) : (
        // --- DEPTH 2: 차트 + 주문 폼 ---
        <div className="flex-1 flex flex-col justify-center items-center p-6 max-w-7xl mx-auto w-full gap-8 relative z-10 pt-16">
          <div className="flex w-full gap-8 items-stretch h-[calc(100vh-220px)] min-h-[500px]">
            {/* 왼쪽: 실시간 차트 영역 UI */}
            <div className="w-2/3 bg-white border-4 border-slate-300 rounded-3xl p-6 flex flex-col shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-700 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-slate-500" /> 실시간 시장 동향
                </h2>
                <div className="flex items-end gap-2 text-right">
                  <span className="text-sm font-bold text-slate-400 mb-1">현재가</span>
                  <span className={`text-4xl font-black ${isUpTrend ? "text-rose-500" : "text-blue-500"}`}>
                    {chartData[chartData.length - 1].price.toLocaleString()}원
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPriceUp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPriceDown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#cbd5e1" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis domain={['auto', 'auto']} stroke="#cbd5e1" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: 'bold', color: '#334155' }}
                      itemStyle={{ color: isUpTrend ? '#f43f5e' : '#3b82f6' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={isUpTrend ? "#f43f5e" : "#3b82f6"}
                      strokeWidth={4}
                      fillOpacity={1}
                      fill={isUpTrend ? "url(#colorPriceUp)" : "url(#colorPriceDown)"}
                      animationDuration={300}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className={`absolute top-4 left-4 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border-2 transition-opacity duration-300 ${marketTrend === "up" ? "bg-rose-100 text-rose-500 border-rose-200 opacity-100" :
                    marketTrend === "down" ? "bg-blue-100 text-blue-500 border-blue-200 opacity-100" :
                      "opacity-0"
                  }`}>
                  {marketTrend === "up" ? "급등 중!" : "급락 중!"}
                </div>
              </div>
            </div>

            {/* 오른쪽: 주문 폼 */}
            <div className="w-1/3 bg-white border-4 border-slate-300 rounded-3xl p-8 flex flex-col justify-between shadow-xl">
              <div className="flex flex-col gap-8">
                <h2 className="text-2xl font-black text-slate-800 border-b-2 border-slate-100 pb-4">
                  {mode === "buy" ? "구매 주문" : "판매 주문"} 작성
                </h2>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">주문 단가</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price || ""}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      placeholder="가격을 입력하세요"
                      className={`w-full bg-slate-50 border-2 rounded-xl pl-10 pr-4 py-4 text-right text-2xl font-black focus:outline-none transition-colors ${mode === "buy" ? "border-slate-200 focus:border-rose-400 text-rose-600" : "border-slate-200 focus:border-blue-400 text-blue-600"
                        }`}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₵</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">주문 수량</label>
                  <input
                    type="number"
                    value={quantity || ""}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    placeholder="수량을 입력하세요"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-right text-2xl font-black text-slate-800 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="h-[2px] bg-slate-100 w-full" />

                {/* Total Amount */}
                <div className={`flex flex-col gap-2 rounded-2xl p-6 border-2 ${mode === "buy" ? "bg-rose-50 border-rose-100" : "bg-blue-50 border-blue-100"}`}>
                  <span className={`font-bold text-sm uppercase tracking-widest ${mode === "buy" ? "text-rose-500" : "text-blue-500"}`}>총 주문 금액</span>
                  <div className="text-right flex items-end justify-end gap-1">
                    <span className={`text-4xl font-black leading-none tracking-tight ${mode === "buy" ? "text-rose-700" : "text-blue-700"}`}>
                      {totalAmount.toLocaleString()}
                    </span>
                    <span className={`text-lg font-bold pb-1 ${mode === "buy" ? "text-rose-400" : "text-blue-400"}`}>원</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleConfirm}
                disabled={price <= 0 || quantity <= 0 || isProcessing}
                className={`w-full py-5 rounded-2xl font-black text-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-lg mt-8 cursor-pointer ${price > 0 && quantity > 0 && !isProcessing
                    ? mode === "buy"
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
                      : "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-200"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
              >
                <ShoppingCart className="w-6 h-6" />
                {isProcessing ? "처리중..." : "주문 접수"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Overlay */}
      {showPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-[2rem] p-10 shadow-2xl transform text-center w-full max-w-sm border-4 border-slate-200 flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${mode === "buy" ? "bg-rose-100 border-4 border-rose-200" : "bg-blue-100 border-4 border-blue-200"
              }`}>
              <ShoppingCart className={`w-10 h-10 ${mode === "buy" ? "text-rose-500" : "text-blue-500"}`} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-wide">주문 생성 완료</h2>
            <p className="text-slate-500 font-bold text-lg">
              {mode === "buy" ? "구매" : "판매"} 요청이 시장에 접수되었습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
        </div >
      )}
    </div >
  );
}
