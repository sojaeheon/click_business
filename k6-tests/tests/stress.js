/**
 * Stress Test — 게스트 로그인
 *
 * 목적: VU를 계속 늘려서 서버가 언제, 어떻게 망가지는지 확인
 *       → 병목 구간(DB 커넥션 풀, JVM 힙, 응답시간 급증 시점) 파악
 *
 * 실행: k6 run tests/stress.js
 *
 * 단계:
 *   0~1분:  0  → 20명
 *   1~2분:  20 → 50명
 *   2~3분:  50 → 100명
 *   3~4분:  100 → 150명  ← 여기서 에러 급증 여부 확인
 *   4~5분:  150 → 0명   ← 복구되는가? 확인
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { stressOptions } from '../config/options.js';
import { config } from '../config/environments.js';

export const options = stressOptions;

const loginDuration = new Trend('guest_login_duration_ms');
const failRate      = new Rate('guest_login_fail_rate');

export function setup() {
  console.log(`${config.label} Stress Test 시작 — baseUrl: ${config.baseUrl}`);
  return { baseUrl: config.baseUrl };
}

export default function ({ baseUrl }) {
  const start = Date.now();

  const res = http.post(`${baseUrl}/users/guest`, null, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'guest_login' },
    timeout: '10s', // stress 상황에서는 타임아웃을 여유있게
  });

  loginDuration.add(Date.now() - start);

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

  failRate.add(!ok);

  // stress test에서는 VU 번호와 반복 횟수도 로깅 (어느 시점에 실패하는지 추적)
  if (!ok) {
    console.error(`[FAIL] VU=${__VU} iter=${__ITER} status=${res.status} duration=${Date.now() - start}ms`);
  }

  sleep(0.5); // stress test는 대기 짧게
}

export function teardown() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Stress Test 완료. DB 정리:');
  console.log('');
  console.log('  docker exec -it postgres-db psql -U ecosim -d ecosim \\');
  console.log('    -c "DELETE FROM users WHERE is_guest = true;"');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
