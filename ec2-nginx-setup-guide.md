# EC2 Nginx 직접 설정 가이드

## 📋 개요
Docker를 사용하지 않고 EC2에 설치된 nginx를 직접 사용하여 CoreConnect 애플리케이션을 배포하는 방법입니다.

## 🔧 1단계: 프론트엔드 빌드

### 로컬에서 빌드 (Windows)
```bash
# 프로젝트 디렉토리로 이동
cd c:\dev\final_project_coreconnect\frontend

# 의존성 설치
npm install

# 프로덕션 빌드 (.env 파일 확인 후)
npm run build

# dist 폴더가 생성됨
```

## 📦 2단계: 빌드 파일을 EC2로 전송

### Windows에서 SCP 사용
```bash
# dist 폴더를 EC2로 전송
scp -i "your-key.pem" -r frontend/dist/* ubuntu@54.116.26.182:/tmp/frontend-dist/
```

### 또는 Git을 통한 전송
```bash
# 1. Git에 푸시 (로컬)
git add frontend/dist
git commit -m "Build frontend for production"
git push origin main

# 2. EC2에서 pull
ssh -i "your-key.pem" ubuntu@54.116.26.182
cd /path/to/final_project_coreconnect
git pull origin main
```

## 🌐 3단계: EC2 nginx 설정

### EC2 서버에서 실행

```bash
# EC2 SSH 접속
ssh -i "your-key.pem" ubuntu@54.116.26.182

# 프론트엔드 빌드 파일을 nginx 웹 루트로 복사
sudo mkdir -p /var/www/coreconnect
sudo cp -r /tmp/frontend-dist/* /var/www/coreconnect/

# 또는 Git에서 pull한 경우
sudo cp -r ~/final_project_coreconnect/frontend/dist/* /var/www/coreconnect/

# 권한 설정
sudo chown -R www-data:www-data /var/www/coreconnect
sudo chmod -R 755 /var/www/coreconnect
```

### nginx 설정 파일 생성

```bash
# CoreConnect용 nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/coreconnect
```

다음 내용을 입력:

```nginx
# CoreConnect Nginx Configuration
server {
    listen 80;
    server_name coreconnect.io.kr www.coreconnect.io.kr 54.116.26.182;

    # React 빌드 파일 경로
    root /var/www/coreconnect;
    index index.html;

    # 로그 설정
    access_log /var/log/nginx/coreconnect-access.log;
    error_log /var/log/nginx/coreconnect-error.log;

    # Gzip 압축
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # 정적 파일 캐싱
    location ~* \.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # React 라우팅 (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 백엔드 API 프록시
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_request_headers on;
        
        # 타임아웃
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Cookie' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Content-Length' '0' always;
            return 204;
        }
    }

    # WebSocket 프록시
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        
        # WebSocket 타임아웃
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/coreconnect;
        try_files $uri =404;
    }
}
```

### nginx 설정 활성화

```bash
# 기본 사이트 비활성화
sudo rm -f /etc/nginx/sites-enabled/default

# CoreConnect 사이트 활성화
sudo ln -s /etc/nginx/sites-available/coreconnect /etc/nginx/sites-enabled/

# 설정 테스트
sudo nginx -t

# nginx 재시작
sudo systemctl restart nginx

# 상태 확인
sudo systemctl status nginx
```

## 🚀 4단계: 백엔드 실행

### Docker로 백엔드만 실행

```bash
# 백엔드, Redis, MySQL만 실행
cd ~/final_project_coreconnect

# docker-compose에서 필요한 서비스만 실행
docker-compose up -d mysql-master mysql-slave1 mysql-slave2 \
                     redis-pubsub redis-session \
                     chat-app-1 chat-app-2 chat-app-3

# 확인
docker ps
curl http://localhost:8080/actuator/health
```

### 또는 JAR로 직접 실행

```bash
# Java 17 설치 확인
java -version

# 프로젝트 빌드
cd ~/final_project_coreconnect/backend
./gradlew build -x test

# 백그라운드 실행
nohup java -jar build/libs/*.jar \
  --spring.profiles.active=prod \
  --server.port=8080 > backend.log 2>&1 &

# 로그 확인
tail -f backend.log
```

## ✅ 5단계: 확인

```bash
# Health check
curl http://localhost/health

# API 테스트
curl http://localhost/api/v1/accounts/health

# 브라우저에서 접속
# http://coreconnect.io.kr
```

## 🔍 트러블슈팅

### 문제 1: nginx 403 Forbidden
```bash
# 권한 확인
ls -la /var/www/coreconnect

# 권한 수정
sudo chown -R www-data:www-data /var/www/coreconnect
sudo chmod -R 755 /var/www/coreconnect

# SELinux 확인 (CentOS/RHEL)
sudo setenforce 0
```

### 문제 2: 백엔드 연결 실패 (502 Bad Gateway)
```bash
# 백엔드가 8080 포트에서 실행 중인지 확인
curl http://localhost:8080/actuator/health

# 방화벽 확인
sudo ufw status
sudo ufw allow 8080/tcp

# 백엔드 로그 확인
docker logs chat-app-1
# 또는
tail -f backend.log
```

### 문제 3: React 라우팅 404 에러
```bash
# nginx 설정에 try_files가 있는지 확인
sudo nano /etc/nginx/sites-available/coreconnect

# location / {
#     try_files $uri $uri/ /index.html;
# }

# nginx 재시작
sudo systemctl restart nginx
```

## 📊 모니터링

```bash
# nginx 로그 확인
sudo tail -f /var/log/nginx/coreconnect-access.log
sudo tail -f /var/log/nginx/coreconnect-error.log

# nginx 상태
sudo systemctl status nginx

# 프로세스 확인
ps aux | grep nginx
ps aux | grep java
```

## 🔄 업데이트 방법

```bash
# 1. 프론트엔드 업데이트
cd ~/final_project_coreconnect
git pull origin main
cd frontend
npm run build
sudo cp -r dist/* /var/www/coreconnect/

# 2. 백엔드 업데이트
cd ~/final_project_coreconnect/backend
./gradlew build -x test
sudo systemctl restart backend  # 또는 docker-compose restart
```

## 🎯 결론

이 방법은 Docker를 최소한으로 사용하면서 EC2의 nginx를 직접 활용하는 방식입니다.

**장점:**
- EC2 nginx를 직접 제어 가능
- 리소스 사용량 감소
- 전통적인 배포 방식

**단점:**
- 수동 설정 필요
- 환경 일관성 낮음
- 확장성 제한

**권장:** 프로덕션 환경에서는 Docker Compose 방식을 추천합니다!




























