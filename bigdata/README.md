# BigData Module

이 폴더는 빅데이터 파이프라인 관련 코드를 모아둔 곳입니다.
데이터 수집, 처리, 저장, 분석까지 전체 흐름을 담당합니다.

## 디렉토리 구조

bigdata/
├── external_data/        # 외부 데이터 수집 및 저장
│   ├── collector/        # 크롤러 스크립트
│   │   ├── gold_crawler.py 
│   │   ├── interest_crawler.py
│   │   └── news_crawler.py
│   └── raw/              # 수집된 데이터  
│       ├── gold.csv
│       ├── interest.csv
│       └── news.csv
│
├── kafka/                   # Kafka (메시지 큐)
│   ├── producers/           # 데이터 생산
│   │   └── *_producer.py
│   ├── consumers/           # 데이터 소비
│   │   └── *_consumer.py
│   └── config.py            # Kafka 설정
│
├── spark/                   # Spark (집계 및 처리)
│   ├── jobs/
│   │   └──  *_metrics.py
│   ├── utils.py
│   └── spark_session.py     # Spark 세션 초기화
│
├── hdfs/                    # HDFS (데이터 레이크 저장소)
│   ├── raw/                 # 원본 데이터
│   ├── processed/           # 정제 데이터
│   └── analytics/           # 분석용 테이블
│
├── notebooks/               # 데이터 탐색 및 시각화
│   ├── *_analysis.ipynb
│   └── *_trends.ipynb
│
└── tests/                   # 단위 테스트, 통합 테스트
    ├── test_collector.py
    ├── test_kafka.py
    └── test_spark.py
    
## 데이터 흐름

1. 외부 데이터 수집 (crawler) : 금, 금리, 뉴스 등
2. Kafka로 이벤트 전송 (producers)
3. Spark로 배치 집계 및 분석 (jobs)
4. HDFS/데이터 레이크에 저장 (raw → processed → analytics)
5. 분석 결과는 backend/API를 통해 frontend에 제공

## 실행 방법

## 테스트

## 참고
- 환경 변수/설정: config/bigdata.yaml
- 데이터 샘플: data/raw/*.csv
- 추가 분석: notebooks/

---

# Big Data Infra Setup Plan

본 프로젝트는 빅데이터 분산 환경을 포함하므로, Kubernetes 상에 다음과 같은 인프라 구성을 추천합니다.

## 1. 후보 기술 스택
- **분산 처리:** Apache Spark (Spark-on-k8s)
- **메시징 브로커:** Apache Kafka (Strimzi Operator 추천)
- **데이터 저장:** Hadoop HDFS (Helm Chart) 또는 S3 호환 저장소 (MinIO)
- **워크플로우:** Apache Airflow

## 2. 테스트 가이드
현재 `Jenkinsfile`의 `Big Data Integration Test` 단계는 비어 있습니다. 향후 다음과 같은 명령어를 통해 인프라를 확장할 수 있습니다.

```bash
# Spark Operator 설치 예시
helm repo add spark-operator https://googlecloudplatform.github.io/spark-operator
helm install my-release spark-operator/spark-operator --namespace spark-operator --create-namespace
```

## 3. 리소스 관리
빅데이터 작업은 CPU와 Memory 소모가 큽니다. Jenkins 빌드 시 K8s Cluster의 Node 리소스가 충분한지 반드시 확인하십시오.

## 테스트용
수정 한 뒤 푸쉬용으로 사용
