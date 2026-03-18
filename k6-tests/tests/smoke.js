/**
 * Smoke Test — 게스트 로그인
 *
 * 목적: 배포 직후 "기본 동작이 되는가?" 확인 (VU 1명, 30초)
 * 실행: k6 run tests/smoke.js
 *       k6 run -e ENV=ec2 tests/smoke.js
 *
 * 주의: 실행 시 DB에 게스트 유저가 생성됩니다.
 *       테스트 후 teardown 로그의 SQL을 실행하여 정리하세요.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { smokeOptions } from '../config/options.js';
import { config } from '../config/environments.js';

export const options = smokeOptions;

// ── setup(): 테스트 시작 전 1회 실행 ──────────────────────────────────────
export function setup() {
  console.log(`${config.label} 테스트 시작 — baseUrl: ${config.baseUrl}`);
  return { baseUrl: config.baseUrl };
}

// ── default(): 각 VU(가상 사용자)가 반복 실행하는 함수 ───────────────────
export default function ({ baseUrl }) {
  // Step 1: 게스트 로그인 요청
  const res = http.post(`${baseUrl}/users/guest`, null, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'guest_login' }, // 결과에서 이 이름으로 필터링 가능
  });

  // Step 2: 응답 검증
  const ok = check(res, {
    '상태코드 200':  (r) => r.status === 200,
    '토큰 발급됨':   (r) => {
      try {
        return JSON.parse(r.body)?.data?.accessToken !== undefined;
      } catch {
        return false;
      }
    },
    '게스트 플래그': (r) => {
      try {
        return JSON.parse(r.body)?.data?.isGuest === true;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[FAIL] status=${res.status} body=${res.body}`);
  }

  sleep(1); // 실제 사용자처럼 1초 대기 후 다음 반복
}

// ── teardown(): 테스트 종료 후 1회 실행 ──────────────────────────────────
export function teardown({ baseUrl }) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('테스트 완료. 아래 명령으로 DB를 정리하세요:');
  console.log('');
  console.log('  docker exec -it postgres-db psql -U ecosim -d ecosim \\');
  console.log('    -c "DELETE FROM users WHERE is_guest = true;"');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
