# 1. 빌드 스테이지
FROM node:22.12-alpine AS reactbuild
WORKDIR /website/frontend

# package.json, package-lock.json 파일 복사 후 패키지 설치
COPY package*.json ./
RUN npm ci

# frontend 전체 소스를 도커 내부로 복사한 뒤 빌드
COPY . .

# 빌드 타임 환경 변수 (ARG는 빌드 시점에만 사용 가능)
# 기본값은 배포 환경에서 nginx가 프록시하므로 상대 경로 사용
ARG VITE_API_BASE_URL=/api/v1/
ARG VITE_WS_BASE_URL=

# 환경 변수를 빌드 시점에 주입
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}

RUN npm run build

# 2. 배포 스테이지
FROM nginx:alpine

# 빌드 스테이지에서 생성한 디렉터리를 nginx 웹 서버에 배포하기
# 빌드 디렉터리는 CRA 앱은 build, Vite 앱은 dist
# CRA : COPY --from=reactbuild /website/frontend/build /usr/share/nginx/html
# Vite: COPY --from=reactbuild /website/frontend/dist /usr/share/nginx/html
COPY --from=reactbuild /website/frontend/dist /usr/share/nginx/html

# nginx.conf 파일을 nginx 웹 서버의 환경 설정 파일로 등록하기
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 아래 명령들은 생략 가능하지만 작성해 두는 것을 추천 (EXPOSE, CMD는 nginx:alpine 버전에 포함되어 있음)

# 포트 노출 (HTTP 포트 노출)
EXPOSE 80

# 실행 명령 (포그라운드 실행을 위해서 daemon off; 추가. 포그라운드 프로세스가 없으면 컨테이너가 즉시 종료되므로 필수 옵션)
CMD ["nginx", "-g", "daemon off;"]