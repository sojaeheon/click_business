/**
 * 호가창 Stress Test
 *
 * 목적: VU를 계속 늘려 "언제, 어떻게 망가지는가" 파악
 *       → Redis 커넥션 풀 한계, Spring 스레드 풀 고갈 시점 측정
 *
 * 단계:
 *   0~1분:  0  →  20명  (워밍업)
 *   1~2분:  20 →  50명
 *   2~3분:  50 → 100명
 *   3~4분: 100 → 200명  ← 이 구간에서 에러율/응답시간 급증 여부 확인
 *   4~5분: 200 →   0명  ← 복구 확인 (서버가 정상으로 돌아오는가?)
 *
 * 실행:
 *   k6 run tests/orderbook-stress.js
 *   k6 run -e ENV=ec2 tests/orderbook-stress.js
 *
 * 결과 해석:
 *   - p(95) 응답시간이 급증하는 VU 수 = 실질적 처리 한계
 *   - 에러율이 5%를 넘는 시점 = 서버 과부하 임계점
 *   - ramp-down 후 에러율이 복구되면 "일시적 과부하", 아니면 "서버 다운"
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { config } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '1m',  target: 20  },
    { duration: '1m',  target: 50  },
    { duration: '1m',  target: 100 },
    { duration: '1m',  target: 200 },
    { duration: '1m',  target: 0   },
  ],
  thresholds: {
    // stress는 기준 완화 (어느 시점에 무너지는지 보는 게 목적)
    'http_req_duration{name:orderbook_read}': ['p(95)<2000'],
    http_req_failed:                          ['rate<0.10'],  // 10% 이하면 pass
  },
};

// ── 커스텀 지표 ──────────────────────────────────────────────────────────────
const orderbookDuration = new Trend('orderbook_read_duration_ms');
const failRate          = new Rate('orderbook_fail_rate');
const totalReads        = new Counter('total_orderbook_reads');

const ITEM_IDS = [1, 2, 3];

export function setup() {
  console.log(`${config.label} 호가창 Stress Test 시작 — ${config.baseUrl}`);
  console.log('VU가 200명까지 증가합니다. 서버 모니터링을 준비하세요:');
  console.log('  docker stats ecosim-backend');
  return { baseUrl: config.baseUrl };
}

export default function ({ baseUrl }) {
  const itemId = ITEM_IDS[(__VU - 1) % ITEM_IDS.length];

  const res = http.get(
    `${baseUrl}/market/orderbooks?item_id=${itemId}`,
    {
      tags:    { name: 'orderbook_read' },
      timeout: '10s', // stress 상황에서 타임아웃 여유
    }
  );

  orderbookDuration.add(res.timings.duration);
  totalReads.add(1);

  const ok = check(res, {
    '상태코드 200':         (r) => r.status === 200,
    '응답 2000ms 이내':     (r) => r.timings.duration < 2000,
  });

  failRate.add(!ok);

  // VU 수와 응답시간을 함께 로깅 → 어느 VU 수에서 느려지는지 추적
  if (!ok || res.timings.duration > 500) {
    console.warn(
      `[VU=${__VU}] status=${res.status} duration=${Math.round(res.timings.duration)}ms item=${itemId}`
    );
  }

  sleep(0.5); // stress는 짧게 대기
}

export function teardown() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Stress Test 완료.');
  console.log('');
  console.log('분석 포인트:');
  console.log('  1. 응답시간이 급증하기 시작하는 VU 수는?');
  console.log('     → k6 결과의 http_req_duration 그래프 확인');
  console.log('');
  console.log('  2. 에러가 처음 발생한 VU 수는?');
  console.log('     → console 로그의 [VU=N] 라인 확인');
  console.log('');
  console.log('  3. ramp-down 후 서버가 복구되었는가?');
  console.log('     → 마지막 30초의 응답시간이 초기와 같으면 복구 성공');
  console.log('');
  console.log('서버 로그 확인:');
  console.log('  docker logs ecosim-backend --tail 100');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
