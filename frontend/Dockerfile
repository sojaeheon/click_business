# Frontend Dockerfile (React/Nginx Template)
FROM nginx:stable-alpine
# 빌드된 정적 파일이 있다고 가정
RUN echo "<h1>React App Placeholder</h1>" > /usr/share/nginx/html/index.html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
