import React, { useState, useEffect, useRef, useCallback } from "react";
import { ShoppingCart, TrendingUp, TrendingDown, Activity, ListOrdered, Clock, XCircle } from "lucide-react";
import { useGameStore } from "../../store/gameStore";
import { MarketAPI } from "../../api/gameApi";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

type MarketMode = "buy" | "sell" | null;
type PanelTab = "order" | "pending" | "history";

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

// 1분봉 캔들 데이터 구조
interface MinuteCandle {
  time: string;      // "HH:MM" 형식
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function MarketPage() {
  const closeBuildingPage = useGameStore(state => state.closeBuildingPage);
  const money = useGameStore(state => state.money);
  const industry = useGameStore(state => state.industry);
  const material = useGameStore(state => state.getIndustryItemNames().material);
  const product = useGameStore(state => state.getIndustryItemNames().product);
  const warehouseItems = useGameStore(state => state.warehouseItems);

  let matUrl = "/models/props/drill.glb";
  let prodUrl = "/models/props/rocks_B.gltf";
  let matScale = 2;
  let prodScale = 2;

  if (industry === "GOLD_MINING") {
    matUrl = "/models/props/drill.glb"; matScale = 2.5;
    prodUrl = "/models/props/Gold_Nuggets.gltf"; prodScale = 4;
  } else if (industry === "GOLD_SMELTING") {
    matUrl = "/models/props/Gold_Nuggets.gltf"; matScale = 4;
    prodUrl = "/models/props/Gold_Bar.gltf"; prodScale = 3;
  } else if (industry === "MANUFACTURING") {
    matUrl = "/models/props/Gold_Bar.gltf"; matScale = 3;
    prodUrl = "/models/props/drill.glb"; prodScale = 2.5;
  }

  const [mode, setMode] = useState<MarketMode>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("order");
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [showPopup, setShowPopup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1분봉 차트 데이터: 각 분에 하나의 가격 포인트 누적
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const minuteCandlesRef = useRef<Map<string, number>>(new Map()); // "HH:MM" → 해당 분의 마지막 가격
  const [currentMinuteKey, setCurrentMinuteKey] = useState<string>("");

  const [orderBook, setOrderBook] = useState<{ asks: Array<{ price: number, quantity: number }>, bids: Array<{ price: number, quantity: number }> }>({ asks: [], bids: [] });
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [marketTrend, setMarketTrend] = useState<"up" | "down" | "neutral">("neutral");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const currentPriceRef = useRef<HTMLDivElement>(null);

  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [changePrice, setChangePrice] = useState<number>(0);
  const [changeRate, setChangeRate] = useState<number>(0);

  const [hasDragged, setHasDragged] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };
  const handleDragLeave = () => { isDragging.current = false; };
  const handleDragEnd = () => { isDragging.current = false; };
  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
    setHasDragged(true);
  };

  // 🏷️ 아이템 ID 매핑 헬퍼
  const getItemId = (m: MarketMode): number => {
    if (industry === "GOLD_MINING") return m === "buy" ? 3 : 1;
    if (industry === "GOLD_SMELTING") return m === "buy" ? 1 : 2;
    if (industry === "MANUFACTURING") return m === "buy" ? 2 : 3;
    return 1;
  };

  const itemId = mode ? getItemId(mode) : 1;

