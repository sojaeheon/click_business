/**
 * Load Test — 게스트 로그인
 *
 * 목적: 예상 동시 사용자 20명이 몰릴 때 서버가 버티는가?
 * 실행: k6 run tests/load.js
 *       k6 run -e ENV=ec2 tests/load.js
 *
 * 단계:
 *   0~1분:  0명 → 20명 (ramp-up)
 *   1~4분:  20명 유지 (steady state)
 *   4~5분:  20명 → 0명 (ramp-down)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { loadOptions } from '../config/options.js';
import { config } from '../config/environments.js';

export const options = loadOptions;

// ── 커스텀 지표 정의 ────────────────────────────────────────────────────────
// Trend  : 시간 분포 (avg, p90, p95, max 등)
// Rate   : 비율 (성공/실패 %)
// Counter: 누적 카운트
const loginDuration = new Trend('guest_login_duration_ms');
const failRate      = new Rate('guest_login_fail_rate');
const totalLogins   = new Counter('total_guest_logins');

// ── setup() ─────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`${config.label} Load Test 시작 — baseUrl: ${config.baseUrl}`);
  return { baseUrl: config.baseUrl };
}

// ── default() ────────────────────────────────────────────────────────────────
export default function ({ baseUrl }) {
  const start = Date.now();

  const res = http.post(`${baseUrl}/users/guest`, null, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'guest_login' },
  });

  // 커스텀 지표에 값 기록
  loginDuration.add(Date.now() - start);
  totalLogins.add(1);

  const ok = check(res, {
    '상태코드 200': (r) => r.status === 200,
    '토큰 발급됨':  (r) => {
      try {
        return JSON.parse(r.body)?.data?.accessToken !== undefined;
      } catch {
        return false;
      }
    },
  });

  failRate.add(!ok); // 실패면 1, 성공이면 0 — Rate가 실패 비율을 계산

  if (!ok) {
    console.error(`[FAIL] VU=${__VU} iter=${__ITER} status=${res.status}`);
  }

  sleep(1);
}

// ── teardown() ───────────────────────────────────────────────────────────────
export function teardown() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Load Test 완료. DB 정리:');
  console.log('');
  console.log('  docker exec -it postgres-db psql -U ecosim -d ecosim \\');
  console.log('    -c "DELETE FROM users WHERE is_guest = true;"');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
