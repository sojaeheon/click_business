/**
 * 실시간 호가창 WebSocket(STOMP) 부하 테스트
 *
 * ──────────────────────────────────────────────────────────────
 * 전제 조건
 * ──────────────────────────────────────────────────────────────
 * 이 테스트는 백엔드에 아래 구현이 완료된 후 사용합니다:
 *   1. 호가창 변경 시 서버가 /topic/orderbook/{itemId} 로 push
 *   2. MatchingService 체결 후 SimpMessagingTemplate.convertAndSend() 호출
 *
 * 현재 WebSocket 엔드포인트: ws://localhost:8000/ws-ecosim
 * 프로토콜: STOMP over WebSocket (SockJS 없이 순수 WS)
 *
 * ──────────────────────────────────────────────────────────────
 * STOMP 프로토콜 흐름
 * ──────────────────────────────────────────────────────────────
 * 클라이언트                         서버
 *   |-- CONNECT (Authorization) -->   |
 *   |<-- CONNECTED ---------------    |
 *   |-- SUBSCRIBE /topic/orderbook/1 ->|
 *   |<-- MESSAGE (호가창 데이터) ---   |  ← 매칭 체결/주문 등록 시마다 push
 *   |-- DISCONNECT ---------------->  |
 *
 * ──────────────────────────────────────────────────────────────
 * 실행 방법
 * ──────────────────────────────────────────────────────────────
 * # 기본 (localhost:8000, JWT 자동 발급)
 *   k6 run tests/orderbook-ws.js
 *
 * # EC2 환경
 *   k6 run -e ENV=ec2 tests/orderbook-ws.js
 *
 * # 직접 발급한 토큰 사용
 *   k6 run -e TOKEN=eyJhbGci... tests/orderbook-ws.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Rate, Counter } from 'k6/metrics';
import { config } from '../config/environments.js';

// ── k6 옵션 ─────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp-up
    { duration: '2m',  target: 10 }, // steady: WS 연결 유지 상태에서 메시지 수신 측정
    { duration: '30s', target: 50 }, // spike: 동시 구독자 급증
    { duration: '1m',  target: 50 }, // spike 유지
    { duration: '30s', target: 0  }, // ramp-down
  ],
  thresholds: {
    // WS 연결 성공률 99% 이상
    'ws_connecting':                       ['p(95)<1000'],  // 연결 수립 95%가 1초 이내
    'orderbook_first_message_ms':          ['p(95)<500'],   // 첫 메시지 수신 95%가 500ms 이내
    'ws_session_duration':                 ['p(95)<180000'],
    http_req_failed:                       ['rate<0.01'],
  },
};

// ── 커스텀 지표 ──────────────────────────────────────────────────────────────
const firstMessageLatency = new Trend('orderbook_first_message_ms');  // 구독 후 첫 메시지 수신까지 걸린 시간
const messagesReceived    = new Counter('orderbook_messages_received'); // 수신한 총 메시지 수
const wsConnectFail       = new Rate('ws_connect_fail_rate');           // WS 연결 실패율

// 테스트할 아이템 ID (1: 금석, 2: 금괴석, 3: 금 드릴)
const ITEM_IDS = [1, 2, 3];

// ── STOMP 프레임 생성 헬퍼 ───────────────────────────────────────────────────
// STOMP 프레임 형식: "COMMAND\nheader:value\n\nbody\0"
function stompFrame(command, headers = {}, body = '') {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}:${v}`)
    .join('\n');
  return `${command}\n${headerLines}\n\n${body}\0`;
}

// ── setup(): JWT 토큰 발급 (테스트 시작 전 1회) ──────────────────────────────
export function setup() {
  const baseUrl = config.baseUrl;
  console.log(`${config.label} 호가창 WS 부하 테스트 시작`);

  // 환경변수에 토큰이 있으면 재사용, 없으면 게스트 로그인으로 발급
  if (__ENV.TOKEN) {
    console.log('외부 JWT 토큰 사용');
    return { baseUrl, token: __ENV.TOKEN };
  }

  // 게스트 로그인으로 JWT 발급
  // ⚠️ 게스트 계정은 회사가 없으므로 WS 구독(READ)만 가능
  const res = http.post(`${baseUrl}/users/guest`, null, {
    headers: { 'Content-Type': 'application/json' },
  });

  const token = JSON.parse(res.body)?.data?.accessToken;
  if (!token) {
    console.error('JWT 발급 실패 — 서버가 실행 중인지 확인하세요');
    return { baseUrl, token: null };
  }

  console.log('게스트 JWT 발급 완료');
  return { baseUrl, token };
}

// ── default(): 각 VU가 반복 실행 ────────────────────────────────────────────
export default function ({ baseUrl, token }) {
  if (!token) {
    console.error('토큰 없음 — 테스트 스킵');
    return;
  }

  // VU별로 아이템을 분산 (1,2,3을 골고루 구독)
  const itemId = ITEM_IDS[__VU % ITEM_IDS.length];

  // HTTP baseUrl을 WS URL로 변환
  // http://localhost:8000/api/v1 → ws://localhost:8000/ws-ecosim
  const wsUrl = baseUrl
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
    .replace('/api/v1', '/ws-ecosim');

  let subscribeTime = null;   // SUBSCRIBE 프레임 전송 시각
  let firstMsgReceived = false;

  const session = ws.connect(
    wsUrl,
    { headers: {} }, // WS 연결 자체에는 헤더 불필요 — STOMP CONNECT 프레임에서 인증
    function (socket) {
      // ── WS 연결 성공 ─────────────────────────────────────────────────────
      socket.on('open', () => {
        // Step 1: STOMP CONNECT — Authorization 헤더로 JWT 전달
        socket.send(stompFrame('CONNECT', {
          'Authorization':  `Bearer ${token}`,
          'accept-version': '1.2',
          'heart-beat':     '0,0',  // heartbeat 비활성화 (테스트 단순화)
        }));
      });

      // ── 메시지 수신 처리 ──────────────────────────────────────────────────
      socket.on('message', (data) => {
        // STOMP 프레임 파싱 (첫 줄이 명령어)
        const command = data.split('\n')[0].trim();

        if (command === 'CONNECTED') {
          // Step 2: STOMP CONNECTED → 호가창 토픽 구독
          subscribeTime = Date.now();
          socket.send(stompFrame('SUBSCRIBE', {
            'id':          `sub-${__VU}`,
            'destination': `/topic/orderbook/${itemId}`,
          }));
        }

        if (command === 'MESSAGE') {
          messagesReceived.add(1);

          // 첫 메시지 수신 레이턴시 기록
          if (!firstMsgReceived && subscribeTime !== null) {
            firstMessageLatency.add(Date.now() - subscribeTime);
            firstMsgReceived = true;
          }

          // 메시지 내용 파싱 (body는 \n\n 이후)
          try {
            const bodyStart = data.indexOf('\n\n') + 2;
            const body = data.substring(bodyStart).replace('\0', '');
            const payload = JSON.parse(body);

            check(payload, {
              '호가창 데이터 currentPrice 포함': (p) => p?.currentPrice !== undefined,
              '호가창 데이터 buyOrders 포함':    (p) => Array.isArray(p?.buyOrders),
              '호가창 데이터 sellOrders 포함':   (p) => Array.isArray(p?.sellOrders),
            });
          } catch {
            // JSON 파싱 실패는 무시 (ping/heartbeat 프레임 등)
          }
        }

        if (command === 'ERROR') {
          console.error(`[STOMP ERROR] VU=${__VU} item=${itemId}: ${data}`);
        }
      });

      socket.on('error', (e) => {
        console.error(`[WS ERROR] VU=${__VU}: ${e}`);
        wsConnectFail.add(1);
      });

      // 30초 동안 메시지 수신 후 연결 종료
      // (MatchingScheduler가 100ms마다 체결하므로 30초면 메시지 충분히 수신)
      socket.setTimeout(() => {
        socket.send(stompFrame('DISCONNECT'));
        socket.close();
      }, 30000);
    }
  );

  // WS 연결 자체 성공 여부 체크
  const connected = check(session, {
    'WebSocket 연결 성공': (s) => s && s.status === 101,
  });
  wsConnectFail.add(!connected);

  sleep(1);
}

// ── teardown() ───────────────────────────────────────────────────────────────
export function teardown({ token }) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('호가창 WebSocket 부하 테스트 완료.');
  console.log('');
  console.log('확인 포인트:');
  console.log('  orderbook_first_message_ms  — 구독 후 첫 메시지까지 레이턴시');
  console.log('  orderbook_messages_received — 총 수신 메시지 수');
  console.log('  ws_connect_fail_rate        — WS 연결 실패율');
  console.log('');
  console.log('게스트 계정 DB 정리:');
  console.log('  docker exec -it postgres-db psql -U ecosim -d ecosim \\');
  console.log('    -c "DELETE FROM users WHERE is_guest = true;"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
