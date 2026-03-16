#!/bin/bash
set -e

# 색깔을 넣어 가독성을 높여요 (OPIc 스타일의 센스! 😉)
GREEN='\033[0;32m'
NC='\033[0m' 

echo -e "${GREEN}🚀 K8s 배포 자동화를 시작합니다...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Kubeconfig 설정 업데이트
KIND_IP=$(docker inspect -f '{{.NetworkSettings.Networks.kind.IPAddress}}' kind-control-plane 2>/dev/null)
# 로컬(EC2)에서 접근 가능한 127.0.0.1 주소로 설정 파일을 업데이트합니다.
kind export kubeconfig --name kind

# 2. postgres-db, redis를 kind 네트워크에 연결 (이미 연결된 경우 스킵)
for container in postgres-db redis; do
    if ! docker network inspect kind | grep -q "\"$container\""; then
        echo "🔗 $container → kind 네트워크 연결 중..."
        docker network connect kind $container
    else
        echo "✅ $container 이미 kind 네트워크에 연결되어 있습니다."
    fi
done

# 3. 외부 서비스 IP 추출 및 검증 (kind 네트워크 기준 IP 사용)
POSTGRES_IP=$(docker inspect -f '{{.NetworkSettings.Networks.kind.IPAddress}}' postgres-db 2>/dev/null || true)
REDIS_IP=$(docker inspect -f '{{.NetworkSettings.Networks.kind.IPAddress}}' redis 2>/dev/null || true)

if [ -z "$POSTGRES_IP" ] || [ -z "$REDIS_IP" ]; then
    echo "❌ 에러: DB 또는 Redis 컨테이너가 실행 중이지 않습니다."
    exit 1
fi

# 4. 환경별 리소스 배포 (Top-down 방식 적용)
echo "📦 외부 서비스 엔드포인트 생성 중..."
sed -e "s/POSTGRES_IP/$POSTGRES_IP/g" -e "s/REDIS_IP/$REDIS_IP/g" \
    "$SCRIPT_DIR/k8s/external-services.yaml" > /tmp/ext-svc.yaml
kubectl apply -f /tmp/ext-svc.yaml

echo "🔐 시크릿 및 설정 적용..."
[ -f "$SCRIPT_DIR/k8s/secret.yaml" ] && kubectl apply -f "$SCRIPT_DIR/k8s/secret.yaml"

echo "🔧 Jenkins 서비스 엔드포인트 생성 중..."
JENKINS_IP=$(docker inspect -f '{{.NetworkSettings.Networks.kind.IPAddress}}' jenkins 2>/dev/null || true)
if [ -z "$JENKINS_IP" ]; then
    echo "⚠️ jenkins 컨테이너가 kind 네트워크에 없습니다. 연결 중..."
    docker network connect kind jenkins
    JENKINS_IP=$(docker inspect -f '{{.NetworkSettings.Networks.kind.IPAddress}}' jenkins)
fi
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: jenkins-service
spec:
  ports:
  - port: 8080
---
apiVersion: v1
kind: Endpoints
metadata:
  name: jenkins-service
subsets:
- addresses:
  - ip: $JENKINS_IP
  ports:
  - port: 8080
EOF

echo "🚀 애플리케이션(Deployment & Ingress) 배포..."
kubectl apply -f "$SCRIPT_DIR/k8s/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/k8s/ingress.yaml"

# 5. 상태 확인 (배포가 완료될 때까지 잠시 기다려주는 센스!)
echo "⏳ Pod가 준비될 때까지 대기 중..."
kubectl wait --for=condition=ready pod -l app=backend --timeout=60s || echo "⚠️ 백엔드가 뜨는 데 시간이 걸리네요."

echo -e "${GREEN}✅ 모든 배포가 완료되었습니다!${NC}"
kubectl get ingress