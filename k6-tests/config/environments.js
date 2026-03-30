/**
 * 환경별 Base URL 설정
 *
 * 실행 시 환경변수로 선택:
 *   k6 run -e ENV=local tests/smoke.js
 *   k6 run -e ENV=ec2   tests/smoke.js
 */
const ENV = __ENV.ENV || 'local';

const environments = {
  local: {
    baseUrl: 'http://localhost:8000/api/v1',
    label: '[LOCAL]',
  },
  ec2: {
    baseUrl: 'http://your-ec2-ip/api/v1', // EC2 IP로 교체
    label: '[EC2]',
  },
};

export const config = environments[ENV] ?? environments['local'];
