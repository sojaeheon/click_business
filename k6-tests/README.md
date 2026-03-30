# k6 부하 테스트

## 폴더 구조

```
k6-tests/
├── tests/
│   ├── smoke.js              # 게스트 로그인 Smoke (VU 1명, 30초)
│   ├── load.js               # 게스트 로그인 Load  (VU 20명, 5분)
│   ├── stress.js             # 게스트 로그인 Stress (VU 150명)
│   │
│   ├── orderbook-smoke.js    # 호가창 Smoke  — 기본 동작 확인
│   ├── orderbook-load.js     # 호가창 Load   — 예상 트래픽 (VU 20명, 5분)
│   ├── orderbook-stress.js   # 호가창 Stress — 한계 탐색 (VU 200명)
│   └── orderbook-ws.js       # 호가창 WebSocket — WS 전환 후 사용
│
├── config/
│   ├── options.js            # 테스트 옵션 (vus, stages, thresholds)
│   └── environments.js       # 환경별 base URL (local / ec2)
└── README.md
```

---

## 사전 준비

### 1. k6 설치
```bash
# Windows
winget install k6

# Mac
brew install k6
```

### 2. 로컬 인프라 실행
```bash
cd data
docker compose up -d
```

### 3. Spring Boot 실행
```bash
cd backend
./gradlew bootRun
# 또는 IntelliJ에서 Run
```

---

## 실행 방법

`k6-tests` 폴더 안에서 실행합니다.

```bash
cd k6-tests
```

### 게스트 로그인 테스트 (기존)
```bash
k6 run tests/smoke.js
k6 run tests/load.js
k6 run tests/stress.js
```

### 호가창 테스트 (인증 불필요 — 즉시 실행 가능)
```bash
# 기본 동작 확인 (30초)
k6 run tests/orderbook-smoke.js

# 예상 부하 검증 (5분, VU 20명)
k6 run tests/orderbook-load.js

# 한계 탐색 (5분, VU 최대 200명)
k6 run tests/orderbook-stress.js
```

### EC2 서버로 실행
```bash
k6 run -e ENV=ec2 tests/orderbook-smoke.js
k6 run -e ENV=ec2 tests/orderbook-load.js
k6 run -e ENV=ec2 tests/orderbook-stress.js
```

### WebSocket 호가창 테스트 (WS 전환 후 사용)
```bash
# JWT 토큰 없이 실행 (게스트 자동 발급)
k6 run tests/orderbook-ws.js

# 직접 발급한 토큰 사용
k6 run -e TOKEN=eyJhbGci... tests/orderbook-ws.js
```

---

## 테스트 대상 엔드포인트

| 엔드포인트 | 인증 | 테스트 파일 |
|---|---|---|
| `GET /api/v1/market/orderbooks?item_id={n}` | 불필요 | orderbook-smoke/load/stress.js |
| `GET /api/v1/market/chart?item_id={n}` | 불필요 | orderbook-load.js |
| `GET /api/v1/market/candles/1min?item_id={n}` | 불필요 | orderbook-load.js |
| `WS /ws-ecosim` STOMP | JWT 필요 | orderbook-ws.js |

---

## 결과 해석

```
── 기본 지표 ──────────────────────────────────────────────
http_req_duration
  avg=120ms     평균 응답시간
  p(95)=480ms   SLA 기준으로 주로 사용 (95%가 이 시간 이내)
  max=2100ms    최악의 경우

http_req_failed   실패율 (0.00%가 목표)
vus               현재 동시 접속자 수

── 호가창 커스텀 지표 ─────────────────────────────────────
orderbook_read_duration_ms   호가창 조회 응답시간
orderbook_fail_rate          호가창 실패율
total_orderbook_reads        총 조회 횟수
```

### thresholds 합격 기준

| 테스트 | p(95) | 실패율 |
|---|---|---|
| Smoke | 500ms | 1% 미만 |
| Load (호가창) | 200ms | 1% 미만 |
| Stress (호가창) | 2000ms | 10% 미만 |

기준 초과 시 k6가 exit code 99로 종료됩니다 (CI 실패 처리 가능).

---

## 테스트 후 DB 정리

smoke/ws 테스트는 게스트 계정을 생성합니다. 테스트 후 정리하세요.

```bash
docker exec -it postgres-db psql -U ecosim -d ecosim \
  -c "DELETE FROM users WHERE is_guest = true;"
```
