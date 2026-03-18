# k6 부하 테스트

## 폴더 구조

```
k6-tests/
├── tests/
│   ├── smoke.js    # Smoke:  VU 1명, 30초 — 기본 동작 확인
│   ├── load.js     # Load:   VU 20명, 5분  — 예상 트래픽 검증
│   └── stress.js   # Stress: VU 150명까지  — 한계점 탐색
├── config/
│   ├── options.js      # 테스트 종류별 k6 옵션 (vus, stages, thresholds)
│   └── environments.js # 환경별 base URL (local / ec2)
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

k6-tests 폴더 안에서 실행합니다.

```bash
cd k6-tests

# Smoke Test (기본 동작 확인)
k6 run tests/smoke.js

# Load Test (예상 부하 검증)
k6 run tests/load.js

# Stress Test (한계 탐색)
k6 run tests/stress.js

# EC2 환경으로 실행
k6 run -e ENV=ec2 tests/smoke.js
```

---

## 테스트 후 DB 정리

게스트 로그인 시 DB에 유저 레코드가 생성됩니다. 테스트 후 반드시 정리하세요.

```bash
docker exec -it postgres-db psql -U ecosim -d ecosim \
  -c "DELETE FROM users WHERE is_guest = true;"
```

---

## 결과 해석

```
http_req_duration ← 가장 중요한 지표
  avg=120ms         평균 응답시간
  p(90)=350ms       상위 10% 느린 요청
  p(95)=480ms       SLA 기준으로 주로 사용
  max=2100ms        최악의 경우

http_req_failed   ← 실패율 (0.00%가 목표)
vus               ← 현재 동시 접속자 수
guest_login_duration_ms ← 커스텀 지표 (로그인만 측정)
```

### thresholds 합격 기준

| 테스트   | p(95) 응답시간 | 실패율  |
|--------|------------|-------|
| Smoke  | 500ms 이내  | 1% 미만 |
| Load   | 500ms 이내  | 1% 미만 |
| Stress | 2000ms 이내 | 5% 미만 |

기준을 초과하면 k6가 exit code 99로 종료됩니다 (CI에서 실패 처리 가능).