  // 현재 분 키 ("HH:MM") 계산
  const getMinuteKey = () => {
    const now = new Date();
    return now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // 새 가격을 받을 때마다 1분봉 차트에 반영
  const updateMinuteChart = useCallback((latestPrice: number) => {
    const minuteKey = getMinuteKey();

    setCurrentMinuteKey(prev => {
      if (prev !== minuteKey) {
        // 새로운 분이 시작됨 → 새 캔들 추가
        minuteCandlesRef.current.set(minuteKey, latestPrice);

        setChartData(prevData => {
          const newPoint = { time: minuteKey, price: latestPrice };
          // 최대 30개 분봉 유지
          const updated = [...prevData, newPoint].slice(-30);
          return updated;
        });
        return minuteKey;
      } else {
        // 같은 분 내에서 가격 업데이트 → 마지막 포인트 업데이트
        minuteCandlesRef.current.set(minuteKey, latestPrice);

        setChartData(prevData => {
          if (prevData.length === 0) return [{ time: minuteKey, price: latestPrice }];
          const updated = [...prevData];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx].time === minuteKey) {
            updated[lastIdx] = { ...updated[lastIdx], price: latestPrice };
          } else {
            updated.push({ time: minuteKey, price: latestPrice });
          }
          return updated.slice(-30);
        });
        return prev;
      }
    });
  }, []);

  // ⏱️ 실시간 데이터 업데이트 (오더북, 체결내역, 미체결 주문)
  useEffect(() => {
    if (!mode) return;

    const fetchData = async () => {
      try {
        // [1] 오더북/호가창 조회
        const res = await MarketAPI.getOrderbook(itemId);
        const data = res.data as any;

        if (data && (data.sellOrders || data.buyOrders)) {
          const asks = (data.sellOrders || []).map((o: any) => ({ ...o, quantity: o.remainingQuantity || o.totalQuantity || 0 }));
          const bids = (data.buyOrders || []).map((o: any) => ({ ...o, quantity: o.remainingQuantity || o.totalQuantity || 0 }));
          setOrderBook({ asks, bids });

          const latestPrice = data.currentPrice;
          if (latestPrice) {
            setCurrentPrice(latestPrice);
            setChangePrice(data.changePrice ?? 0);
            setChangeRate(data.changeRate ?? 0);

            setChartData(prev => {
              const lastPrice = prev.length > 0 ? prev[prev.length - 1].price : latestPrice;
              if (latestPrice > lastPrice) setMarketTrend("up");
              else if (latestPrice < lastPrice) setMarketTrend("down");
              else setMarketTrend("neutral");
              setTimeout(() => setMarketTrend("neutral"), 800);
              return prev;
            });
          }
        } else {
          setOrderBook({ asks: [], bids: [] });
        }

        // [2] 차트 조회 (B안)
        try {
          const chartRes = await MarketAPI.getMarketChart(itemId);
          const cData = chartRes.data?.data ?? chartRes.data;
          if (cData && Array.isArray(cData.points)) {
            const uniqueMap = new Map();
            cData.points.forEach((d: any) => {
              const t = d.timestamp ? new Date(d.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : "";
              if (t) {
                uniqueMap.set(t, { time: t, price: d.price ?? 0 });
              }
            });
            const deduplicated = Array.from(uniqueMap.values()) as { time: string; price: number }[];
            setChartData(deduplicated);
          }
        } catch (e) {
          console.warn("차트 조회 실패:", e);
        }

        // [3] 체결 내역 조회 (항상)
        try {
          const tradeRes = await MarketAPI.getTrades(itemId);
          const tradeData = tradeRes.data;
          if (tradeData?.success && Array.isArray(tradeData.data)) {
            setTradeHistory(tradeData.data);
          } else if (Array.isArray(tradeData?.data)) {
            setTradeHistory(tradeData.data);
          } else if (Array.isArray(tradeData)) {
            setTradeHistory(tradeData);
          } else {
            setTradeHistory([]);
          }
        } catch {
          setTradeHistory([]);
        }

        // [3] 미체결(대기중) 주문 조회 (항상)
        try {
          const pendingRes = await MarketAPI.getMyOrders(itemId);
          const pendingData = pendingRes.data;
          let orders = [];
          if (Array.isArray(pendingData?.data)) {
            orders = pendingData.data;
          } else if (Array.isArray(pendingData)) {
            orders = pendingData;
          }
          // COMPLETED나 CANCELED가 아닌, 잔량이 남아있는 주문만 대기중으로 표시
          setPendingOrders(orders.filter((o: any) =>
            o.status !== 'COMPLETED' && o.status !== 'CANCELED' && o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELED' && (o.remainingQuantity ?? o.totalQuantity) > 0
          ));
        } catch {
          setPendingOrders([]);
        }

      } catch (err) {
        console.warn("마켓 데이터 조회 실패:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [mode, itemId]);

  const totalAmount = price * quantity;

  const handleConfirm = async () => {
    if (quantity <= 0 || price <= 0 || !mode) return;
    setIsProcessing(true);

    try {
      await MarketAPI.createOrder({
        itemId: itemId,
        type: mode === "buy" ? "BUY" : "SELL",
        price: price,
        qty: quantity
      });

      await useGameStore.getState().fetchCompanyData(1);

      setShowPopup(true);
      useGameStore.getState().addAlert({
        message: mode === "buy" ? "구매 주문 등록 (미수령)" : "판매 주문 등록 (미수령)",
        detail: "주문이 시장에 등록되었습니다. 체결 내역에서 수령해주세요!"
      });

      setTimeout(() => {
        setShowPopup(false);
        setPrice(0);
        setQuantity(0);
        setPanelTab("pending"); // 주문 후 대기중 탭으로 이동
      }, 1500);
    } catch (e: any) {
      console.error(e);
      const errorDetail = e.response?.data?.message || e.message || "서버 통신 중 알 수 없는 오류가 발생했습니다.";
      useAlertStore.getState().openAlert(`사유: ${errorDetail}`, "주문 오류");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      await MarketAPI.cancelOrder(orderId);
      await useGameStore.getState().fetchCompanyData(1);
      useGameStore.getState().addAlert({ message: "주문 취소 완료", detail: "주문이 취소되었습니다." });
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || "취소에 실패했습니다.";
      useAlertStore.getState().openAlert(msg, "취소 오류");
    } finally {
      setCancellingId(null);
    }
  };

  const currentMarketPrice = currentPrice || (chartData.length > 0 ? chartData[chartData.length - 1].price : 0);
  const getDisplayChartData = () => {
    if (chartData.length === 0) {
      const result = [];
      const now = new Date();
      for (let i = 59; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60000);
        result.push({ time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, price: null as any });
      }
      return result;
    }

    const map = new Map<string, number>();
    chartData.forEach(d => map.set(d.time, d.price));

    const firstStr = chartData[0].time;
    const now = new Date();
    const currStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const [fh, fm] = firstStr.split(':').map(Number);
    let iterDate = new Date();
    iterDate.setHours(fh, fm, 0, 0);

    const diffMins = Math.floor((now.getTime() - iterDate.getTime()) / 60000);
    if (diffMins < 59) {
      iterDate = new Date(now.getTime() - 59 * 60000);
    }

    const result = [];
    let lastKnownPrice = chartData[0].price;

    while (iterDate <= now) {
      const tStr = `${iterDate.getHours().toString().padStart(2, '0')}:${iterDate.getMinutes().toString().padStart(2, '0')}`;
      if (map.has(tStr)) lastKnownPrice = map.get(tStr)!;
      result.push({ time: tStr, price: lastKnownPrice });
      iterDate = new Date(iterDate.getTime() + 60000);
    }

    if (result.length > 0 && result[result.length - 1].time !== currStr) {
      if (map.has(currStr)) lastKnownPrice = map.get(currStr)!;
      result.push({ time: currStr, price: lastKnownPrice });
    }

    return result;
  };

  const displayChartData = getDisplayChartData();
  const visibleDataLen = displayChartData.length;
  const chartWidthPct = Math.max(100, (visibleDataLen / 10) * 100);
  const diff = changePrice;
  const isUpTrend = diff >= 0;
  
  useEffect(() => {
    if (!scrollRef.current || hasDragged) return;
    const el = scrollRef.current;
    const scrollToEnd = () => { if (el) el.scrollLeft = 999999; };
    
    const observer = new ResizeObserver(() => {
      scrollToEnd();
      setTimeout(scrollToEnd, 50);
    });
    
    if (el.firstChild) {
      observer.observe(el.firstChild as Element);
    }
    
    scrollToEnd(); // initial
    return () => observer.disconnect();
  }, [hasDragged, displayChartData.length]);
  const diffSign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const pctStr = Math.abs(changeRate).toFixed(1);
  const diffStr = `${diffSign}${Math.abs(diff).toLocaleString()}원 (${diffSign}${pctStr}%)`;

  const getPriceColor = (p: number) => {
    const defaultPriceColor = "text-slate-800";
    if (currentPrice <= 0) return defaultPriceColor;
    const sPrice = currentPrice - changePrice;
    if (sPrice <= 0) return defaultPriceColor;
    if (p > sPrice) return "text-rose-500";
    if (p < sPrice) return "text-blue-500";
    return defaultPriceColor;
  };



  const formatPrice = (value: number) => {
    if (!value) return "0";
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) {
      const man = Math.floor(value / 10000);
      const rest = Math.floor((value % 10000) / 1000);
      return rest > 0 ? `${man}만${rest}천` : `${man}만`;
    }
    return value.toLocaleString();
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
        // --- DEPTH 2: 차트 + 호가창 + (주문/대기중/체결 동적 패널) ---
        <div className="flex-1 flex flex-col justify-center items-center p-6 max-w-[1400px] mx-auto w-full gap-6 relative z-10 pt-16">
          <div className="flex w-full gap-4 items-stretch h-[calc(100vh-180px)] min-h-[500px]">

            {/* 📈 1. 실시간 차트 영역 (w-1/2) */}
            <div className="w-1/2 bg-white border-4 border-slate-300 rounded-3xl p-6 flex flex-col shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-slate-700 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-slate-500" /> 실시간 시장 동향
                </h2>
                <div className="flex items-start gap-3 text-right pr-2 pt-1">
                  <div className="flex flex-col items-end">
                    <span className={`text-4xl font-black ${getPriceColor(currentMarketPrice)}`}>
                      ₩{currentMarketPrice.toLocaleString()}
                    </span>
                    <span className={`text-lg font-bold mt-1 ${getPriceColor(currentMarketPrice)}`}>
                      {diffStr}
                    </span>
                    {/* 1분봉 안내 */}
                    <span className="text-xs text-slate-400 font-bold mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 1분봉
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full flex flex-col pt-1">
                {/* 📊 차트 합성(Scrolling body + Fixed Y-axis) 영역 */}
                <div className="flex-1 w-full relative box-border">
                  {/* 스크롤 가능한 차트 영역 */}
                  <div
                    ref={scrollRef}
                    className="absolute inset-0 overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden focus:outline-none"
                    onMouseEnter={() => scrollRef.current?.focus()}
                    onMouseDown={(e) => {
                      scrollRef.current?.focus();
                      handleDragStart(e);
                    }}
                    onMouseLeave={handleDragLeave}
                    onMouseUp={handleDragEnd}
                    onMouseMove={handleDragMove}
                    onScroll={() => setHasDragged(true)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!scrollRef.current) return;
                      const step = 80;
                      if (e.key === 'ArrowLeft') { scrollRef.current.scrollLeft -= step; setHasDragged(true); e.preventDefault(); }
                      if (e.key === 'ArrowRight') { scrollRef.current.scrollLeft += step; setHasDragged(true); e.preventDefault(); }
                    }}
                  >
                    <div style={{ width: `${chartWidthPct}%`, height: '100%', paddingLeft: '60px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
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
                          <XAxis dataKey="time" stroke="#cbd5e1" tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" minTickGap={30} />
                          <YAxis domain={[(dataMin: number) => (dataMin ? Math.max(0, dataMin - 100) : 'auto'), (dataMax: number) => (dataMax ? dataMax + 100 : 'auto')]} hide />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: 'bold' }}
                            formatter={(value: any) => [`₩${Number(value).toLocaleString()}`, '가격']}
                            labelFormatter={(label) => `시간: ${label}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke={isUpTrend ? "#f43f5e" : "#3b82f6"}
                            strokeWidth={3}
                            fill={isUpTrend ? "url(#colorPriceUp)" : "url(#colorPriceDown)"}
                            dot={false}
                            connectNulls={false}
                            animationDuration={0}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 좌측 고정 Y축 (Fixed YAxis Overlay) */}
                  <div className="absolute top-0 left-0 bottom-[24px] w-[60px] z-10 bg-white/95 backdrop-blur shadow-[2px_0_5px_rgba(0,0,0,0.03)] pointer-events-none select-none overflow-hidden pb-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={displayChartData} margin={{ top: 10, right: 0, left: -20, bottom: 5 }}>
                        <YAxis
                          domain={[(dataMin: number) => (dataMin ? Math.max(0, dataMin - 100) : 'auto'), (dataMax: number) => (dataMax ? dataMax + 100 : 'auto')]}
                          stroke="#cbd5e1"
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                          tickFormatter={formatPrice}
                          width={80}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Area dataKey="price" fill="none" stroke="none" activeDot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 그래프 하단 안내 텍스트 */}
                <div className={`text-center text-xs mt-3 font-extrabold transition-opacity duration-500 rounded-lg p-1.5 ${hasDragged ? "opacity-0 pointer-events-none" : "text-slate-500 bg-slate-50 opacity-100 border border-slate-200"}`}>
                  💡 그래프를 드래그해서 과거 기록을 확인하세요!
                </div>
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
                  {[...orderBook.asks].reverse().map((ask, idx) => {
                    const isCurrent = ask.price === currentMarketPrice;
                    return (
                      <div
                        key={`ask-${idx}`}
                        className={`grid grid-cols-[1fr_110px_1fr] items-center cursor-pointer transition-colors ${isCurrent ? 'h-[64px] my-1 border-y-2 border-slate-300 bg-slate-50/50 hover:bg-slate-100 shadow-sm' : 'h-[48px] hover:bg-slate-50'
                          }`}
                        onClick={() => { setPrice(ask.price); setQuantity(q => q === 0 ? 1 : q); }}
                      >
                        <div className="relative h-full flex items-center justify-end pr-4">
                          <div className="absolute right-0 top-1.5 bottom-1.5 bg-blue-100/40 rounded-l transition-all" style={{ width: `${(ask.quantity / 400) * 100}%` }} />
                          <span className="text-blue-500 font-bold text-[17px] z-10 tracking-tight">{ask.quantity.toLocaleString()}</span>
                        </div>
                        <div className="h-full flex items-center justify-center relative z-10">
                          <span className={`font-black ${isCurrent ? 'text-[30px] text-slate-800' : 'text-[22px] text-blue-500'}`}>{ask.price.toLocaleString()}</span>
                        </div>
                        <div className="h-full flex items-center justify-start pl-4">
                          {isCurrent && <span className="text-slate-600 text-[16px] font-bold tracking-tight">현재가</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 현재가가 호가 잔량 배열에 아예 없어서 사라졌을 경우 가운데에 따로 표시 */}
                {!orderBook.asks.some(a => a.price === currentMarketPrice) &&
                  !orderBook.bids.some(b => b.price === currentMarketPrice) && currentMarketPrice > 0 && (
                    <div
                      ref={currentPriceRef}
                      className="grid grid-cols-[1fr_110px_1fr] items-center h-[64px] shrink-0 my-1 border-y-2 border-slate-300 hover:bg-slate-100 bg-slate-50/50 relative z-10 transition-colors cursor-pointer shadow-sm"
                      onClick={() => { setPrice(currentMarketPrice); setQuantity(q => q === 0 ? 1 : q); }}
                    >
                      <div className="h-full" />
                      <div className="h-full flex items-center justify-center relative z-10">
                        <span className="font-black text-[30px] text-slate-800">
                          {currentMarketPrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-full flex items-center justify-start pl-4">
                        <span className="text-slate-600 text-[16px] font-bold tracking-tight">현재가</span>
                      </div>
                    </div>
                  )}

                {/* 매수 (Bids) 영역 */}
                <div className="flex flex-col shrink-0">
                  {orderBook.bids.map((bid, idx) => {
                    // 💡 매도(asks)에 현재가 항목이 이미 가동 중이라면 매수에서는 일반 스타일로 처리해 중복 표기 방지
                    const isCurrent = bid.price === currentMarketPrice &&
                      !orderBook.asks.some(a => a.price === currentMarketPrice);
                    return (
                      <div
                        key={`bid-${idx}`}
                        className={`grid grid-cols-[1fr_110px_1fr] items-center cursor-pointer transition-colors ${isCurrent ? 'h-[64px] my-1 border-y-2 border-slate-300 bg-slate-50/50 hover:bg-slate-100 shadow-sm' : 'h-[48px] hover:bg-slate-50'
                          }`}
                        onClick={() => { setPrice(bid.price); setQuantity(q => q === 0 ? 1 : q); }}
                      >
                        <div className="h-full flex items-center justify-end pr-4">
                          {isCurrent && <span className="text-slate-600 text-[16px] font-bold tracking-tight">현재가</span>}
                        </div>
                        <div className="h-full flex items-center justify-center relative z-10">
                          <span className={`font-black ${isCurrent ? 'text-[30px] text-slate-800' : 'text-[22px] text-rose-500'}`}>{bid.price.toLocaleString()}</span>
                        </div>
                        <div className="relative h-full flex items-center justify-start pl-4">
                          <div className="absolute left-0 top-1.5 bottom-1.5 bg-rose-100/40 rounded-r transition-all" style={{ width: `${(bid.quantity / 400) * 100}%` }} />
                          <span className="text-rose-500 font-bold text-[17px] z-10 tracking-tight">{bid.quantity.toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 📝 3. 주문 폼 & 탭 패널 영역 (w-1/4) */}
            <div className="w-1/4 bg-white border-4 border-slate-300 rounded-3xl p-4 flex flex-col justify-between shadow-xl">
              <div className="flex flex-col gap-4 h-full">

                {/* 3탭 헤더 */}
                <div className="flex border-b-2 border-slate-100 pb-3 gap-1">
                  <button
                    onClick={() => setPanelTab("order")}
                    className={`flex-1 text-center py-1.5 rounded-xl font-black text-[13px] transition-all ${panelTab === "order" ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                  >
                    주문 신청
                  </button>
                  <button
                    onClick={() => setPanelTab("pending")}
                    className={`flex-1 text-center py-1.5 rounded-xl font-black text-[13px] transition-all relative ${panelTab === "pending" ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                  >
                    대기중
                    {pendingOrders.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                        {pendingOrders.length > 9 ? "9+" : pendingOrders.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setPanelTab("history")}
                    className={`flex-1 text-center py-1.5 rounded-xl font-black text-[13px] transition-all relative ${panelTab === "history" ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                  >
                    체결 내역
                    {tradeHistory.filter((t: any) => !t.isCollected).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                        {tradeHistory.filter((t: any) => !t.isCollected).length}
                      </span>
                    )}
                  </button>
                </div>

                {panelTab === "order" && (
                  /* --- 주문 신청 탭 --- */
                  <div className="flex flex-col gap-4 flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black text-slate-800">{mode === "buy" ? "구매 주문" : "판매 주문"}</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">{mode === "buy" ? material : product}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${mode === "buy" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>{mode === "buy" ? "BUY" : "SELL"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-slate-500 uppercase">단가 설정 (호가창 클릭)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={price || ""}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          placeholder="가격 입력"
                          className="w-full bg-slate-50 border-2 rounded-xl pl-10 pr-4 py-3 text-right text-xl font-black focus:outline-none transition-colors border-slate-200 focus:border-slate-400 text-slate-800"
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
                        className={`w-full bg-slate-50 border-2 rounded-xl px-4 py-3 text-right text-xl font-black focus:outline-none transition-colors ${mode === 'sell' && quantity > warehouseItems.filter(i => i.type === 'product').reduce((a, i) => a + i.quantity, 0)
                            ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-slate-400'
                          }`}
                      />
                      {mode === 'sell' && (() => {
                        const owned = warehouseItems.filter(i => i.type === 'product').reduce((a, i) => a + i.quantity, 0);
                        return <div className={`text-xs font-bold text-right ${quantity > owned ? 'text-rose-500' : 'text-slate-400'}`}>보유 중: {owned.toLocaleString()}개</div>;
                      })()}
                    </div>

                    <div className="mt-auto flex flex-col gap-3">
                      <div className="h-[2px] bg-slate-100 w-full" />
                      <div className="flex flex-col gap-1 rounded-2xl p-4 border-2 bg-slate-50 border-slate-200">
                        <span className="font-bold text-xs uppercase tracking-widest text-slate-500">총 주문 금액</span>
                        <div className="text-right flex items-end justify-end gap-1">
                          <span className="text-xl font-bold pb-[4px] text-slate-800">₩</span>
                          <span className="text-3xl font-black leading-none tracking-tight text-slate-800">{totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleConfirm}
                        disabled={price <= 0 || quantity <= 0 || isProcessing}
                        className={`w-full py-4 rounded-3xl font-black text-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${price > 0 && quantity > 0 && !isProcessing
                            ? mode === "buy" ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200" : "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-200"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                          }`}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        {isProcessing ? "처리중..." : "주문 접수"}
                      </button>
                    </div>
                  </div>
                )}

                {panelTab === "pending" && (
                  /* --- 대기중 탭 (미체결 주문) --- */
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-1">
                      <Clock className="w-5 h-5 text-amber-500" />
                      <span>주문 대기중</span>
                      <span className="ml-auto text-sm font-bold text-slate-400">{pendingOrders.length}건</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 [&::-webkit-scrollbar]:hidden">
                      {pendingOrders.length > 0 ? (
                        pendingOrders.map((order: any, idx: number) => (
                          <div key={order.orderId ?? idx} className="p-3 border-2 rounded-xl transition-colors border-slate-200 bg-slate-50">
                            <div className="flex justify-between items-center">
                              <span className={`font-black text-[14px] ${order.orderType === "BUY" ? "text-rose-500" : "text-blue-500"}`}>
                                {order.orderType === "BUY" ? "매수" : "매도"} ₩{(order.price ?? 0).toLocaleString()}
                              </span>
                              <button
                                onClick={() => handleCancelOrder(order.orderId)}
                                disabled={cancellingId === order.orderId}
                                className="p-1 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-40"
                                title="주문 취소"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-slate-500 text-xs font-bold">
                                잔량 {(order.remainingQuantity ?? order.totalQuantity ?? 0).toLocaleString()} / 총 {(order.totalQuantity ?? 0).toLocaleString()}개
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ""}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2">
                          <Clock className="w-10 h-10" />
                          <span className="text-sm font-bold">대기 중인 주문이 없습니다.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {panelTab === "history" && (
                  /* --- 체결 내역 탭 --- */
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-1">
                      <ListOrdered className="w-5 h-5" />
                      <span>체결 내역</span>
                      <span className="ml-auto text-sm font-bold text-slate-400">{tradeHistory.length}건</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 [&::-webkit-scrollbar]:hidden">
                      {tradeHistory.length > 0 ? (
                        tradeHistory.map((trade: any, idx: number) => (
                          <div key={idx} className={`p-3 border-2 rounded-xl transition-colors ${trade.isCollected ? "border-slate-100 bg-white opacity-60" : "border-amber-200 bg-amber-50"}`}>
                            <div className="flex justify-between items-center">
                              <span className={`font-black text-[14px] ${trade.orderType === "BUY" ? "text-rose-500" : "text-blue-500"}`}>
                                {trade.orderType === "BUY" ? "매수" : "매도"} ₩{(trade.price ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400">
                                {trade.createdAt ? new Date(trade.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : "방금 전"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-slate-600 font-bold text-sm">수량: {(trade.executionQuantity ?? 0).toLocaleString()}개</span>
                              {!trade.isCollected && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await MarketAPI.collectTrade(trade.tradeHistoryId);
                                      await useGameStore.getState().fetchCompanyData(1);
                                      useGameStore.getState().addAlert({
                                        message: "체결 결과 수령 완료",
                                        detail: `${trade.executionQuantity}개가 정산되었습니다.`
                                      });
                                    } catch (err: any) {
                                      const msg = err.response?.data?.message || err.message || "수령에 실패했습니다.";
                                      useAlertStore.getState().openAlert(msg, "수령 오류");
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-amber-500 text-white text-[11px] font-black rounded-lg hover:bg-amber-600 transition-colors"
                                >
                                  수령
                                </button>
                              )}
                              {trade.isCollected && (
                                <span className="text-[11px] text-slate-400 font-bold">수령 완료</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2">
                          <Activity className="w-10 h-10" />
                          <span className="text-sm font-bold">진행된 체결 내역이 없습니다.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
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