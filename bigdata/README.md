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
