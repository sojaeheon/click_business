#!/bin/bash

# ==============================================================================
# SSAFY S14P21B109 Integrated Infrastructure Startup Script
# (Supports fresh Ubuntu/WSL/EC2)
# ==============================================================================

set -e # 오류 발생 시 즉시 중단

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

# Kind (Kubernetes in Docker) 설치 확인
if ! [ -x "$(command -v kind)" ]; then
    echo "📦 Kind를 설치합니다..."
    [ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
    echo "✅ Kind 설치 완료."
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
if ! kind get clusters | grep -q "kind"; then
    echo "🚀 Kind 클러스터를 생성 중입니다 (약 1~2분 소요)..."
    kind create cluster --name kind
else
    echo "✅ 이미 실행 중인 Kind 클러스터가 있습니다."
fi

# Jenkins 컨테이너가 K8s API 서버에 접속할 수 있도록 내부 IP 추출 및 Kubeconfig 수정
KUBECONFIG_RAW=$(kind get kubeconfig --name kind)
KIND_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' kind-control-plane)

# Kubeconfig 내의 127.0.0.1:PORT 주소를 컨테이너 간 통신이 가능한 KIND_IP:6443으로 치환
# (내부 통신 시에는 항상 6443 포트를 사용해야 함)
KUBECONFIG_ADJUSTED=$(echo "$KUBECONFIG_RAW" | sed -E "s|https://127.0.0.1:[0-9]+|https://$KIND_IP:6443|g")

echo "📂 [3/5] 설정 파일(.env) 업데이트 중..."

if [ ! -f .env ]; then
    echo "⚠️ .env 파일이 없습니다. 기본 템플릿을 생성합니다."
    cp .env.example .env 2>/dev/null || touch .env
fi

# .env 파일에서 지저분한 K8S 설정 제거 (이제 export로 넘깁니다)
sed -i '/KUBECONFIG_CONTENT=/d' .env 2>/dev/null || true
# 혹시 .env 내부에 남아있을 수 있는 줄바꿈 찌꺼기들 제거 (경고 방지)
# 변수 이름이 아닌 clusters:, contexts: 등으로 시작하는 라인들 삭제
sed -i '/^clusters:/d' .env 2>/dev/null || true
sed -i '/^contexts:/d' .env 2>/dev/null || true
sed -i '/^users:/d' .env 2>/dev/null || true
sed -i '/^  /d' .env 2>/dev/null || true

# 변수를 메모리에 올림 (Docker Compose가 이걸 읽어갑니다)
export KUBECONFIG_CONTENT="$KUBECONFIG_ADJUSTED"

# ngrok 토큰 확인 경고
if grep -q "your_ngrok_authtoken_here" .env; then
    echo "⚠️  잠시만요! .env 파일에 NGROK_AUTHTOKEN을 아직 넣지 않으셨나요?"
    echo "👉 https://dashboard.ngrok.com/get-started/your-authtoken 에서 토큰을 확인하세요."
fi

# 사용할 Docker Compose 명령어 확인 (docker compose vs docker-compose)
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    DOCKER_COMPOSE_CMD="docker-compose"
fi

echo "🚀 [4/5] Jenkins 및 ngrok 실행 중 (사용 명령어: $DOCKER_COMPOSE_CMD)..."

# 기존에 엉킨 컨테이너가 있다면 강제 종료 및 삭제
$DOCKER_COMPOSE_CMD down || true

# 이미지가 없을 때만 빌드하고 실행 (매번 빌드 방지)
$DOCKER_COMPOSE_CMD up -d

echo "⏳ 외부 주소 할당 대기 중 (최대 30초)..."
NGROK_URL=""
for i in {1..15}; do
    # Python을 이용한 안정적인 JSON 파싱
    RAW_JSON=$(curl -s http://localhost:4040/api/tunnels || echo "{}")
    NGROK_URL=$(echo "$RAW_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url']) if data.get('tunnels') else print('')" 2>/dev/null || echo "")
    
    if [ ! -z "$NGROK_URL" ]; then
        break
    fi
    echo "...대기 중 ($i/15)"
    sleep 2
done

if [ -z "$NGROK_URL" ]; then
    echo "❌ [주의] ngrok URL을 자동으로 가져오지 못했습니다."
    echo "👉 원인 1: NGROK_AUTHTOKEN이 유효하지 않음"
    echo "👉 원인 2: ngrok 서버 연결 지연"
    echo "🔍 로그 확인 명령어: docker logs s14p21b109-ngrok-1"
    echo "🌐 직접 확인: http://localhost:4040/status"
else
    echo "✅ [5/5] 모든 인프라 구축 완료!"
    echo "===================================================="
    echo "🌐 Jenkins Local: http://localhost:8080"
    echo "🌐 Jenkins Public: $NGROK_URL"
    echo "☸️ Kubernetes: 실행 중 (Kind)"
    echo ""
    echo "📢 GitLab Webhook 등록 주소:"
    echo "$NGROK_URL/project/S14P21B109-Practice-Pipeline"
    echo "===================================================="
fi

# 설정 변경사항 Jenkins에 즉시 반영
if [ ! -z "$NGROK_URL" ]; then
    source .env
    # JCasC 설정 리로드 시도 (네트워크 준비 시간에 따라 실패할 수 있음)
    curl -s -X POST "http://localhost:8080/configuration-as-code/reload" -u "$JENKINS_ADMIN_ID:$JENKINS_ADMIN_PASSWORD" || echo "💡 Jenkins 웹페이지 준비 중... 약 1분 뒤 자동 설정이 완료됩니다."
fi
