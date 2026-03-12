  #!/bin/bash

  # 에러 시 스크립트 종료
  set -e

  # 환경변수 설정
  BOOTSTRAP=kafka:9092

  # Kafka Broker 준비 대기 (최대 20초)
  echo "Waiting for Kafka..."
  cub kafka-ready -b $BOOTSTRAP 1 20

  # Kafka Topic 생성
  echo "Creating topics..."
  /usr/bin/kafka-topics --create --if-not-exists \
    --bootstrap-server $BOOTSTRAP \
    --topic order.made \
    --partitions 3 \
    --replication-factor 1
  echo "Topic creation completed."

  # Kakfa Topic 조회
  echo "Current topics:"
  /usr/bin/kafka-topics --bootstrap-server $BOOTSTRAP --list