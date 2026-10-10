# 1. 빌드 스테이지 (Build Stage)
FROM node:20-alpine AS builder

WORKDIR /app

# package.json 먼저 복사해서 의존성 레이어 캐시 활용
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# 소스코드 복사 후 빌드
COPY . .
RUN npx vite build

# 2. 실행 스테이지 (Run Stage)
FROM nginx:stable-alpine

# Vite 빌드 결과물을 nginx 서빙 경로로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# API 프록시 + WebSocket 프록시 + React Router fallback
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    resolver 127.0.0.11 valid=10s ipv6=off;\n\
    set $backend_origin http://ecosim-backend:8000;\n\
\n\
    location /api {\n\
        proxy_pass $backend_origin$request_uri;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
\n\
    location /ws-ecosim {\n\
        proxy_pass $backend_origin$request_uri;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
