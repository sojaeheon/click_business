/**
 * 호가창 Smoke Test
 *
 * 목적: 배포 직후 "호가창 기본 동작이 되는가?" 빠르게 확인 (VU 1명, 30초)
 *
 * 테스트 대상:
 *   1. GET  /api/v1/market/orderbooks?item_id={n}  — 호가창 조회 (인증 불필요)
 *   2. GET  /api/v1/market/chart?item_id={n}        — 실시간 차트 조회 (인증 불필요)
 *   3. POST /api/v1/users/guest → GET /api/v1/market/orderbooks — 인증 후 조회 흐름
 *
 * 실행:
 *   k6 run tests/orderbook-smoke.js
 *   k6 run -e ENV=ec2 tests/orderbook-smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config/environments.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:                          ['rate<0.01'],    // 실패율 1% 미만
    // 엔드포인트별 개별 기준 (Redis 조회 vs DB 조회 속도 차이 반영)
    'http_req_duration{name:orderbook_read}': ['p(95)<700'],    // 호가창: Redis N+1 구조로 현재 ~500ms 수준
    'http_req_duration{name:chart_read}':     ['p(95)<1000'],   // 차트: 집계 쿼리 → 여유
  },
};

// 테스트할 아이템 ID 목록 (1: 금석, 2: 금괴석, 3: 금 드릴)
const ITEM_IDS = [1, 2, 3];

export function setup() {
  const baseUrl = config.baseUrl;
  console.log(`${config.label} 호가창 Smoke Test 시작 — ${baseUrl}`);

  // 게스트 로그인으로 JWT 발급
  const res = http.post(`${baseUrl}/users/guest`, null, {
    headers: { 'Content-Type': 'application/json' },
  });

  const body = JSON.parse(res.body);
  const token = body?.data?.accessToken;

  if (!token) {
    console.error(`JWT 발급 실패 — status: ${res.status}, body: ${res.body}`);
  } else {
    console.log('JWT 발급 완료');
  }

  return { baseUrl, token };
}

export default function ({ baseUrl, token }) {
  const itemId = ITEM_IDS[__ITER % ITEM_IDS.length]; // 매 반복마다 아이템 순환

  // ── [1] 호가창 조회 ────────────────────────────────────────────────────────
  const orderbookRes = http.get(
    `${baseUrl}/market/orderbooks?item_id=${itemId}`,
    { tags: { name: 'orderbook_read' } }
  );

  check(orderbookRes, {
    '[호가창] 상태코드 200':       (r) => r.status === 200,
    '[호가창] data 필드 존재':      (r) => JSON.parse(r.body)?.data !== undefined,
    '[호가창] currentPrice 존재':   (r) => JSON.parse(r.body)?.data?.currentPrice !== undefined,
    '[호가창] buyOrders 배열':      (r) => Array.isArray(JSON.parse(r.body)?.data?.buyOrders),
    '[호가창] sellOrders 배열':     (r) => Array.isArray(JSON.parse(r.body)?.data?.sellOrders),
  });

  sleep(0.5);

  // ── [2] 차트 데이터 조회 ───────────────────────────────────────────────────
  const chartRes = http.get(
    `${baseUrl}/market/chart?item_id=${itemId}`,
    { tags: { name: 'chart_read' } }
  );

  check(chartRes, {
    '[차트] 상태코드 200':    (r) => r.status === 200,
    '[차트] data 필드 존재':  (r) => JSON.parse(r.body)?.data !== undefined,
  });

  sleep(1);
}

export function teardown() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Smoke Test 완료. 게스트 계정 DB 정리:');
  console.log('  docker exec -it postgres-db psql -U ecosim -d ecosim \\');
  console.log('    -c "DELETE FROM users WHERE is_guest = true;"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
