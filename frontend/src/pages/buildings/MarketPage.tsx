import React, { useState, useEffect, useRef, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import { ShoppingCart, TrendingUp, TrendingDown, Activity, ListOrdered, Clock, XCircle, BarChart2 } from "lucide-react";
import { useGameStore } from "../../store/gameStore";
import { MarketAPI } from "../../api/gameApi";
import { ComposedChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  timestamp?: number; // 게임 epoch millis (X축 역산용)
}

const CustomCandle = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || payload.open === undefined || payload.close === undefined || payload.low === undefined || payload.high === undefined) return null;
  const { open, close, low, high, prevClose } = payload;

  // 한국 주식 관례: 5분전(직전) 종가 대비 현재 종가가 높거나 같으면 빨간색(상승), 낮으면 파란색(하락)
  const isUp = close >= (prevClose ?? open);
  const color = isUp ? "#f43f5e" : "#3b82f6";

  const ratio = (val: number) => high === low ? 0.5 : (high - val) / (high - low);
  const pyHigh = y;
  const pyLow = y + height;
  const pyOpen = y + height * ratio(open);
  const pyClose = y + height * ratio(close);

  const bodyY = Math.min(pyOpen, pyClose);
  const bodyHeight = Math.max(Math.abs(pyOpen - pyClose), 1.5);

  return (
    <g>
      {/* 윗꼬리, 아랫꼬리 라인 (최고가, 최저가) */}
      <line x1={x + width / 2} y1={pyHigh} x2={x + width / 2} y2={pyLow} stroke={color} strokeWidth={2} />
      {/* 몸통 사각형 (시가, 종가) */}
      <rect x={x + width * 0.15} y={bodyY} width={Math.max(width * 0.7, 1)} height={bodyHeight} fill={color} stroke={color} strokeWidth={1} />
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const gameDateLabel = data.gameDate ? `20XX년 ${data.gameDate.replace('/', '월 ')}일` : "날짜 미상";
    return (
      <div className="bg-[#0f172a]/95 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl font-bold text-white text-xs min-w-[160px]">
        <div className="border-b border-white/10 pb-2 mb-2">
          <div className="text-[14px] text-amber-400 mb-1">{gameDateLabel}</div>
          <div className="text-[13px] text-slate-400">시간: {data.fullTime || label}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
          <span className="text-slate-400">시가:</span> <span className="text-right font-black">₩{(data.open ?? data.price)?.toLocaleString()}</span>
          <span className="text-slate-400">종가:</span> <span className="text-right font-black">₩{(data.close ?? data.price)?.toLocaleString()}</span>
          <span className="text-rose-400">최고가:</span> <span className="text-right font-black">₩{(data.high ?? data.price)?.toLocaleString()}</span>
          <span className="text-blue-400">최저가:</span> <span className="text-right font-black">₩{(data.low ?? data.price)?.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

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

  if (industry === "GOLD_MINING" || industry === "금광업") {
    matUrl = "/models/props/drill.glb"; matScale = 2.5;
    prodUrl = "/models/props/Gold_Nuggets.gltf"; prodScale = 4;
  } else if (industry === "GOLD_SMELTING" || industry === "금 제련업") {
    matUrl = "/models/props/Gold_Nuggets.gltf"; matScale = 4;
    prodUrl = "/models/props/Gold_Bar.gltf"; prodScale = 3;
  } else if (industry === "MANUFACTURING" || industry === "제조업") {
    matUrl = "/models/props/Gold_Bar.gltf"; matScale = 3;
    prodUrl = "/models/props/drill.glb"; prodScale = 2.5;
  }

  const [mode, setMode] = useState<MarketMode>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("order");
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [showPopup, setShowPopup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1분봉 차트 데이터
  const [chartData, setChartData] = useState<{ time: string; price: number; open?: number; high?: number; low?: number; close?: number; timestamp?: number }[]>([]);
  const [chartType, setChartType] = useState<"candle" | "line">("candle"); // 차트 타입 상태

  const [orderBook, setOrderBook] = useState<{ asks: Array<{ price: number, quantity: number }>, bids: Array<{ price: number, quantity: number }> }>({ asks: [], bids: [] });
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [marketTrend, setMarketTrend] = useState<"up" | "down" | "neutral">("neutral");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const currentPriceRef = useRef<HTMLDivElement>(null);

  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [changePrice, setChangePrice] = useState<number>(0);
  const [changeRate, setChangeRate] = useState<number>(0);

  const [hasDragged, setHasDragged] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(false);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);

  const snapToRight = useCallback(() => {
    if (scrollRef.current) {
      isAutoScrolling.current = true;
      scrollRef.current.scrollLeft = 999999;
      // 브라우저 렌더링 스크롤 이벤트를 무시하기 위해 플래그 타임아웃
      setTimeout(() => { isAutoScrolling.current = false; }, 100);
    }
  }, []);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX;
    scrollLeft.current = scrollRef.current.scrollLeft;

    // document 레벨에서 이벤트 수신: 마우스가 차트 밖으로 나가도 드래그 유지
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !scrollRef.current) return;
      ev.preventDefault();
      const walk = (ev.pageX - startX.current) * 1.5;
      scrollRef.current.scrollLeft = scrollLeft.current - walk;
      setHasDragged(true);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  // 하위 호환용 (JSX onMouse* 핸들러 유지)
  const handleDragLeave = () => { };
  const handleDragEnd = () => { isDragging.current = false; };
  const handleDragMove = (_e: React.MouseEvent) => { }; // document 레벨에서 처리

  // 🏷️ 아이템 ID 매핑 헬퍼
  // gameStore의 industry는 한국어로 저장됨 ("금광업", "금 제련업", "제조업")
  // 영어("GOLD_MINING" 등)와 한국어 모두 처리
  const getItemId = (m: MarketMode): number => {
    if (industry === "GOLD_MINING" || industry === "금광업") return m === "buy" ? 3 : 1;
    if (industry === "GOLD_SMELTING" || industry === "금 제련업" || industry === "제철업") return m === "buy" ? 1 : 2;
    if (industry === "MANUFACTURING" || industry === "제조업") return m === "buy" ? 2 : 3;
    return 1;
  };

  const itemId = mode ? getItemId(mode) : 1;

  // 모드/아이템 변경 시 모든 상태 즉시 초기화
  useEffect(() => {
    setChartData([]);
    setOrderBook({ asks: [], bids: [] });
    setTradeHistory([]);
    setPendingOrders([]);
    setCurrentPrice(0);
    setChangePrice(0);
    setChangeRate(0);
  }, [itemId]);

  // 📡 WebSocket (STOMP) — 오더북 실시간 구독
  useEffect(() => {
    if (!mode) return;

    const token = sessionStorage.getItem('accessToken');
    const wsUrl = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000') + '/ws-ecosim';
    const capturedItemId = itemId;

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe(`/topic/orderbook/${capturedItemId}`, (message) => {
          try {
            const data = JSON.parse(message.body);
            const asks = (data.sellOrders || []).map((o: any) => ({ ...o, quantity: o.totalQuantity || 0 }));
            const bids = (data.buyOrders || []).map((o: any) => ({ ...o, quantity: o.totalQuantity || 0 }));
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
          } catch (e) {
            console.warn("[WS] 오더북 메시지 파싱 실패:", e);
          }
        });

        // 최초 연결 시 REST로 초기 데이터 로드
        MarketAPI.getOrderbook(capturedItemId).then(res => {
          const data = (res.data?.data ?? res.data) as any;
          if (data && (data.sellOrders || data.buyOrders)) {
            const asks = (data.sellOrders || []).map((o: any) => ({ ...o, quantity: o.totalQuantity || 0 }));
            const bids = (data.buyOrders || []).map((o: any) => ({ ...o, quantity: o.totalQuantity || 0 }));
            setOrderBook({ asks, bids });
            if (data.currentPrice) {
              setCurrentPrice(data.currentPrice);
              setChangePrice(data.changePrice ?? 0);
              setChangeRate(data.changeRate ?? 0);
            }
          }
        }).catch(() => {});
      },
      onDisconnect: () => {},
      onStompError: (frame) => {
        console.warn("[WS] STOMP 에러:", frame.headers['message']);
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [mode, itemId]);

  // ⏱️ 폴링 — 차트/체결내역/미체결 주문 (오더북 제외)
  useEffect(() => {
    if (!mode) return;

    const controller = new AbortController();
    const capturedItemId = itemId;

    const fetchData = async () => {
      try {
        // [1] 백엔드 1분봉 차트 조회 (3초 폴링)
        try {
          const chartRes = await MarketAPI.get1MinCandles(capturedItemId, 100);
          if (controller.signal.aborted) return;

          const candles = chartRes.data?.data ?? chartRes.data;

          if (candles && Array.isArray(candles)) {
            const formatted = candles
              .filter((c: any) => !c.isLive)
              .sort((a: any, b: any) => a.timestamp - b.timestamp)
              .map((c: any) => {
                const dt = new Date(c.timestamp);
                const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
                return {
                  time: timeStr,
                  price: c.close,
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  timestamp: c.timestamp // ✅ 역산용
                };
              });

            setChartData(formatted);
          }
        } catch (e) {
          if (!controller.signal.aborted) console.warn("차트 조회 실패:", e);
        }

        // [3] 체결 내역 조회
        try {
          const tradeRes = await MarketAPI.getTrades(capturedItemId);
          if (controller.signal.aborted) return;

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
          if (!controller.signal.aborted) setTradeHistory([]);
        }

        // [4] 미체결(대기중) 주문 조회
        try {
          const pendingRes = await MarketAPI.getMyOrders(capturedItemId);
          if (controller.signal.aborted) return;

          const pendingData = pendingRes.data;
          let orders: any[] = [];
          if (Array.isArray(pendingData?.data)) {
            orders = pendingData.data;
          } else if (Array.isArray(pendingData)) {
            orders = pendingData;
          }
          setPendingOrders(orders.filter((o: any) =>
            o.status !== 'COMPLETED' && o.status !== 'CANCELED' && o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELED' && (o.remainingQuantity ?? o.totalQuantity) > 0
          ));
        } catch {
          if (!controller.signal.aborted) setPendingOrders([]);
        }

      } catch (err) {
        if (!controller.signal.aborted) console.warn("마켓 데이터 조회 실패:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);

    return () => {
      // itemId가 바뀌거나 컴포넌트가 언마운트될 때 진행 중인 요청 취소
      controller.abort();
      clearInterval(interval);
    };
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

  const handleCancelOrder = async (orderId: string) => {
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
    const REAL_MIN_IN_GAME_MS = 8_640_000;
    const MIN_SLOTS = 20;

    // ── 1. 확정 캔들: timestamp를 UTC 기준으로 시간 레이블 생성
    let prevClose: number = currentPrice || 0;
    const confirmed = chartData.map((c, idx) => {
      const dt = new Date(c.timestamp ?? 0);
      const hh = dt.getUTCHours().toString().padStart(2, '0');
      const mm = dt.getUTCMinutes().toString().padStart(2, '0');
      // X축 표시용 레이블 (00시)
      const label = `${hh}시`;
      // 툴팁용 정교한 시간
      const fullTime = `${hh}:${mm}`;
      const gameDate = `${(dt.getUTCMonth() + 1).toString().padStart(2, '0')}/${dt.getUTCDate().toString().padStart(2, '0')}`;
      const prev = idx === 0 ? (currentPrice || c.close || 0) : (chartData[idx - 1].close ?? prevClose);
      prevClose = c.close ?? prevClose;
      return {
        time: label,
        fullTime,
        gameDate,
        price: c.close ?? 0,
        open: c.open ?? c.close ?? 0,
        high: c.high ?? c.close ?? 0,
        low: c.low ?? c.close ?? 0,
        close: c.close ?? 0,
        bounds: [c.low ?? c.close ?? 0, c.high ?? c.close ?? 0],
        prevClose: prev,
        isLive: false,
        isEmpty: false,
      };
    });

    // ── 2. 실시간 캔들
    let liveCandle = null;
    if (currentPrice) {
      const lastTs = chartData.length > 0 ? (chartData[chartData.length - 1].timestamp ?? 0) : 0;
      const liveTs = lastTs > 0 ? lastTs + REAL_MIN_IN_GAME_MS : Date.now();
      const dt = new Date(liveTs);
      const hh = dt.getUTCHours().toString().padStart(2, '0');
      const mm = dt.getUTCMinutes().toString().padStart(2, '0');
      const label = `${hh}시`;
      const fullTime = `${hh}:${mm}`;
      const gameDate = `${(dt.getUTCMonth() + 1).toString().padStart(2, '0')}/${dt.getUTCDate().toString().padStart(2, '0')}`;
      const openPrice = prevClose || currentPrice;
      liveCandle = {
        time: label,
        fullTime,
        gameDate,
        price: currentPrice,
        open: openPrice,
        high: Math.max(openPrice, currentPrice),
        low: Math.min(openPrice, currentPrice),
        close: currentPrice,
        bounds: [Math.min(openPrice, currentPrice), Math.max(openPrice, currentPrice)],
        prevClose: openPrice,
        isLive: true,
        isEmpty: false,
      };
    }

    const data = liveCandle ? [...confirmed, liveCandle] : confirmed;

    // ── 3. 최소 20개 슬롯 보장: 부족하면 왼쪽에 빈 슬롯 추가
    if (data.length < MIN_SLOTS) {
      const emptySlots = [];
      for (let i = 0; i < MIN_SLOTS - data.length; i++) {
        emptySlots.push({
          time: '',
          gameDate: '',
          price: 0,
          open: 0, high: 0, low: 0, close: 0,
          bounds: [0, 0],
          prevClose: 0,
          isLive: false,
          isEmpty: true,
        });
      }
      return [...emptySlots, ...data];
    }

    return data;
  };


  const displayChartData = getDisplayChartData();
  const visibleDataLen = displayChartData.length;
  // 캔들 1개당 24px 고정. 차트는 항상 컨테이너 100% 이상 → 캔들 적으면 꼽 채우고, 많으면 스크롤
  const CANDLE_WIDTH_PX = 24;
  const chartMinWidthPx = visibleDataLen * CANDLE_WIDTH_PX;

  // 🌟 게임 시간(10분 사이클) 당일 시가 대비 현재가 비교
  const lastCandle = displayChartData.length > 0 ? displayChartData[displayChartData.length - 1] : null;

  // 백엔드에서 제공하는 changePrice를 역해산하여 당일 시가(10분 사이클 시작가) 도출
  const todayOpenPrice = currentPrice - changePrice;

  const currentCandleOpen = lastCandle?.open ?? currentPrice;

  // 📊 보이는 캔들 범위에서 실제 high/low 계산 (동적 Y축)
  const computeVisibleDomain = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const totalWidth = el.scrollWidth;
    const viewWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    // displayChartData.length 를 직접 암소하지 않고 DOM 기반으로 계산 → 무한루프 방지
    const itemWidth = totalWidth > 0 && el.children[0] ? el.children[0].scrollWidth / Math.max(1, el.children[0].children.length) : 1;
    const total = totalWidth > 0 && itemWidth > 0 ? Math.round(totalWidth / itemWidth) : 60;
    const startIdx = Math.max(0, Math.floor((scrollLeft / totalWidth) * total) - 1);
    const endIdx = Math.min(total - 1, Math.ceil(((scrollLeft + viewWidth) / totalWidth) * total) + 1);
    setVisibleRange({ start: startIdx, end: endIdx });
  }, []); // ✅ 의존성 배열 비움: displayChartData 없이 DOM 기반으로

  // 보이는 캔들 중 실제 데이터가 있는 것만
  const realCandles = displayChartData.filter(c => !c.isEmpty && c.high > 0 && c.low > 0);

  // Y축: 가장 오른쪽 캔들(현재가) 중심으로 범위 설정
  const rightPrice = lastCandle?.close ?? currentPrice;
  let minY: number;
  let maxY: number;

  if (realCandles.length > 0) {
    const rawMin = Math.min(...realCandles.map(c => c.low ?? 0));
    const rawMax = Math.max(...realCandles.map(c => c.high ?? 0));
    // 현재가 기준 ±3% 범위와 실제 데이터 범위 중 더 넓은 것 사용
    const centerRange = rightPrice * 0.03;
    const dataMin = Math.min(rawMin, rightPrice - centerRange);
    const dataMax = Math.max(rawMax, rightPrice + centerRange);
    const padding = Math.max((dataMax - dataMin) * 0.1, 500);
    minY = Math.floor((dataMin - padding) / 500) * 500;
    maxY = Math.ceil((dataMax + padding) / 500) * 500;
  } else {
    // 데이터 없으면 현재가 기준 fallback
    const base = rightPrice || 50000;
    minY = Math.floor((base * 0.97) / 500) * 500;
    maxY = Math.ceil((base * 1.03) / 500) * 500;
  }

  // 틱 간격을 범위에 맞게 자동 결정
  const yRange = maxY - minY;
  const tickStep = yRange <= 3000 ? 500 : yRange <= 8000 ? 1000 : yRange <= 20000 ? 2000 : 5000;
  const yTicks = [];
  for (let t = minY; t <= maxY; t += tickStep) {
    yTicks.push(t);
  }

  const currentPriceToCompare = currentPrice || (lastCandle?.close ?? 0);

  const customDiff = changePrice;
  const isUpTrend = customDiff > 0;
  const customPct = changeRate;

  // 가격 색상 결정
  const priceColor = isUpTrend ? "text-rose-500" : (customDiff < 0 ? "text-blue-500" : "text-slate-800");

  useEffect(() => {
    setHasDragged(false);
  }, [mode]);

  useEffect(() => {
    if (!scrollRef.current) return;

    // 드래그 중이 아닐 때만 우측 고정
    if (!hasDragged) snapToRight();

    const interval = setInterval(() => {
      if (!hasDragged) snapToRight();
    }, 200);

    const observer = new ResizeObserver(() => {
      if (!hasDragged) snapToRight();
    });
    if (scrollRef.current.firstChild) observer.observe(scrollRef.current.firstChild as Element);

    const handleScroll = () => {
      if (!isAutoScrolling.current) {
        setHasDragged(true);
      }
      computeVisibleDomain();
    };
    scrollRef.current.addEventListener('scroll', handleScroll);

    // 초기 마운트 시 한 번 계산
    computeVisibleDomain();

    return () => {
      clearInterval(interval);
      observer.disconnect();
      if (scrollRef.current) {
        scrollRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hasDragged, mode, snapToRight, computeVisibleDomain]);
  const customDiffSign = customDiff > 0 ? "+" : customDiff < 0 ? (customDiff === 0 ? "" : "-") : "";
  const customPctStr = Math.abs(customPct).toFixed(1);
  const diffStr = `${customDiff > 0 ? "+" : ""}${customDiff.toLocaleString()}원 (${customDiff > 0 ? "+" : ""}${customPctStr}%)`;

  const getPriceColor = (p: number) => {
    const defaultPriceColor = "text-slate-800";
    if (currentPrice <= 0) return defaultPriceColor;
    if (p > todayOpenPrice) return "text-rose-500";
    if (p < todayOpenPrice) return "text-blue-500";
    return defaultPriceColor;
  };



  const formatPrice = (value: number) => {
    if (!value) return "0";
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 1000000) {
      const man = Math.floor(value / 10000);
      const rest = value % 10000;
      return rest > 0 ? `${man}만 ${rest.toLocaleString()}` : `${man}만`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col pt-8 bg-[#131a3d]"
      style={{
        backgroundImage: "url('/images/market.png')",
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      {/* 🌌 프리미엄 딥 네이비 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1426]/30 via-[#0F1A30]/40 to-[#040810]/50 z-0 pointer-events-none" />
      <BackButton onClick={() => { if (mode) setMode(null); else closeBuildingPage(); }} className="absolute top-6 left-6" />
      {!mode ? (
        // --- DEPTH 1: 메인 화면 ---
        <div className="flex-1 flex flex-col justify-center items-center gap-12 p-6 max-w-4xl mx-auto w-full relative z-10">
          <div className="flex gap-8 w-full h-80">
            <button onClick={() => setMode("buy")} className="flex-1 bg-white/90 backdrop-blur-xl border border-white/20 hover:bg-rose-50/90 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center gap-6 group transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden">
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
            <button onClick={() => setMode("sell")} className="flex-1 bg-white/90 backdrop-blur-xl border border-white/20 hover:bg-blue-50/90 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center gap-6 group transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden">
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
            <div className="w-1/2 bg-white/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-slate-700 flex items-center gap-3 relative">
                  <Activity className="w-6 h-6 text-slate-500" /> 실시간 시장 동향

                  {/* 토글형 스위치 단추 */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 gap-1 ml-2 shadow-inner">
                    <button
                      onClick={() => setChartType("candle")}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1 cursor-pointer ${chartType === "candle" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" /> 캔들
                    </button>
                    <button
                      onClick={() => setChartType("line")}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1 cursor-pointer ${chartType === "line" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                    >
                      <Activity className="w-3.5 h-3.5" /> 선
                    </button>
                  </div>
                </h2>
                <div className="flex items-start gap-3 text-right pr-2 pt-1">
                  <div className="flex flex-col items-end">
                    <span className={`text-4xl font-black ${getPriceColor(currentMarketPrice)}`}>
                      ₩{currentMarketPrice.toLocaleString()}
                    </span>
                    <span className={`text-lg font-bold mt-1 ${getPriceColor(currentMarketPrice)}`}>
                      {diffStr}
                    </span>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                      {/* 1분봉 안내 */}
                      <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 1분봉
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full flex flex-col pt-1 relative">
                {/* 📊 차트 합성(Scrolling body + Fixed Y-axis) 영역 */}
                <div className="flex-1 w-full relative box-border">
                  {/* 스크롤 가능한 차트 영역 */}
                  <div
                    ref={scrollRef}
                    className="absolute inset-y-0 right-0 left-[60px] overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden focus:outline-none"
                    onMouseEnter={() => scrollRef.current?.focus()}
                    onMouseDown={(e) => {
                      scrollRef.current?.focus();
                      handleDragStart(e);
                    }}
                    onMouseLeave={handleDragLeave}
                    onMouseUp={handleDragEnd}
                    onMouseMove={handleDragMove}
                    onWheel={() => setHasDragged(true)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!scrollRef.current) return;
                      const step = 80;
                      if (e.key === 'ArrowLeft') { scrollRef.current.scrollLeft -= step; setHasDragged(true); e.preventDefault(); }
                      if (e.key === 'ArrowRight') { scrollRef.current.scrollLeft += step; setHasDragged(true); e.preventDefault(); }
                    }}
                  >
                    <div style={{ minWidth: `${chartMinWidthPx}px`, width: '100%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={displayChartData} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isUpTrend ? "#f43f5e" : (customDiff < 0 ? "#3b82f6" : "#cbd5e1")} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={isUpTrend ? "#f43f5e" : (customDiff < 0 ? "#3b82f6" : "#cbd5e1")} stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="time"
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            height={40}
                            tick={(props: any) => {
                              const { x, y, index } = props;
                              const item = displayChartData[index];
                              if (!item || item.isEmpty) return <g />;
                              const prevItem = index > 0 ? displayChartData[index - 1] : null;
                              const showDate = item.gameDate && (!prevItem || prevItem.gameDate !== item.gameDate);
                              return (
                                <g transform={`translate(${x - 30},${y})`}>
                                  <text x={0} y={0} dy={12} textAnchor="start" fill="#94a3b8" fontSize={9} fontWeight="bold">
                                    {item.time}
                                  </text>
                                  {showDate && (
                                    <text x={0} y={0} dy={24} textAnchor="start" fill="#f59e0b" fontSize={8} fontWeight="black">
                                      {item.gameDate}
                                    </text>
                                  )}
                                </g>
                              );
                            }}
                          />
                          <YAxis
                            domain={[minY, maxY]}
                            ticks={yTicks}
                            allowDataOverflow={true}
                            hide
                          />
                          <Tooltip content={<CustomTooltip />} />

                          {chartType === "candle" ? (
                            <Bar
                              dataKey="bounds"
                              shape={<CustomCandle />}
                              isAnimationActive={false}
                            />
                          ) : (
                            <Area
                              type="linear"
                              dataKey="price"
                              stroke={isUpTrend ? "#f43f5e" : (customDiff < 0 ? "#3b82f6" : "#cbd5e1")}
                              strokeWidth={3}
                              fill="url(#colorPrice)"
                              isAnimationActive={false}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 좌측 고정 Y축 (Fixed YAxis Overlay) */}
                  <div className="absolute top-0 left-0 bottom-0 w-[60px] z-10 bg-transparent pointer-events-none select-none overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={displayChartData} margin={{ top: 10, right: 0, left: -20, bottom: 5 }}>
                        <XAxis hide height={24} />
                        <YAxis
                          domain={[minY, maxY]}
                          ticks={yTicks}
                          allowDataOverflow={true}
                          stroke="#cbd5e1"
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                          tickFormatter={formatPrice}
                          width={80}
                          axisLine={false}
                          tickLine={false}
                        />
                        {/* 왼쪽 호가 축 배경에도 동일하게 차트 노출(Y축 연동용) */}
                        {chartType === "candle" ? (
                          <Bar
                            dataKey="bounds"
                            shape={<CustomCandle />}
                            isAnimationActive={false}
                          />
                        ) : (
                          <Area
                            type="linear"
                            dataKey="price"
                            stroke="transparent"
                            fill="transparent"
                            isAnimationActive={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 그래프 하단 안내 및 상호작용 영역 */}
                <div className="relative mt-2 h-[36px] flex items-center w-full">
                  <div className={`text-center text-xs font-black transition-opacity duration-500 ${hasDragged ? "opacity-0 pointer-events-none" : "text-slate-300 opacity-100"}`}>
                    그래프를 드래그해서 과거 기록을 확인하세요!
                  </div>

                  {hasDragged && (
                    <button
                      onClick={() => setHasDragged(false)}
                      className="absolute right-0 flex items-center gap-2 px-4 py-1.5 bg-[#1A2342] hover:bg-[#232F59] text-white text-[11px] font-black rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 active:scale-95 cursor-pointer z-40 border border-white/20"
                    >
                      <Activity className="w-4 h-4" /> 실시간 가격 보기
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 📊 2. 주식 호가창 영역 (w-1/4) */}
            <div className="w-1/4 bg-white/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden select-none relative">
              <div className="absolute top-4 left-4 right-4 z-20 flex bg-transparent pb-1.5 border-b border-slate-100/40 items-center justify-center">
                <h2 className="text-xl font-black text-slate-700">호가</h2>
              </div>

              <div className="flex-1 flex flex-col text-sm font-bold overflow-y-auto [&::-webkit-scrollbar]:hidden gap-4 pt-12 pb-12">
                {(() => {
                  const DISPLAY_LEVELS = 10; // 위아래 각 10개씩

                  // 현재가보다 높은 매도 호가만 필터링 (가격 내림차순)
                  const askPrices = [...orderBook.asks]
                    .filter(ask => ask.price >= currentMarketPrice)
                    .sort((a, b) => b.price - a.price)
                    .slice(0, DISPLAY_LEVELS);

                  // 현재가보다 낮은 매수 호가만 필터링 (가격 내림차순)
                  const bidPrices = [...orderBook.bids]
                    .filter(bid => bid.price <= currentMarketPrice)
                    .sort((a, b) => b.price - a.price)
                    .slice(0, DISPLAY_LEVELS);

                  const displayPrices = [];

                  // 빈 행 개수 계산
                  const emptyAsksCount = DISPLAY_LEVELS - askPrices.length;
                  const emptyBidsCount = DISPLAY_LEVELS - bidPrices.length;

                  // 위쪽 빈 행 추가 (매도 호가가 부족한 경우)
                  for (let i = 0; i < emptyAsksCount; i++) {
                    displayPrices.push({ type: 'empty', side: 'ask' as const });
                  }

                  // 매도 호가 추가 (높은 가격 → 낮은 가격)
                  askPrices.forEach(ask => {
                    displayPrices.push({
                      price: ask.price,
                      askQty: ask.quantity,
                      bidQty: 0,
                      type: 'ask'
                    });
                  });

                  // 현재가 추가 (중앙 고정)
                  displayPrices.push({
                    price: currentMarketPrice,
                    askQty: 0,
                    bidQty: 0,
                    type: 'current'
                  });

                  // 매수 호가 추가 (높은 가격 → 낮은 가격)
                  bidPrices.forEach(bid => {
                    displayPrices.push({
                      price: bid.price,
                      askQty: 0,
                      bidQty: bid.quantity,
                      type: 'bid'
                    });
                  });

                  // 아래쪽 빈 행 추가 (매수 호가가 부족한 경우)
                  for (let i = 0; i < emptyBidsCount; i++) {
                    displayPrices.push({ type: 'empty', side: 'bid' as const });
                  }

                  return displayPrices.map((item, idx) => {
                    // 빈 행 렌더링
                    if (item.type === 'empty') {
                      return <div key={idx} className="h-[100px]" />;
                    }

                    if (item.type === 'current') {
                      return (
                        <div
                          key={idx}
                          ref={currentPriceRef}
                          className="grid grid-cols-[1fr_110px_1fr] items-center h-[64px] shrink-0 border-y-2 border-slate-300 hover:bg-slate-100 bg-slate-50/50 relative z-10 transition-colors cursor-pointer shadow-sm"
                          onClick={() => { if (item.price) setPrice(item.price); setQuantity(q => q === 0 ? 1 : q); }}
                        >
                          <div className="h-full" />
                          <div className="h-full flex items-center justify-center relative z-10">
                            <span className="font-black text-[30px] text-slate-800">
                              {item.price?.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-full flex items-center justify-start pl-4">
                            <span className="text-slate-600 text-[16px] font-bold tracking-tight">현재가</span>
                          </div>
                        </div>
                      );
                    }

                    // 매도/매수 호가
                    const isAsk = item.type === 'ask';
                    const qty = isAsk ? item.askQty : item.bidQty;

                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_110px_1fr] items-center h-[100px] hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => { if (item.price) setPrice(item.price); setQuantity(q => q === 0 ? 1 : q); }}
                      >
                        <div className="relative h-full flex items-center justify-end pr-4">
                          {isAsk && qty !== undefined && qty > 0 && (
                            <>
                              <div className="absolute right-0 top-1.5 bottom-1.5 bg-blue-100/40 rounded-l transition-all" style={{ width: `${Math.min(((qty ?? 0) / 400) * 100, 100)}%` }} />
                              <span className="text-blue-500 font-bold text-[20px] z-10 tracking-tight">{qty?.toLocaleString()}</span>
                            </>
                          )}
                        </div>
                        <div className="h-full flex items-center justify-center relative z-10">
                          <span className={`font-black text-[26px] ${isAsk ? 'text-blue-500' : 'text-rose-500'}`}>
                            {item.price?.toLocaleString()}
                          </span>
                        </div>
                        <div className="relative h-full flex items-center justify-start pl-4">
                          {!isAsk && qty !== undefined && qty > 0 && (
                            <>
                              <div className="absolute left-0 top-1.5 bottom-1.5 bg-rose-100/40 rounded-r transition-all" style={{ width: `${Math.min(((qty ?? 0) / 400) * 100, 100)}%` }} />
                              <span className="text-rose-500 font-bold text-[20px] z-10 tracking-tight">{qty?.toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* 📝 3. 주문 폼 & 탭 패널 영역 (w-1/4) */}
            <div className="w-1/4 bg-white/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
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
                                {order.createdAt ? new Date(order.createdAt.replace(' ', 'T') + (order.createdAt.endsWith('Z') ? '' : 'Z')).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ""}
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
                                {trade.createdAt ? new Date(trade.createdAt.replace(' ', 'T') + (trade.createdAt.endsWith('Z') ? '' : 'Z')).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : "방금 전"}
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