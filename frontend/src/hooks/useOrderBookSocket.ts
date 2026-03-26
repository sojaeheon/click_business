import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';

// 로컬: ws://localhost:5173/ws-ecosim → Vite proxy → ws://localhost:8000/ws-ecosim
// EC2:  wss://... → nginx → backend
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${protocol}//${window.location.host}`;

export interface OrderBookMessage {
  itemId: number;
  currentPrice: number | null;
  changePrice: number | null;
  changeRate: number | null;
  buyOrders: { price: number; totalQuantity: number }[];
  sellOrders: { price: number; totalQuantity: number }[];
}

/**
 * WebSocket(STOMP)으로 호가창 실시간 데이터를 수신하는 훅.
 * 백엔드 /topic/orderbook/{itemId} 를 구독하여 100ms 단위로 push되는 데이터를 수신.
 *
 * @param itemId   구독할 아이템 ID (1,2,3)
 * @param onMessage 메시지 수신 시 호출될 콜백
 */
export function useOrderBookSocket(
  itemId: number,
  onMessage: (data: OrderBookMessage) => void,
) {
  const clientRef = useRef<Client | null>(null);
  // 최신 콜백을 ref로 유지하여 불필요한 재연결 방지
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');

    const client = new Client({
      brokerURL: `${WS_BASE}/ws-ecosim`,
      // JWT가 있으면 헤더에 삽입 (없어도 공개 토픽은 구독 가능)
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,

      onConnect: () => {
        console.log(`[OrderBookSocket] 연결됨 — item ${itemId}`);
        client.subscribe(`/topic/orderbook/${itemId}`, (frame) => {
          try {
            const data: OrderBookMessage = JSON.parse(frame.body);
            onMessageRef.current(data);
          } catch (e) {
            console.error('[OrderBookSocket] 메시지 파싱 실패', e);
          }
        });
      },

      onDisconnect: () => {
        console.log(`[OrderBookSocket] 연결 해제됨 — item ${itemId}`);
      },

      onStompError: (frame) => {
        console.error('[OrderBookSocket] STOMP 오류', frame);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [itemId]); // itemId 변경 시 기존 연결 해제 후 재연결
}
