import React, { useState, useEffect } from "react";
import { ShoppingCart, TrendingUp, TrendingDown, Activity, ListOrdered } from "lucide-react";
import { useGameStore } from "../../store/gameStore"; // 경로 확인 필요
import { MarketAPI } from "../../api/gameApi";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

type MarketMode = "buy" | "sell" | null;

function SpinningModel({ url, scale = 1, yOffset = 0 }: { url: string, scale?: number, yOffset?: number }) {
  const { scene } = useGLTF(url);
  const clonedScene = React.useMemo(() => scene.clone(), [scene]);
  const ref = React.useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 2;
  });

  return (
    <group ref={ref} position={[0, yOffset, 0]}>
      <primitive object={clonedScene} scale={scale} />
    </group>
  );
}

// 📊 1. 차트 목업 데이터 생성기
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

// 📈 2. 호가창 목업 데이터 생성기 (현재가 기준 위아래 10호가)
const generateOrderBook = (currentPrice: number) => {
  const asks = []; // 매도 호가 (위에 위치)
  const bids = []; // 매수 호가 (아래에 위치)
  for (let i = 10; i > 0; i--) {
    asks.push({ price: currentPrice + i * 10, quantity: Math.floor(Math.random() * 300) + 50 });
  }
  for (let i = 1; i <= 10; i++) {
    bids.push({ price: currentPrice - i * 10, quantity: Math.floor(Math.random() * 300) + 50 });
  }
  return { asks, bids };
};

