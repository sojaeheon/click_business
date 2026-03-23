import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { toast } from 'sonner';
import { useGameStore, localizeIndustryText } from '../store/gameStore';

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

        // 최근에 발생한 알림을 기억하여 중복 무한 알림 방지 (핵심 로직)
        const recentMessages = new Set<string>();

        // 개인 알림 큐 구독
        client.subscribe('/user/queue/notifications', (frame) => {
          try {
            const data = JSON.parse(frame.body);
            
            // 💡 백엔드 버그로 인해 똑같은 메시지가 계속 오는 것을 프론트단에서 필터링
            if (recentMessages.has(data.message)) {
              return; // 이미 보여준 알림은 무시
            }
            
            // 새 메시지 등록 후, 60초 지나면 캐시 큐에서 삭제해 다시 받을 수 있도록 조치
            recentMessages.add(data.message);
            setTimeout(() => {
              recentMessages.delete(data.message);
            }, 60000);

            // gameStore에 알림 추가 (벨 배지 + AlertModal 목록) — 영어 산업명 한글 치환
            const localizedMsg = localizeIndustryText(data.message);
            addAlert({ message: localizedMsg, detail: data.type });

            // 화면 우하단 토스트 팝업 — 클릭 시 알림 모달 열기
            toast(localizedMsg, {
              description: typeLabel(data.type),
              duration: 4000,
              action: {
                label: '확인',
                onClick: () => useGameStore.getState().openModal('alert'),
              },
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
