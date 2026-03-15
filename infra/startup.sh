#!/bin/bash

# ==============================================================================
# SSAFY S14P21B109 Integrated Infrastructure Startup Script
# (Supports fresh Ubuntu/WSL/EC2)
# ==============================================================================

set -e # 오류 발생 시 즉시 중단

# 스크립트 위치 기준으로 레포 루트 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔍 [1/5] 필수 도구 설치 확인 및 설치 시작..."

# Docker 설치 확인
if ! [ -x "$(command -v docker)" ]; then
    echo "📦 Docker를 설치합니다..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker 설치 완료. (주의: 권한 적용을 위해 재접속이 필요할 수 있습니다)"
fi


# Kubectl 설치 확인
if ! [ -x "$(command -v kubectl)" ]; then
    echo "📦 Kubectl을 설치합니다..."
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/
    echo "✅ Kubectl 설치 완료."
fi

echo "☸️ [2/5] 로컬 Kubernetes 클러스터 준비..."

# Kind 클러스터 생성 (이미 있으면 스킵)
if ! sudo kind get clusters | grep -q "kind"; then
    echo "🚀 Kind 클러스터를 생성 중입니다 (약 1~2분 소요)..."
    sudo kind create cluster --name kind
else
    echo "✅ 이미 실행 중인 Kind 클러스터가 있습니다."
fi

# Jenkins 컨테이너가 K8s API 서버에 접속할 수 있도록 내부 IP 추출 및 Kubeconfig 수정
KUBECONFIG_RAW=$(sudo kind get kubeconfig --name kind)
KIND_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' kind-control-plane)

# Kubeconfig 내의 127.0.0.1:PORT 주소를 컨테이너 간 통신이 가능한 KIND_IP:6443으로 치환
KUBECONFIG_ADJUSTED=$(echo "$KUBECONFIG_RAW" | sed -E "s|https://127.0.0.1:[0-9]+|https://$KIND_IP:6443|g")

echo "📂 [3/5] 설정 파일(.env) 업데이트 중..."

if [ ! -f .env ]; then
    echo "⚠️ .env 파일이 없습니다. 필수 변수를 포함한 기본 템플릿을 생성합니다."
    cat <<EOF > .env
JENKINS_ADMIN_ID=admin
JENKINS_ADMIN_PASSWORD=admin
GITLAB_USERNAME=your_username
GITLAB_TOKEN=your_token
GITLAB_WEBHOOK_TOKEN=your_webhook_token
DOCKER_HUB_ID=your_docker_hub_id
DOCKER_HUB_PASSWORD=your_docker_hub_password
MM_WEBHOOK_URL=your_mattermost_webhook_url
EOF
    echo "❗ .env 파일에 실제 값을 채워주세요. (현재는 기본값으로 설정됨)"
fi

# 퍼블릭 IP 감지 (EC2 IMDSv2 우선, 실패 시 외부 API 사용)
echo "🔍 EC2 퍼블릭 IP를 감지하는 중..."
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)

if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s ifconfig.me || curl -s checkip.amazonaws.com)
fi

if [ -z "$PUBLIC_IP" ]; then
    echo "❌ [주의] 퍼블릭 IP를 자동으로 가져오지 못했습니다. localhost를 사용합니다."
    PUBLIC_IP="localhost"
else
    echo "✅ 감지된 퍼블릭 IP: $PUBLIC_IP"
fi

# .env 파일 업데이트 (YAML 잔재 및 잘못된 설정 제거)
sed -i '/JENKINS_URL=/d' .env
echo "JENKINS_URL=http://$PUBLIC_IP/jenkins" >> .env
sed -i '/KUBECONFIG_CONTENT\|clusters:\|contexts:\|users:\|current-context:\|kind:\|apiVersion:/d' .env 2>/dev/null || true
# 공백으로 시작하는 라인(YAML 인덴트) 삭제
sed -i '/^[[:space:]]\+/d' .env 2>/dev/null || true
# 빈 줄 정리
sed -i '/^$/d' .env 2>/dev/null || true
echo "" >> .env

# 변수를 현재 셸에 export — docker compose가 상위 환경변수를 자동으로 상속받음
# (멀티라인 YAML이라 .env에 직접 저장 불가)
export KUBECONFIG_CONTENT="$KUBECONFIG_ADJUSTED"

# 사용할 Docker Compose 명령어 확인
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    DOCKER_COMPOSE_CMD="docker-compose"
fi

echo "📥 [4/6] 최신 코드 Pull 중..."
git -C "$REPO_ROOT" pull
echo "✅ 코드 Pull 완료"

echo "🚀 [5/6] Jenkins 실행 중 (사용 명령어: $DOCKER_COMPOSE_CMD)..."

# 기존 컨테이너 강제 제거 (이름 충돌 방지)
docker rm -f nginx-router jenkins 2>/dev/null || true
# 혹시 남은 것들도 정리
$DOCKER_COMPOSE_CMD -f compose.yaml down --remove-orphans --timeout 10 2>/dev/null || true
# 최신 코드로 재빌드 및 실행
$DOCKER_COMPOSE_CMD -f compose.yaml up -d --build

echo "✅ [6/6] 모든 인프라 구축 완료!"
echo "===================================================="
echo "🌐 Jenkins 접속 주소: http://$PUBLIC_IP:8080"
echo " (참고: 나중에 Nginx 설정을 통해 80/443 포트로 접속 가능하게 변경될 예정입니다.)"
echo "☸️ Kubernetes: 실행 중 (Kind)"
echo ""
echo "📢 GitLab Webhook 등록 주소 (Nginx 설정 전 임시):"
echo "http://$PUBLIC_IP:8080/project/S14P21B109-Practice-Pipeline"
echo "===================================================="

# 설정 변경사항 Jenkins에 즉시 반영 시도
if [ -f .env ]; then
    . .env
    # JCasC 설정 리로드 (네트워크 준비 시간에 따라 실패할 수 있음)
    sleep 5
    curl -s -X POST "http://localhost:8080/jenkins/configuration-as-code/reload" -u "$JENKINS_ADMIN_ID:$JENKINS_ADMIN_PASSWORD" || echo "💡 Jenkins 웹페이지 준비 중... 약 1분 뒤 자동 설정이 완료됩니다."
fi
