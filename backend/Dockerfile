# Backend Dockerfile (Spring Boot Template)
FROM openjdk:21-jdk-slim
WORKDIR /app
# 빌드된 JAR 파일이 있다고 가정 (테스트용으로 touch 혹은 dummy)
RUN touch app.jar
CMD ["java", "-jar", "app.jar"]
