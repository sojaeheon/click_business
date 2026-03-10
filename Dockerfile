FROM jenkins/jenkins:lts
USER root

# 1. Java 21 및 필수 도구 설치
RUN apt-get update && apt-get install -y \
    openjdk-21-jdk \
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
# 4. Jenkins 초기 설정 마법사 비활성화 및 JCasC 경로 설정
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false -Dcasc.jenkins.config=/var/jenkins_home/jenkins.yaml"

USER jenkins