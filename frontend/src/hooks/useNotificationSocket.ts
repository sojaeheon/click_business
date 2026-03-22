import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { toast } from 'sonner';
import { useGameStore } from '../store/gameStore';

// 로컬: ws://localhost:5173/ws-ecosim → Vite proxy → ws://localhost:8000/ws-ecosim
// EC2:  ws://15.165.236.217/ws-ecosim → nginx ingress → backend
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${protocol}//${window.location.host}`;

/**
 * WebSocket(STOMP)으로 백엔드 알림 채널을 구독하는 훅.
 * App.tsx 최상위에서 한 번만 호출하세요.
 */
export function useNotificationSocket() {
  const addAlert = useGameStore((s) => s.addAlert);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) return; // 비로그인 시 연결하지 않음

    const client = new Client({
      // SockJS 없이 순수 WebSocket 사용 (Vite 환경 호환)
      brokerURL: `${WS_BASE}/ws-ecosim`,

      // STOMP CONNECT 헤더에 JWT 삽입
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },

      reconnectDelay: 5000, // 연결 끊기면 5초 후 재시도

      onConnect: () => {
        console.log('[WSNotification] 연결됨');

        // 개인 알림 큐 구독
        client.subscribe('/user/queue/notifications', (frame) => {
          try {
            const data = JSON.parse(frame.body);
            // gameStore에 알림 추가 (벨 배지 + AlertModal 목록)
            addAlert({ message: data.message, detail: data.type });

            // 화면 우하단 토스트 팝업
            toast(data.message, {
              description: typeLabel(data.type),
              duration: 4000,
            });
          } catch (e) {
            console.error('[WSNotification] 메시지 파싱 실패', e);
          }
        });
      },

      onDisconnect: () => {
        console.log('[WSNotification] 연결 해제됨');
      },

      onStompError: (frame) => {
        console.error('[WSNotification] STOMP 오류', frame);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, []); // 마운트 시 1회 실행
}

function typeLabel(type: string): string {
  switch (type) {
    case 'TRADE':      return '📈 거래 체결';
    case 'PRODUCTION': return '🏭 생산 완료';
    case 'SYSTEM':     return '🔔 시스템';
    default:           return '알림';
  }
}