export function MarketPage() {
  // const { closeBuildingPage } = useGame(); // 커스텀 훅 이름 확인 후 사용
  const closeBuildingPage = useGameStore(state => state.closeBuildingPage); // Zustand 스탠다드 방식 권장
  const updateMoney = useGameStore(state => state.updateMoney);
  const updateMaterial = useGameStore(state => state.updateMaterial);
  const updateProduct = useGameStore(state => state.updateProduct);
  const industry = useGameStore(state => state.industry);
  const material = useGameStore(state => state.getIndustryItemNames().material);
  const product = useGameStore(state => state.getIndustryItemNames().product);
  const warehouseItems = useGameStore(state => state.warehouseItems);

  let matUrl = "/models/props/drill.glb";
  let prodUrl = "/models/props/rocks_B.gltf";
  // 마켓 비율/색상 조정
  let matScale = 2;
  let prodScale = 2;

  if (industry === "금광업") {
    matUrl = "/models/props/drill.glb"; matScale = 2.5;
    prodUrl = "/models/props/Gold_Nuggets.gltf"; prodScale = 4;
  } else if (industry === "금 제련업" || industry === "제철업") {
    matUrl = "/models/props/Gold_Nuggets.gltf"; matScale = 4;
    prodUrl = "/models/props/Gold_Bar.gltf"; prodScale = 3;
  } else if (industry === "제조업") {
    matUrl = "/models/props/Gold_Bar.gltf"; matScale = 3;
    prodUrl = "/models/props/drill.glb"; prodScale = 2.5;
  }

  const [mode, setMode] = useState<MarketMode>(null);
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [showPopup, setShowPopup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errImg, setErrImg] = useState(false);

  const [chartData, setChartData] = useState<{ time: string, price: number }[]>(generateMockChartData());
  const [orderBook, setOrderBook] = useState(generateOrderBook(chartData[chartData.length - 1].price));
  const [marketTrend, setMarketTrend] = useState<"up" | "down" | "neutral">("neutral");
  const currentPriceRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode && currentPriceRef.current) {
      currentPriceRef.current.scrollIntoView({ block: 'center' });
    }
  }, [mode]);

  // ⏱️ 3. 실시간 데이터 업데이트 (차트 & 호가창 동시 갱신)
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

        // 호가창도 새 가격에 맞춰 갱신!
        setOrderBook(generateOrderBook(newPrice));

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

    if (mode === "buy") {
      const isPaid = updateMoney(-totalAmount);
      if (!isPaid) {
        useAlertStore.getState().openAlert("잔액이 부족합니다.", "안내");
        return;
      }
      const added = updateMaterial(quantity);
      if (added < quantity) {
        useAlertStore.getState().openAlert(`창고 공간이 부족하여 ${added}개만 담았습니다. (나머지 금액 환불 처리됨)`, "창고 가득 참");
        // 환불 로직
        updateMoney((quantity - added) * price);
      }
    } else if (mode === "sell") {
      const prodList = warehouseItems.filter(i => i.type === "product");
      const currentCount = prodList.reduce((acc, i) => acc + i.quantity, 0);
      if (currentCount < quantity) {
        useAlertStore.getState().openAlert("창고에 판매할 생산품이 부족합니다.", "판매 불가");
        return;
      }
      updateProduct(-quantity);
      updateMoney(totalAmount);
    }

    setIsProcessing(true);
    try {
      // (목업 API 호출 주석처리 혹은 그대로 둔 상태로 프론트 제어)
      // await MarketAPI.createOrder({
      //   companyId: 1, itemId: 1, type: mode === "buy" ? "BUY" : "SELL", price: price, qty: quantity
      // });
      setShowPopup(true);
      useGameStore.getState().addAlert({
        message: mode === "buy" ? "구매 주문 완료" : "판매 주문 완료",
        detail: `${mode === "buy" ? material : product} ${quantity}개 / 총 ₩${totalAmount.toLocaleString()}`
      });
      setTimeout(() => {
        setShowPopup(false);
        setPrice(0);
        setQuantity(0);
        setMode(null);
      }, 2000);
    } catch (e) {
      console.error(e);
      useAlertStore.getState().openAlert("주문 처리 중 오류가 발생했습니다.", "주문 오류");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentMarketPrice = chartData[chartData.length - 1].price;
  const startPrice = chartData[0].price;
  const diff = currentMarketPrice - startPrice;
  const isUpTrend = diff >= 0;
  const diffSign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const pctStr = Math.abs((diff / startPrice) * 100).toFixed(1);
  const diffStr = `${diffSign}${Math.abs(diff).toLocaleString()}원 (${diffSign}${pctStr}%)`;

  const getPriceColor = (p: number) => {
    if (p > startPrice) return "text-rose-500";
    if (p < startPrice) return "text-blue-500";
    return "text-slate-800";
  };

  return (
    <div className={`absolute inset-0 z-40 flex flex-col pt-8 transition-colors duration-700 ease-out ${marketTrend === "up" ? "bg-rose-50" : marketTrend === "down" ? "bg-blue-50" : "bg-[#f5f0e8]"
      }`}
      style={{
        backgroundImage: "url('/images/market.png')",
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <BackButton onClick={() => { if (mode) setMode(null); else closeBuildingPage(); }} className="absolute top-6 left-6" />
      {!mode ? (
        // --- DEPTH 1: 메인 화면 ---
        <div className="flex-1 flex flex-col justify-center items-center gap-12 p-6 max-w-4xl mx-auto w-full relative z-10">
          <div className="flex gap-8 w-full h-80">
            <button onClick={() => setMode("buy")} className="flex-1 bg-white hover:bg-rose-50 border-4 border-slate-300 hover:border-rose-400 rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-6 group transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden">
              <div className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                <TrendingUp className="w-12 h-12 text-rose-500" />
              </div>
              <div className="relative z-10 text-center">
                <span className="text-5xl font-black text-slate-800 tracking-widest block">구 매</span>
                <span className="text-xl font-bold text-rose-500 mt-2 block opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">{material}</span>
              </div>
              <div className="absolute -bottom-10 -right-10 w-64 h-64 opacity-20 pointer-events-none group-hover:opacity-40 group-hover:scale-110 transition-all">
                <Canvas camera={{ position: [5, 5, 5], fov: 40 }}>
                  <ambientLight intensity={1.5} />
                  <directionalLight position={[10, 10, 10]} intensity={2} />
                  <SpinningModel url={matUrl} scale={matScale} />
                </Canvas>
              </div>
            </button>
            <button onClick={() => setMode("sell")} className="flex-1 bg-white hover:bg-blue-50 border-4 border-slate-300 hover:border-blue-400 rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-6 group transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden">
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                <TrendingDown className="w-12 h-12 text-blue-500" />
              </div>
              <div className="relative z-10 text-center">
                <span className="text-5xl font-black text-slate-800 tracking-widest block">판 매</span>
                <span className="text-xl font-bold text-blue-500 mt-2 block opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">{product}</span>
              </div>
              <div className="absolute -bottom-10 -right-10 w-64 h-64 opacity-20 pointer-events-none group-hover:opacity-40 group-hover:scale-110 transition-all filter grayscale-0 mix-blend-multiply">
                <Canvas camera={{ position: [5, 5, 5], fov: 40 }}>
                  <ambientLight intensity={1.5} />
                  <directionalLight position={[10, 10, 10]} intensity={2} />
                  <SpinningModel url={prodUrl} scale={prodScale} />
                </Canvas>
              </div>
            </button>
          </div>
        </div>
      ) : (
        // --- DEPTH 2: 차트 + 호가창 + 주문 폼 ---
        <div className="flex-1 flex flex-col justify-center items-center p-6 max-w-[1400px] mx-auto w-full gap-6 relative z-10 pt-16">
          <div className="flex w-full gap-4 items-stretch h-[calc(100vh-180px)] min-h-[500px]">

            {/* 📈 1. 실시간 차트 영역 (w-1/2) */}
            <div className="w-1/2 bg-white border-4 border-slate-300 rounded-3xl p-6 flex flex-col shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-700 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-slate-500" /> 실시간 시장 동향
                </h2>
                <div className="flex items-start gap-3 text-right pr-2 pt-3">
                  <div className="flex flex-col items-end">
                    <span className={`text-4xl font-black ${getPriceColor(currentMarketPrice)}`}>
                      ₩{currentMarketPrice.toLocaleString()}
                    </span>
                    <span className={`text-lg font-bold mt-1 ${getPriceColor(currentMarketPrice)}`}>
                      {diffStr}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
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
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="price" stroke={isUpTrend ? "#f43f5e" : "#3b82f6"} strokeWidth={4} fill={isUpTrend ? "url(#colorPriceUp)" : "url(#colorPriceDown)"} animationDuration={300} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 📊 2. 주식 호가창 영역 (w-1/4) */}
            <div className="w-1/4 bg-white border-4 border-slate-300 rounded-3xl p-4 flex flex-col shadow-xl overflow-hidden select-none">
              <div className="flex items-center justify-center mb-3 border-b-2 border-slate-100 pb-3">
                <h2 className="text-xl font-black text-slate-700">호가창</h2>
              </div>

              <div className="flex-1 flex flex-col text-sm font-bold overflow-y-auto overflow-x-hidden scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {/* 매도 (Asks) 영역 */}
                <div className="flex flex-col shrink-0">
                  {orderBook.asks.map((ask, idx) => (
                    <div
                      key={`ask-${idx}`}
                      className="grid grid-cols-[1fr_110px_1fr] items-center cursor-pointer hover:bg-slate-50 transition-colors h-[48px]"
                      onClick={() => { setPrice(ask.price); setQuantity(q => q === 0 ? 1 : q); }}
                    >
                      {/* 매도 수량 */}
                      <div className="relative h-full flex items-center justify-end pr-4">
                        <div className="absolute right-0 top-1.5 bottom-1.5 bg-blue-100/40 rounded-l transition-all" style={{ width: `${(ask.quantity / 400) * 100}%` }} />
                        <span className="text-blue-500 font-bold text-[17px] z-10 tracking-tight">{ask.quantity.toLocaleString()}</span>
                      </div>
                      {/* 가격 (Center) */}
                      <div className="h-full flex items-center justify-center">
                        <span className={`font-black text-[22px] ${getPriceColor(ask.price)}`}>
                          {ask.price.toLocaleString()}
                        </span>
                      </div>
                      {/* 구매 수량 (Empty) */}
                      <div className="h-full" />
                    </div>
                  ))}
                </div>

                {/* 현재가 구분 블록 */}
                <div
                  ref={currentPriceRef}
                  className="grid grid-cols-[1fr_110px_1fr] items-center h-[64px] shrink-0 my-1 border-y-2 border-slate-300 hover:bg-slate-100 bg-slate-50/50 relative z-10 transition-colors cursor-pointer shadow-sm"
                  onClick={() => { setPrice(currentMarketPrice); setQuantity(q => q === 0 ? 1 : q); }}
                >
                  <div className="h-full" />
                  <div className="h-full flex items-center justify-center relative z-10 bg-white border-x-2 border-slate-300 shadow-md">
                    <span className={`font-black text-[30px] ${getPriceColor(currentMarketPrice)}`}>
                      {currentMarketPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-full flex items-center justify-start pl-4">
                    <span className="text-slate-600 text-[16px] font-bold">현재가</span>
                  </div>
                </div>

                {/* 매수 (Bids) 영역 */}
                <div className="flex flex-col shrink-0">
                  {orderBook.bids.map((bid, idx) => (
                    <div
                      key={`bid-${idx}`}
                      className="grid grid-cols-[1fr_110px_1fr] items-center cursor-pointer hover:bg-slate-50 transition-colors h-[48px]"
                      onClick={() => { setPrice(bid.price); setQuantity(q => q === 0 ? 1 : q); }}
                    >
                      {/* 매도 수량 (Empty) */}
                      <div className="h-full" />
                      {/* 가격 (Center) */}
                      <div className="h-full flex items-center justify-center">
                        <span className={`font-black text-[22px] ${getPriceColor(bid.price)}`}>
                          {bid.price.toLocaleString()}
                        </span>
                      </div>
                      {/* 매수 수량 */}
                      <div className="relative h-full flex items-center justify-start pl-4">
                        <div className="absolute left-0 top-1.5 bottom-1.5 bg-rose-100/40 rounded-r transition-all" style={{ width: `${(bid.quantity / 400) * 100}%` }} />
                        <span className="text-rose-500 font-bold text-[17px] z-10 tracking-tight">{bid.quantity.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 📝 3. 주문 폼 영역 (w-1/4) */}
            <div className="w-1/4 bg-white border-4 border-slate-300 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
              <div className="flex flex-col gap-6">
                <h2 className="text-xl font-black text-slate-800 border-b-2 border-slate-100 pb-3 flex items-center justify-between">
                  <span>{mode === "buy" ? "구매 주문" : "판매 주문"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-500 mr-2">{mode === "buy" ? material : product}</span>
                    <span className={`text-sm px-3 py-1 rounded-full ${mode === "buy" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>{mode === "buy" ? "BUY" : "SELL"}</span>
                  </div>
                </h2>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-500 uppercase">주문 단가 (호가창 클릭)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price || ""}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      placeholder="가격 입력"
                      className={`w-full bg-slate-50 border-2 rounded-xl pl-10 pr-4 py-3 text-right text-xl font-black focus:outline-none transition-colors border-slate-200 focus:border-slate-400 text-slate-800`}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₩</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-500 uppercase">주문 수량</label>
                  <input
                    type="number"
                    value={quantity || ""}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    placeholder="수량 입력"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-right text-xl font-black text-slate-800 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div className="h-[2px] bg-slate-100 w-full" />

                {/* Total Amount */}
                <div className={`flex flex-col gap-1 rounded-2xl p-4 border-2 bg-slate-50 border-slate-200`}>
                  <span className={`font-bold text-xs uppercase tracking-widest text-slate-500`}>총 주문 금액</span>
                  <div className="text-right flex items-end justify-end gap-1">
                    <span className={`text-xl font-bold pb-[4px] text-slate-800`}>₩</span>
                    <span className={`text-3xl font-black leading-none tracking-tight text-slate-800`}>
                      {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleConfirm}
                disabled={price <= 0 || quantity <= 0 || isProcessing}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg mt-4 cursor-pointer ${price > 0 && quantity > 0 && !isProcessing
                  ? mode === "buy"
                    ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
                    : "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-200"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
              >
                <ShoppingCart className="w-5 h-5" />
                {isProcessing ? "처리중..." : "주문 접수"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Overlay */}
      {showPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl transform text-center w-full max-w-sm border-4 border-slate-200 flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${mode === "buy" ? "bg-rose-100 border-4 border-rose-200" : "bg-blue-100 border-4 border-blue-200"}`}>
              <ShoppingCart className={`w-10 h-10 ${mode === "buy" ? "text-rose-500" : "text-blue-500"}`} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">주문 생성 완료</h2>
            <p className="text-slate-500 font-bold">시장에 요청이 접수되었습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}