# 💼 CoreConnect

> **실시간 협업을 지원하는 그룹웨어 플랫폼**

---
## 📑 목차

- [프로젝트 소개](#프로젝트-소개)
- [주요 기능](#주요-기능-features)
- [프로젝트 구조](#프로젝트-구조-아키텍처)
- [기술 스택](#기술-스택-tech-stack)
- [환경설정 및 실행 방법](#환경설정-및-실행-방법-getting-started)
- [폴더 구조](#폴더-구조-directory-structure)
- [팀원](#팀원-contributors)
- [추가 자료](#추가-자료)
- [보안 고려사항](#보안-고려사항)
- [라이선스](#라이선스-license)
- [향후 계획](#향후-계획)
- [감사의 글](#감사의-글)

## 📖 프로젝트 소개

**CoreConnect**는 기업 내 업무 협업을 위한 통합 플랫폼입니다. 실시간 채팅, 이메일, 전자결재, 일정 관리 등 다양한 업무 기능을 하나의 시스템에서 제공하여 조직의 업무 효율성을 극대화합니다.

### 프로젝트 배경
- 기업 내부 소통의 비효율성 해소
- 여러 시스템을 오가며 발생하는 업무 손실 최소화
- 실시간 협업을 통한 의사결정 속도 향상

### 타겟 사용자
- 중소기업 및 스타트업
- 원격 근무가 필요한 조직
- 디지털 전환을 추진하는 기업

---

## ✨ 주요 기능 (Features)

### 💬 실시간 채팅
- **1:1 및 그룹 채팅** 지원
- **실시간 메시지 전송** (WebSocket 기반)
- **파일 첨부** 및 전송 기능
- **읽음/안읽음** 상태 관리

### 📧 이메일 시스템
- **내부 메일 시스템** 구축
- **예약 발송** 기능
- **임시보관함** 및 **중요 메일** 관리
- **파일 첨부** 및 다운로드
- **SendGrid API** 연동

### 🔔 실시간 알림
- **WebSocket 기반** 실시간 알림 전송
- **채팅, 이메일, 결재, 일정** 등 통합 알림
- **읽음 처리** 및 알림 관리
- **알림 목록** 조회

### ✅ 전자결재 (E-Approval)
- **결재선 설정** 및 관리
- **결재 문서 작성** 및 양식 관리
- **결재 상태** 실시간 추적
- **임시저장** 및 **기안함/결재함** 관리
- **파일 첨부** 지원

### 📅 일정 관리
- **개인 일정** 및 **부서 일정** 관리
- **캘린더 뷰** 제공
- **일정 공유** 및 알림
- **일정 검색** 기능

### 📋 게시판/공지사항
- **카테고리별 게시판** 운영
- **공지사항** 상단 고정
- **댓글 및 답글** 기능
- **파일 첨부** 및 다운로드
- **검색 및 정렬** 기능

### 👥 조직도
- **조직 구조** 시각화
- **부서별 인원** 조회
- **사용자 프로필** 확인
- **검색** 기능

### 👤 인사 관리
- **출퇴근 관리** (근태 시스템)
- **휴가 신청/승인** 시스템
- **사용자 관리** (관리자)
- **계정 로그** 조회

### 🔐 인증 및 권한 관리
- **JWT 기반** 인증
- **역할 기반 접근 제어** (RBAC)
- **로그인 이력** 관리
- **비밀번호 초기화** 기능

### 📊 대시보드
- **개인화된 대시보드**
- **위젯 드래그 앤 드롭** (자유 배치)
- **최근 메일, 알림, 게시판** 한눈에 확인
- **출퇴근 상태** 및 **생일자** 표시

---

## 🏗️ 프로젝트 구조 (아키텍처)

### 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 브라우저                       │
│                  (React Frontend)                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTP / WebSocket
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Nginx (리버스 프록시)                       │
│         - 정적 파일 서빙                                 │
│         - API 프록시 (/api → Backend)                   │
│         - WebSocket 프록시 (/ws → Backend)              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ 내부 네트워크
                        ▼
┌─────────────────────────────────────────────────────────┐
│            Spring Boot Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   REST API   │  │  WebSocket   │  │   Security   │   │
│  │  (Controller)│  │  (STOMP)     │  │   (JWT)      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Service    │  │  Repository  │  │   Entity     │   │
│  │   (비즈니스)  │  │ (JPA/MyBatis)│  │   (도메인)   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   MySQL     │ │    Redis    │ │   AWS S3    │
│  (Database) │ │   (Cache)   │ │   (Files)   │
└─────────────┘ └─────────────┘ └─────────────┘
```

### 백엔드-프론트엔드 통신 방식

#### REST API
- **HTTP 메서드**: GET, POST, PUT, DELETE
- **인증**: JWT 토큰 (HttpOnly Cookie)
- **응답 형식**: JSON
- **기본 경로**: `/api/v1/*`

#### WebSocket (실시간 통신)
- **프로토콜**: STOMP over WebSocket
- **연결 경로**: `/ws`
- **용도**: 
  - 실시간 채팅 메시지 전송/수신
  - 실시간 알림 전송
- **인증**: JWT 기반 WebSocket 인증

---

## 🛠️ 기술 스택 (Tech Stack)

### Backend
- **Language**: Java 17
- **Framework**: Spring Boot 3.3.5
- **ORM**: 
  - JPA / Hibernate
  - MyBatis (복잡한 쿼리)
- **Security**: Spring Security + JWT
- **Real-time**: WebSocket (STOMP)
- **Database**: MySQL 8.0
- **Cache**: Redis
- **File Storage**: AWS S3
- **Email**: SendGrid API
- **API Documentation**: Swagger (SpringDoc)
- **Build Tool**: Gradle

### Frontend
- **Library**: React 19.1.1
- **Build Tool**: Vite 7.2.1
- **UI Framework**: Material-UI (MUI) 7.3.4
- **Routing**: React Router DOM 7.9.4
- **HTTP Client**: Axios 1.12.2
- **Real-time**: SockJS + STOMP.js
- **Calendar**: FullCalendar
- **Utilities**:
  - date-fns, dayjs (날짜 처리)
  - html2canvas, jspdf (PDF 생성)
  - DOMPurify (XSS 방지)

### DevOps & Infrastructure
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx
- **Cloud**: AWS (EC2, S3, RDS)
- **CI/CD**: (선택사항) GitHub Actions

### Development Tools
- **Version Control**: Git
- **API Testing**: Swagger UI
- **Code Quality**: ESLint

---

## 🚀 환경설정 및 실행 방법 (Getting Started)

### 사전 요구사항

- Java 17 이상
- Node.js 18 이상
- Docker & Docker Compose
- MySQL 8.0 이상
- Redis (선택사항)

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```bash
# 데이터베이스 설정
MYSQL_HOST=your-db-host
MYSQL_PORT=3306
MYSQL_DATABASE=db_coreconnect
MYSQL_USER=your-username
MYSQL_PASSWORD=your-password

# JWT 설정
JWT_SECRET_KEY=your-jwt-secret-key

# AWS 설정
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=ap-northeast-2
AWS_BUCKET_NAME=your-s3-bucket-name

# CORS 설정
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://your-domain.com
WEBSOCKET_ALLOWED_ORIGINS=http://localhost:5173,http://your-domain.com

# SendGrid 설정
SENDGRID_API_KEY=your-sendgrid-api-key

# 메일 설정
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

> ⚠️ **주의**: `.env` 파일은 Git에 커밋하지 마세요. `.gitignore`에 추가되어 있습니다.

### 2. 데이터베이스 초기화

MySQL 데이터베이스를 생성하고 마이그레이션 스크립트를 실행하세요:

```sql
CREATE DATABASE db_coreconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

필요한 경우 `backend/src/main/resources/db/migration/` 폴더의 SQL 파일들을 실행하세요.

### 3. Docker 네트워크 생성

```bash
docker network create my-network
```

### 4. 애플리케이션 실행

#### Docker Compose를 사용한 실행 (권장)

```bash
# 프로젝트 루트에서 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 종료
docker-compose down
```

#### 로컬 개발 환경에서 실행

**Backend 실행:**
```bash
cd backend
./gradlew bootRun
# 또는
./gradlew build && java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

**Frontend 실행:**
```bash
cd frontend
npm install
npm run dev
```

애플리케이션이 정상적으로 실행되면:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080
- **Swagger UI**: http://localhost:8080/swagger-ui.html

### 5. 기본 관리자 계정

프로젝트 초기 실행 시 기본 관리자 계정이 생성됩니다:
- 이메일: `admin@example.com`
- 비밀번호: 1

> 📝 **참고**: 환경 변수 설정과 실행 방법에 대한 자세한 내용은 [배포 파일 연관관계 가이드](./배포_파일_연관관계_가이드.md)와 [설정 파일 관계 가이드](./설정_파일_관계_완벽_가이드.md)를 참고하세요.

---

## 📁 폴더 구조 (Directory Structure)

```
coreconnect/
│
├── backend/                          # Spring Boot 백엔드
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── com/goodee/coreconnect/
│   │   │   │       ├── account/          # 계정 로그 관리
│   │   │   │       ├── admin/            # 관리자 기능
│   │   │   │       ├── approval/         # 전자결재
│   │   │   │       ├── attendance/       # 출퇴근 관리
│   │   │   │       ├── auth/             # 인증/인가
│   │   │   │       ├── board/            # 게시판
│   │   │   │       ├── chat/             # 채팅 기능
│   │   │   │       ├── common/           # 공통 기능
│   │   │   │       │   └── notification/ # 알림 시스템
│   │   │   │       ├── config/           # 설정 클래스
│   │   │   │       ├── dashboard/        # 대시보드
│   │   │   │       ├── department/       # 부서 관리
│   │   │   │       ├── email/            # 이메일 시스템
│   │   │   │       ├── leave/            # 휴가 관리
│   │   │   │       ├── notice/           # 공지사항
│   │   │   │       ├── schedule/         # 일정 관리
│   │   │   │       ├── security/         # 보안 설정
│   │   │   │       ├── user/             # 사용자 관리
│   │   │   │       └── BackendApplication.java
│   │   │   └── resources/
│   │   │       ├── application.properties # Spring Boot 설정
│   │   │       ├── db/migration/          # 데이터베이스 마이그레이션
│   │   │       └── mappers/                # MyBatis 매퍼 XML
│   │   └── test/                           # 테스트 코드
│   ├── Dockerfile                          # Docker 이미지 빌드
│   └── build.gradle                        # Gradle 빌드 설정
│
├── frontend/                         # React 프론트엔드
│   ├── src/
│   │   ├── api/                      # API 통신 설정
│   │   ├── components/               # 공통 컴포넌트
│   │   │   ├── layout/               # 레이아웃 컴포넌트
│   │   │   ├── ui/                   # UI 컴포넌트
│   │   │   ├── user/                 # 사용자 관련 컴포넌트
│   │   │   └── utils/                # 유틸리티 컴포넌트
│   │   ├── features/                 # 기능별 모듈
│   │   │   ├── admin/                # 관리자 기능
│   │   │   ├── approval/             # 전자결재
│   │   │   ├── attendance/           # 출퇴근 관리
│   │   │   ├── auth/                 # 인증
│   │   │   ├── board/                # 게시판
│   │   │   ├── chat/                 # 채팅
│   │   │   ├── dashboard/            # 대시보드
│   │   │   ├── email/                # 이메일
│   │   │   ├── leave/                # 휴가 관리
│   │   │   ├── notice/               # 공지사항
│   │   │   ├── notification/         # 알림
│   │   │   ├── organization/         # 조직도
│   │   │   └── schedule/             # 일정 관리
│   │   ├── hooks/                    # Custom Hooks
│   │   ├── utils/                    # 유틸리티 함수
│   │   ├── App.jsx                   # 메인 앱 컴포넌트
│   │   └── main.jsx                  # 진입점
│   ├── public/                       # 정적 파일
│   ├── Dockerfile                    # Docker 이미지 빌드
│   ├── nginx.conf                    # Nginx 설정
│   └── package.json                  # NPM 의존성
│
├── docker-compose.yml                # Docker Compose 설정
├── .env                              # 환경 변수 (Git에 올리지 않음)
├── .gitignore
└── README.md                         # 프로젝트 문서

```

### 주요 폴더 설명

#### Backend
- **각 기능별 패키지 구조**: `controller`, `service`, `repository`, `entity`, `dto`
- **공통 기능**: `common` 패키지에 알림, 예외 처리 등
- **설정**: `config` 패키지에 Spring 설정 클래스들

#### Frontend
- **Features 기반 구조**: 각 기능별로 독립적인 폴더 구성
- **컴포넌트 재사용**: `components` 폴더에 공통 컴포넌트
- **API 통신**: `api` 폴더에 Axios 인스턴스 및 API 함수

---

## 👥 팀원 (Contributors)

### Backend & Frontend Developer
- **최미영** - 채팅(1:N / 1:1), 채팅알림, 알림(전자결재, 공지사항, 일정, 이메일), 이메일(발신, 수신, 답장, 전달, 중요메일함)
  - GitHub: [@meeyoungchoi94](https://github.com/choimeeyoung94)
- **이유천** - 대시보드, 관리자, 로그인, 휴가, 근태
  - Github: [@eusky](https://github.com/eusky)
- **김민석** - 전자결재
  - Github: [@109kms](https://github.com/109kms)
- **신성수** - 게시판, 조직도
  - Github: [@sss137](https://github.com/sss137)
- **이동욱** - 일정관리, 캘린더 
  - [@ehddnrzxc](https://github.com/ehddnrzxc)


---

## 📚 추가 자료

### 프로젝트 관련 링크
- GitHub Repository: https://github.com/choimeeyoung94/final_project_coreconnect
- 배포 링크: http://coreconnect.io.kr/login
- 데모 영상: https://youtu.be/qk5ntPlkdxY?si=bBmCznKjtsi8-Exu

---

## 🔒 보안 고려사항

- JWT 토큰은 HttpOnly Cookie로 저장
- 비밀번호는 BCrypt로 해싱
- SQL Injection 방지 (JPA, MyBatis 파라미터 바인딩)
- XSS 방지 (입력 데이터 검증 및 이스케이프)
- CORS 설정으로 허용된 Origin만 접근 가능
- 환경 변수로 민감한 정보 관리

---

## 📝 라이선스 (License)

이 프로젝트는 개인/교육 목적으로 개발되었습니다.

---

## 🎯 향후 계획

- [ ] 성능 최적화 (캐싱, 쿼리 최적화)
- [ ] 모바일 반응형 UI 개선
- [ ] 실시간 화상 회의 기능 추가
- [ ] 다국어 지원

---

## 🙏 감사의 글

프로젝트 개발에 도움을 주신 모든 분들께 감사드립니다.

---

<div align="center">

**💼 CoreConnect - 효율적인 업무 협업을 위한 그룹웨어 플랫폼**

Made with ❤️ by CoreConnect Team

</div>
