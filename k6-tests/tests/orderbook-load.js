/**
 * 호가창 Load Test
 *
 * 목적: 실제 사용자가 몰릴 때 호가창/매칭 파이프라인이 버티는가?
 *
 * 시나리오 구성 (가중치):
 *   70% — 호가창 폴링 (프론트가 1~2초마다 GET 호출하는 패턴 재현)
 *   20% — 차트 조회  (페이지 진입 시 초기 데이터 로딩)
 *   10% — 1분봉 캔들 조회
 *
 * 왜 주문 생성(POST)은 제외?
 *   → 주문은 실제 DB 자산을 차감 → 반복 실행 시 자산 소진
 *   → 봇(BotOrderScheduler)이 이미 주문을 계속 넣고 있으므로
 *     매칭 서비스는 자동으로 부하를 받음
 *
 * 단계:
 *   0~1분:  0  → 20명 (ramp-up)
 *   1~4분:  20명 유지  (steady state — 실제 동시 접속 시뮬레이션)
 *   4~5분:  20 → 0명  (ramp-down)
 *
 * 실행:
 *   k6 run tests/orderbook-load.js
 *   k6 run -e ENV=ec2 tests/orderbook-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { config } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '30s',  target: 100 },
    { duration: '1m',  target: 100 },
    { duration: '1m',  target: 0  },
  ],
  thresholds: {
    // 호가창 조회: Redis 기반이므로 빨라야 함
    'http_req_duration{name:orderbook_read}': ['p(95)<700', 'p(99)<1500'],  // Redis N+1 구조 반영
    // 차트 조회
    'http_req_duration{name:chart_read}':     ['p(95)<300'],
    // 전체 실패율
    http_req_failed: ['rate<0.01'],
  },
};

// ── 커스텀 지표 ──────────────────────────────────────────────────────────────
const orderbookDuration = new Trend('orderbook_read_duration_ms');
const chartDuration     = new Trend('chart_read_duration_ms');
const failRate          = new Rate('orderbook_fail_rate');
const totalReads        = new Counter('total_orderbook_reads');

const ITEM_IDS = [1, 2, 3];

export function setup() {
  console.log(`${config.label} 호가창 Load Test 시작 — ${config.baseUrl}`);
  return { baseUrl: config.baseUrl };
}

export default function ({ baseUrl }) {
  // VU 번호 기반으로 아이템 분산 (한 아이템에 몰리지 않게)
  const itemId = ITEM_IDS[(__VU - 1) % ITEM_IDS.length];

  // 가중치 랜덤 시나리오 선택
  const roll = Math.random();

  if (roll < 0.70) {
    // ── 시나리오 A: 호가창 폴링 (70%) ────────────────────────────────────
    const res = http.get(
      `${baseUrl}/market/orderbooks?item_id=${itemId}`,
      { tags: { name: 'orderbook_read' } }
    );

    orderbookDuration.add(res.timings.duration);
    totalReads.add(1);

    const ok = check(res, {
      '[호가창] 200':             (r) => r.status === 200,
      '[호가창] currentPrice 존재': (r) => {
        try { return JSON.parse(r.body)?.data?.currentPrice !== undefined; }
        catch { return false; }
      },
      '[호가창] 응답 200ms 이내':  (r) => r.timings.duration < 200,
    });

    failRate.add(!ok);

    if (!ok) {
      console.error(`[FAIL] 호가창 VU=${__VU} item=${itemId} status=${res.status} duration=${res.timings.duration}ms`);
    }

    // 실제 프론트엔드 폴링 주기 재현 (1~2초)
    sleep(1 + Math.random());

  } else if (roll < 0.90) {
    // ── 시나리오 B: 실시간 차트 조회 (20%) ──────────────────────────────
    const res = http.get(
      `${baseUrl}/market/chart?item_id=${itemId}`,
      { tags: { name: 'chart_read' } }
    );

    chartDuration.add(res.timings.duration);

    check(res, {
      '[차트] 200': (r) => r.status === 200,
    });

    sleep(2);

  } else {
    // ── 시나리오 C: 1분봉 캔들 조회 (10%) ───────────────────────────────
    const res = http.get(
      `${baseUrl}/market/candles/1min?item_id=${itemId}&count=100`,
      { tags: { name: 'candle_read' } }
    );

    check(res, {
      '[캔들] 200': (r) => r.status === 200,
    });

    sleep(3);
  }
}

export function teardown() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Load Test 완료.');
  console.log('');
  console.log('주요 확인 지표:');
  console.log('  orderbook_read_duration_ms  — 호가창 조회 응답시간 분포');
  console.log('  orderbook_fail_rate         — 호가창 실패율');
  console.log('  total_orderbook_reads       — 총 호가창 조회 횟수');
  console.log('');
  console.log('서버 병목 확인:');
  console.log('  docker stats ecosim-backend  — CPU/메모리 사용량');
  console.log('  docker exec -it redis redis-cli info stats  — Redis 처리량');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
