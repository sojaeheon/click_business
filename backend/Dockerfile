# 1. 빌드 스테이지 (Build Stage)
FROM eclipse-temurin:25-jdk-alpine AS builder

WORKDIR /app

# Gradle 래퍼와 설정 파일들을 먼저 복사 (캐시 활용)
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .

# 소스코드 복사
COPY src src

# 파일 권한 부여 후 빌드 (테스트 제외)
RUN chmod +x ./gradlew
RUN ./gradlew build -x test

# 2. 실행 스테이지 (Run Stage)
FROM eclipse-temurin:25-jdk-alpine

WORKDIR /app

# 빌드 스테이지에서 생성된 jar 파일을 복사
COPY --from=builder /app/build/libs/*.jar app.jar

# 프로파일 설정 등 환경 변수를 받아서 Java 애플리케이션 실행
ENTRYPOINT ["java", "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}", "-jar", "app.jar"]

# 운영 포트 노출
EXPOSE 8000
