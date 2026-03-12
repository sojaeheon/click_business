````md
# HDFS 개발 환경 설정 (Docker 기반)

## 1. 개요

본 프로젝트에서는 **분산 데이터 저장소로 HDFS(Hadoop Distributed File System)** 를 사용한다.  
로컬 개발 환경에서는 **Docker Compose를 사용하여 최소 HDFS 클러스터(NameNode 1 + DataNode 1)** 를 구성하였다.

현재 구성은 다음 목적을 위한 **개발용 환경**이다.

- Kafka → Spark → HDFS 데이터 파이프라인 테스트
- 데이터 레이크 구조 검증
- Spark에서 HDFS 데이터 읽기/쓰기 테스트

HDFS는 **NameNode가 메타데이터를 관리하고 DataNode가 실제 데이터를 저장하는 구조**이다.

---

# 2. 아키텍처

```text
Kafka
  ↓
Spark
  ↓
HDFS
  ├ /data/raw
  ├ /data/processed
  └ /data/analytics
````

구성 요소

| 컴포넌트     | 역할            |
| -------- | ------------- |
| NameNode | HDFS 메타데이터 관리 |
| DataNode | 실제 데이터 블록 저장  |
| Spark    | 데이터 처리        |
| Kafka    | 데이터 스트리밍      |

---

# 3. 폴더 구조

```text
bigdata/
└── hdfs/
    ├── conf/
    │   ├── hadoop.env
    │   ├── core-site.xml
    │   └── hdfs-site.xml
    │
    ├── init/
    │   └── init-hdfs.sh
    │
    ├── storage/
    │   ├── namenode/
    │   └── datanode/
    │
    ├── sample-data/
    │   └── .gitkeep
    │
    └── README.md
```

### 폴더 설명

| 폴더          | 설명                       |
| ----------- | ------------------------ |
| conf        | Hadoop / HDFS 설정 파일      |
| init        | HDFS 초기 디렉터리 생성 스크립트     |
| storage     | Docker 바인드 마운트용 HDFS 저장소 |
| sample-data | HDFS 테스트용 데이터            |
| README.md   | HDFS 설정 문서               |

---

# 4. HDFS 데이터 레이크 구조

HDFS 내부에서는 다음 디렉터리 구조를 사용한다.

```text
/data
 ├ raw
 ├ processed
 └ analytics
```

### 설명

| 경로              | 설명        |
| --------------- | --------- |
| /data/raw       | 원본 데이터 저장 |
| /data/processed | 전처리 데이터   |
| /data/analytics | 분석용 데이터   |

---

# 5. Docker Compose 구성

HDFS는 다음 두 컨테이너로 구성된다.

| 서비스      | 설명            | 포트          |
| -------- | ------------- | ----------- |
| namenode | HDFS 메타데이터 관리 | 9870 / 9000 |
| datanode | 실제 데이터 저장     | 9864        |

### NameNode UI

```text
http://localhost:9870
```

HDFS 파일 시스템 상태를 확인할 수 있다.

---

# 6. Hadoop 설정

## hadoop.env

```env
CORE_CONF_fs_defaultFS=hdfs://namenode:9000
HDFS_CONF_dfs_replication=1
HDFS_CONF_dfs_permissions_enabled=false
HDFS_CONF_dfs_namenode_datanode_registration_ip___hostname___check=false
```

### 주요 설정

| 설정              | 설명         |
| --------------- | ---------- |
| fs.defaultFS    | 기본 HDFS 주소 |
| dfs.replication | 데이터 복제 수   |
| dfs.permissions | 권한 체크 여부   |

개발 환경에서는 DataNode가 1개이므로 replication을 1로 설정한다.

---

## core-site.xml

Hadoop 공통 설정 파일

```xml
<configuration>
  <property>
    <name>fs.defaultFS</name>
    <value>hdfs://namenode:9000</value>
  </property>
</configuration>
```

---

## hdfs-site.xml

HDFS 전용 설정

```xml
<configuration>

  <property>
    <name>dfs.replication</name>
    <value>1</value>
  </property>

  <property>
    <name>dfs.namenode.name.dir</name>
    <value>file:///hadoop/dfs/name</value>
  </property>

  <property>
    <name>dfs.datanode.data.dir</name>
    <value>file:///hadoop/dfs/data</value>
  </property>

</configuration>
```

---

# 7. HDFS 초기 디렉터리 생성

`init-hdfs.sh`

```bash
hdfs dfs -mkdir -p /data/raw
hdfs dfs -mkdir -p /data/processed
hdfs dfs -mkdir -p /data/analytics

hdfs dfs -chmod -R 777 /data
```

---

# 8. 실행 방법

### 1. HDFS 실행

```bash
docker compose up -d
```

---

### 2. NameNode 접속

```bash
docker exec -it namenode bash
```

---

### 3. HDFS 디렉터리 생성

```bash
bash /init/init-hdfs.sh
```

---

# 9. HDFS 테스트

### 디렉터리 확인

```bash
hdfs dfs -ls /
hdfs dfs -ls /data
```

---

### 파일 업로드

```bash
hdfs dfs -put /sample-data/gold.csv /data/raw/
```

---

### 파일 확인

```bash
hdfs dfs -ls /data/raw
hdfs dfs -cat /data/raw/gold.csv
```

---

# 10. Spark 접근 경로

Spark에서는 다음 HDFS 경로를 사용한다.

```text
hdfs://namenode:9000/data/raw
hdfs://namenode:9000/data/processed
hdfs://namenode:9000/data/analytics
```

---

# 11. 향후 확장

현재는 **개발용 단일 DataNode 환경**이다.

향후 확장 예정

* DataNode 추가
* replication factor 증가
* Kubernetes 환경 배포
* Spark Streaming 데이터 파이프라인 구축

```
```
