# 1. 빌드 스테이지 (Build Stage)
FROM node:20-alpine AS builder

WORKDIR /app

# package.json 먼저 복사해서 의존성 레이어 캐시 활용
COPY package*.json ./
RUN npm ci

# 소스코드 복사 후 빌드
COPY . .
RUN npm run build

# 2. 실행 스테이지 (Run Stage)
FROM nginx:stable-alpine

# Vite 빌드 결과물을 nginx 서빙 경로로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# React Router 사용 시 새로고침해도 index.html로 fallback되도록 설정
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
