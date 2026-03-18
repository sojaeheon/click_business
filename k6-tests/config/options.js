/**
 * 테스트 종류별 공통 k6 옵션 모음
 *
 * 각 테스트 파일에서 import해서 사용:
 *   import { smokeOptions } from '../config/options.js';
 *   export const options = smokeOptions;
 */

/** Smoke Test — "일단 되긴 하는가?" (VU 1명, 30초) */
export const smokeOptions = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // 실패율 1% 미만
    http_req_duration: ['p(95)<500'],   // 95%가 500ms 이내
  },
};

/** Load Test — "예상 트래픽을 버티는가?" (점진적 증가 → 유지 → 감소) */
export const loadOptions = {
  stages: [
    { duration: '1m',  target: 20 }, // 1분에 걸쳐 20명으로 증가
    { duration: '3m',  target: 20 }, // 3분 유지
    { duration: '1m',  target: 0  }, // 감소
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

/** Stress Test — "한계가 어디인가?" (계속 올려서 언제 망가지나 확인) */
export const stressOptions = {
  stages: [
    { duration: '1m',  target: 20  },
    { duration: '1m',  target: 50  },
    { duration: '1m',  target: 100 },
    { duration: '1m',  target: 150 },
    { duration: '1m',  target: 0   }, // 복구 확인
  ],
  thresholds: {
    http_req_failed:   ['rate<0.05'],   // stress는 기준 완화 (5%)
    http_req_duration: ['p(95)<2000'],  // 2초 이내
  },
};
