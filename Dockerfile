FROM jenkins/jenkins:lts
USER root

# 1. Java 21 및 필수 도구 설치
RUN apt-get update && apt-get install -y \
    eclipse-temurin:21-jdk-alpine \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    gnupg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Docker CLI 및 kubectl 설치
RUN curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/
RUN usermod -aG docker jenkins

# 3. 젠킨스 플러그인 설치
RUN jenkins-plugin-cli --plugins \
    configuration-as-code \
    git \
    workflow-aggregator \
    matrix-auth \
    mattermost \
    job-dsl \
    gitlab-plugin \
    docker-workflow \
    kubernetes-cli \
    kubernetes
# Dockerfile 에 Git 권한 설정 추가 (매우 중요!)
RUN git config --global --add safe.directory '*'

USER jenkins