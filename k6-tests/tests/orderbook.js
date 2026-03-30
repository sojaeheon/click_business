/**
 * 실시간 호가창 부하 테스트
 *
 * ──────────────────────────────────────────────────────────────
 * 왜 이 방식인가?
 * ──────────────────────────────────────────────────────────────
 * MarketMatchingService.matchItem()은 HTTP 엔드포인트가 없습니다.
 * MatchingScheduler가 서버 내부에서 100ms마다 자동 호출합니다.
 *
 * 따라서 부하 테스트 접근법:
 *   1. [READ]  호가창 조회 — GET /api/v1/market/orderbooks?item_id={n}
 *              인증 불필요, Redis 조회 성능 직접 측정
 *
 *   2. [WRITE] 주문 생성 — POST /api/v1/market/orders
 *              JWT 필요, 회사 자산 필요 (아래 설명 참고)
 *              → 주문이 Redis 호가창에 쌓이면 MatchingService까지 간접 테스트됨
 *
 * ──────────────────────────────────────────────────────────────
 * 실행 방법
 * ──────────────────────────────────────────────────────────────
 * # 기본 (localhost:8000, READ만)
 *   k6 run tests/orderbook.js
 *
 * # EC2 환경
 *   k6 run -e ENV=ec2 tests/orderbook.js
 *
 * # WRITE 테스트 포함 (미리 발급한 JWT 토큰 필요)
 *   k6 run -e TOKEN=eyJhbGci... tests/orderbook.js
 *
 * ──────────────────────────────────────────────────────────────
 * 주의: WRITE 테스트 활성화 시
 * ──────────────────────────────────────────────────────────────
 * - 실제 DB/Redis에 주문이 쌓입니다
 * - 테스트 계정에 충분한 캐시(현금)가 있어야 합니다 (BUY 주문)
 * - 테스트 후 미체결 주문을 수동 정리하세요:
 *     docker exec -it postgres-db psql -U ecosim -d ecosim \
 *       -c "DELETE FROM market_orders WHERE company_id = {테스트_회사_ID} AND status = 'PENDING';"
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { config } from '../config/environments.js';

// ── k6 옵션 ─────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp-up: 30초 동안 10명으로 증가
    { duration: '1m',  target: 10 }, // steady:  1분 유지
    { duration: '30s', target: 50 }, // spike:   갑자기 50명으로 급증 (호가창 몰림 시뮬레이션)
    { duration: '1m',  target: 50 }, // steady:  1분 유지
    { duration: '30s', target: 0  }, // ramp-down
  ],
  thresholds: {
    // 호가창 조회: 95%가 200ms 이내 (Redis 조회이므로 빨라야 함)
    'http_req_duration{name:orderbook_read}': ['p(95)<200'],
    // 전체 실패율 1% 미만
    http_req_failed: ['rate<0.01'],
  },
};

// ── 커스텀 지표 ──────────────────────────────────────────────────────────────
const orderbookReadDuration = new Trend('orderbook_read_duration_ms');
const orderbookFailRate     = new Rate('orderbook_fail_rate');
const totalReads            = new Counter('total_orderbook_reads');

// 테스트할 아이템 ID (1: 금석, 2: 금괴석, 3: 금 드릴)
const ITEM_IDS = [1, 2, 3];

// ── setup(): 테스트 시작 전 1회 실행 ─────────────────────────────────────────
export function setup() {
  console.log(`${config.label} 호가창 부하 테스트 시작 — baseUrl: ${config.baseUrl}`);

  // WRITE 테스트용 JWT 토큰 (없으면 READ만 실행)
  const token = __ENV.TOKEN || null;
  if (token) {
    console.log('JWT 토큰 감지됨 — 주문 생성 WRITE 테스트도 포함합니다.');
  } else {
    console.log('TOKEN 환경변수 없음 — 호가창 READ 테스트만 실행합니다.');
    console.log('WRITE 포함: k6 run -e TOKEN=<JWT> tests/orderbook.js');
  }

  return { baseUrl: config.baseUrl, token };
}

// ── default(): 각 VU(가상 사용자)가 반복 실행 ────────────────────────────────
export default function ({ baseUrl, token }) {
  // VU별로 아이템 ID를 분산시켜 한 아이템에 몰리지 않게 함
  const itemId = ITEM_IDS[__VU % ITEM_IDS.length];

  // ── [1] 호가창 READ 테스트 (항상 실행) ──────────────────────────────────
  const readRes = http.get(
    `${baseUrl}/market/orderbooks?item_id=${itemId}`,
    { tags: { name: 'orderbook_read' } }
  );

  orderbookReadDuration.add(readRes.timings.duration);
  totalReads.add(1);

  const readOk = check(readRes, {
    '호가창 조회 200':         (r) => r.status === 200,
    '호가창 데이터 존재':       (r) => {
      try {
        const body = JSON.parse(r.body);
        // data 필드가 있으면 성공 (비어있어도 OK — 주문이 없는 정상 상태)
        return body?.data !== undefined;
      } catch {
        return false;
      }
    },
    '현재가 필드 포함':         (r) => {
      try {
        return JSON.parse(r.body)?.data?.currentPrice !== undefined;
      } catch {
        return false;
      }
    },
  });

  orderbookFailRate.add(!readOk);

  if (!readOk) {
    console.error(`[READ FAIL] VU=${__VU} item=${itemId} status=${readRes.status} body=${readRes.body}`);
  }

  sleep(0.5); // 0.5초 대기 (실제 프론트는 1~2초 폴링)

  // ── [2] 주문 생성 WRITE 테스트 (TOKEN 있을 때만 실행) ──────────────────
  if (token) {
    // 매수 주문: 매우 낮은 가격으로 넣어 즉시 체결 안 되게 함
    // → Redis 호가창에 쌓임 → MatchingService가 100ms마다 처리
    const orderBody = JSON.stringify({
      itemId:        itemId,
      orderType:     'BUY',
      price:         1,    // 극단적으로 낮은 가격 → 체결 안 됨 → 호가창에만 쌓임
      totalQuantity: 1,
    });

    const writeRes = http.post(
      `${baseUrl}/market/orders`,
      orderBody,
      {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'order_create' },
      }
    );

    check(writeRes, {
      '주문 생성 200': (r) => r.status === 200,
    });

    if (writeRes.status !== 200) {
      console.warn(`[WRITE] VU=${__VU} status=${writeRes.status} — 자산 부족 또는 회사 미생성일 수 있음`);
    }

    sleep(1);
  }
}

// ── teardown(): 테스트 종료 후 1회 실행 ──────────────────────────────────────
export function teardown({ token }) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('호가창 부하 테스트 완료.');

  if (token) {
    console.log('');
    console.log('⚠️  WRITE 테스트 실행됨 — 미체결 주문이 DB/Redis에 남아있을 수 있습니다.');
    console.log('아래 명령으로 Redis 호가창을 확인하세요:');
    console.log('');
    console.log('  docker exec -it redis redis-cli');
    console.log('  > KEYS orderbook:*');
    console.log('  > ZCARD orderbook:BUY:1   ← 아이템1 매수 주문 수');
    console.log('');
    console.log('DB 미체결 주문 정리 (테스트 계정 company_id 확인 후):');
    console.log('  docker exec -it postgres-db psql -U ecosim -d ecosim \\');
    console.log('    -c "DELETE FROM market_orders WHERE status = \'PENDING\' AND price = 1;"');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
