# Kafka 초기 설정 (ZooKeeper 기반)

## 개요
현재 프로젝트에서는 **ZooKeeper 기반 Kafka 단일 브로커 구성**으로 Kafka를 초기 설정하였다.  
이 구성은 **개발 환경에서 Kafka Producer / Consumer 연결 테스트와 기본 메시지 흐름 검증**을 목적으로 한다.

---

## 구성 요소

| 구성 요소 | 설명 | 포트 |
|---|---|---|
| ZooKeeper | Kafka 클러스터 메타데이터 관리 | 2181 |
| Kafka Broker | 메시지 저장 및 전달 | 9092 |

---


# 추후 확장
- 브로커 3개로 확장 시 도커 컴포즈 yml 파일
```
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    container_name: zookeeper
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - ecosim-network

  kafka1:
    image: confluentinc/cp-kafka:7.6.0
    container_name: kafka1
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka1:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 2
    networks:
      - ecosim-network

  kafka2:
    image: confluentinc/cp-kafka:7.6.0
    container_name: kafka2
    depends_on:
      - zookeeper
    ports:
      - "9093:9092"
    environment:
      KAFKA_BROKER_ID: 2
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka2:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 2
    networks:
      - ecosim-network

  kafka3:
    image: confluentinc/cp-kafka:7.6.0
    container_name: kafka3
    depends_on:
      - zookeeper
    ports:
      - "9094:9092"
    environment:
      KAFKA_BROKER_ID: 3
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka3:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 2
    networks:
      - ecosim-network

networks:
  ecosim-network:
    driver: bridge
```