# SMTP 서버 직접 구축 방법

> SendGrid 대신 자체 SMTP 서버를 구축하는 방법과 장단점 비교

---

## 📧 SMTP 서버란?

**SMTP (Simple Mail Transfer Protocol)**:
- 이메일을 전송하는 프로토콜
- 메일 서버 간 통신에 사용
- 포트: 25 (기본), 587 (TLS), 465 (SSL)

**구성 요소**:
1. **SMTP 서버**: 메일 전송 (Postfix, Sendmail 등)
2. **IMAP/POP3 서버**: 메일 수신 (Dovecot 등)
3. **DNS 설정**: MX 레코드, SPF, DKIM, DMARC

---

## 🛠️ 방법 1: Postfix + Dovecot 구축

### **1단계: Postfix 설치 (SMTP 서버)**

```bash
# Ubuntu 서버
sudo apt update
sudo apt install -y postfix mailutils

# 설치 중 선택:
# - General type of mail configuration: Internet Site
# - System mail name: coreconnect.io.kr
```

**Postfix 설정**:
```bash
sudo nano /etc/postfix/main.cf
```

```conf
# 기본 설정
myhostname = mail.coreconnect.io.kr
mydomain = coreconnect.io.kr
myorigin = $mydomain

# 수신 설정
inet_interfaces = all
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain

# 릴레이 설정 (인증된 사용자만 전송 가능)
smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination

# SASL 인증 (사용자 인증)
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes

# TLS 암호화 (보안)
smtpd_tls_cert_file = /etc/letsencrypt/live/mail.coreconnect.io.kr/fullchain.pem
smtpd_tls_key_file = /etc/letsencrypt/live/mail.coreconnect.io.kr/privkey.pem
smtpd_use_tls = yes
smtpd_tls_security_level = may

# 메일 크기 제한
message_size_limit = 10485760  # 10MB
```

**Postfix 재시작**:
```bash
sudo systemctl restart postfix
sudo systemctl enable postfix
```

---

### **2단계: Dovecot 설치 (IMAP 서버)**

```bash
sudo apt install -y dovecot-core dovecot-imapd dovecot-pop3d
```

**Dovecot 설정**:
```bash
sudo nano /etc/dovecot/dovecot.conf
```

```conf
protocols = imap pop3 lmtp
listen = *
```

```bash
sudo nano /etc/dovecot/conf.d/10-mail.conf
```

```conf
mail_location = maildir:~/Maildir
```

**Dovecot 재시작**:
```bash
sudo systemctl restart dovecot
sudo systemctl enable dovecot
```

---

### **3단계: DNS 설정 (가비아)**

메일 서버로 인식되려면 DNS 레코드 설정 필수!

**가비아 DNS 관리에서 추가**:

#### **MX 레코드** (메일 서버 지정)
```
Type: MX
Host: @
Value: mail.coreconnect.io.kr
Priority: 10
```

#### **A 레코드** (메일 서버 IP)
```
Type: A
Host: mail
Value: 54.116.26.182
```

#### **SPF 레코드** (스팸 방지)
```
Type: TXT
Host: @
Value: v=spf1 mx ip4:54.116.26.182 ~all
```

#### **DKIM 레코드** (이메일 인증)
```bash
# DKIM 키 생성
sudo apt install -y opendkim opendkim-tools
sudo opendkim-genkey -s default -d coreconnect.io.kr
```

```
Type: TXT
Host: default._domainkey
Value: (생성된 공개키)
```

#### **DMARC 레코드** (정책)
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:admin@coreconnect.io.kr
```

---

### **4단계: SSL 인증서 (Let's Encrypt)**

```bash
sudo certbot certonly --standalone \
  -d mail.coreconnect.io.kr \
  --agree-tos \
  -m admin@coreconnect.io.kr
```

---

### **5단계: 사용자 계정 생성**

```bash
# 메일 사용자 추가
sudo adduser emailuser1
sudo adduser emailuser2

# Maildir 생성
sudo mkdir -p /home/emailuser1/Maildir
sudo chown -R emailuser1:emailuser1 /home/emailuser1/Maildir
```

---

### **6단계: Spring Boot 연동**

**application.properties**:
```properties
# 자체 SMTP 서버 설정
spring.mail.host=mail.coreconnect.io.kr
spring.mail.port=587
spring.mail.username=emailuser1
spring.mail.password=your_password
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
```

**Java 코드**:
```java
@Service
@RequiredArgsConstructor
public class CustomEmailService {
    
    private final JavaMailSender mailSender;
    
    public void sendEmail(String to, String subject, String content) {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        
        helper.setFrom("noreply@coreconnect.io.kr");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(content, true);  // true = HTML
        
        mailSender.send(message);
    }
}
```

---

## ⚖️ SendGrid vs 자체 SMTP 비교

| 항목 | SendGrid | 자체 SMTP 서버 |
|------|----------|---------------|
| **구축 시간** | 30분 (API 연동) | 1-2일 (서버 구축, DNS 설정) |
| **비용** | 월 100통 무료, 이후 유료 | 서버 비용만 (월 $5~) |
| **전달률** | 매우 높음 (95%+) | 낮을 수 있음 (스팸 처리) |
| **IP 평판 관리** | SendGrid가 관리 | 직접 관리 필요 |
| **모니터링** | 대시보드 제공 | 직접 구축 |
| **발송 속도** | 매우 빠름 | 중간 |
| **대량 발송** | 지원 | 직접 큐 관리 필요 |
| **유지보수** | 불필요 | 필요 (서버 관리) |
| **보안** | 자동 (TLS, DKIM 등) | 직접 설정 |
| **반송 처리** | 자동 | 직접 구현 |

---

## 🔴 자체 SMTP 서버의 문제점

### **1. 스팸 처리 위험**
```
새 IP 주소 → IP 평판 없음 → Gmail/Outlook이 스팸으로 분류
```
**해결**: 
- 시간이 걸림 (3-6개월)
- SPF, DKIM, DMARC 필수
- 반송률 낮게 유지

### **2. 포트 25 차단**
대부분의 클라우드(AWS, GCP)에서 포트 25 차단
```bash
# AWS EC2는 포트 25 차단됨!
# 해제 요청: https://aws.amazon.com/forms/ec2-email-limit-rdns-request
```

### **3. 블랙리스트 위험**
한 번 스팸으로 신고되면 블랙리스트 등록
```
Spamhaus, Barracuda 등의 블랙리스트에 등록되면
모든 메일이 거부됨
```

### **4. 유지보수 부담**
- 서버 모니터링 필요
- 로그 분석
- 보안 업데이트
- 디스크 관리 (메일 큐)

---

## 🛠️ 방법 2: Docker로 Mail Server 구축

### **Mail-in-a-Box (추천)**

```bash
# 전용 서버 준비 (Ubuntu 22.04)
curl -s https://mailinabox.email/setup.sh | sudo bash
```

**장점**:
- Postfix, Dovecot, Roundcube 등 자동 설치
- DNS, SSL 자동 설정
- 웹 관리 인터페이스 제공

---

### **Docker Mailserver**

```yaml
# docker-compose.yml
version: '3.8'

services:
  mailserver:
    image: docker-mailserver/docker-mailserver:latest
    container_name: mailserver
    hostname: mail.coreconnect.io.kr
    ports:
      - "25:25"    # SMTP
      - "587:587"  # Submission
      - "993:993"  # IMAPS
    volumes:
      - ./mail-data:/var/mail
      - ./mail-state:/var/mail-state
      - ./config:/tmp/docker-mailserver
      - /etc/letsencrypt:/etc/letsencrypt:ro
    environment:
      - ENABLE_SPAMASSASSIN=1
      - ENABLE_CLAMAV=1
      - ENABLE_FAIL2BAN=1
      - SSL_TYPE=letsencrypt
      - ONE_DIR=1
    cap_add:
      - NET_ADMIN
    restart: unless-stopped
```

**메일 계정 생성**:
```bash
docker exec -it mailserver setup email add admin@coreconnect.io.kr password123
```

---

## 💡 면접 답변 예시

### Q: "SendGrid 대신 자체 SMTP 서버를 구축하지 않은 이유는?"

**답변**:
> "자체 SMTP 서버도 고려했지만, SendGrid를 선택한 이유는 다음과 같습니다.
> 
> **자체 SMTP 서버의 문제점**:
> 
> **1. IP 평판 관리의 어려움**:
> - 새 IP 주소는 평판이 없어 Gmail, Outlook 등이 스팸으로 분류
> - IP 평판을 쌓는 데 최소 3-6개월 소요
> - 한 번 스팸으로 신고되면 블랙리스트 등록 (회복 어려움)
> 
> **2. AWS EC2의 포트 25 제한**:
> - AWS는 기본적으로 포트 25(SMTP)를 차단
> - 해제 요청 필요하지만 승인 보장 안 됨
> - 포트 587(TLS)도 제한될 수 있음
> 
> **3. 복잡한 DNS 설정**:
> - MX, A 레코드 기본
> - SPF, DKIM, DMARC 필수 (스팸 방지)
> - 역방향 DNS(rDNS) 설정 필요
> - 하나라도 잘못되면 전송 실패
> 
> **4. 보안 관리 부담**:
> - SSL/TLS 인증서 관리
> - SMTP 인증 설정 (SASL)
> - 스팸 필터 (SpamAssassin)
> - 바이러스 검사 (ClamAV)
> - 모두 직접 설정/유지보수
> 
> **5. 운영 부담**:
> - 메일 큐 모니터링
> - 반송 메일 처리
> - 로그 분석
> - 디스크 관리
> - 24시간 가동 필요
> 
> **SendGrid 선택 이유**:
> 
> **1. 즉시 사용 가능**:
> - 회원가입 → API 키 발급 → 30분 내 연동 완료
> - IP 평판 이미 확보됨
> 
> **2. 높은 전달률**:
> - 95% 이상 전달률 보장
> - Gmail/Outlook 등 주요 메일 서비스와 신뢰 관계
> 
> **3. 자동 인프라 관리**:
> - SPF, DKIM, DMARC 자동 설정
> - 반송 메일 자동 처리
> - 재시도 로직 내장
> 
> **4. 모니터링 대시보드**:
> - 발송률, 오픈율, 클릭률 실시간 확인
> - 스팸 신고 추적
> - API 호출 통계
> 
> **5. 비용 효율성**:
> - 월 100통 무료
> - 초기 단계 프로젝트에 적합
> - 서버 관리 인력 불필요
> 
> **결론**:
> 프로젝트 초기 단계에서는 **비즈니스 로직 구현에 집중**하는 것이 중요하다고 판단했습니다. SMTP 서버 구축에 시간을 쓰기보다, SendGrid를 사용하여 **빠르게 안정적인 이메일 기능을 구현**하는 것이 더 효율적이었습니다.
> 
> 만약 미래에 **월 10만 통 이상** 발송하거나, **완전한 메일 시스템**(받은 메일함, IMAP 등)이 필요하다면 자체 구축을 고려할 수 있습니다."

---

## 🔧 자체 SMTP 서버 구축이 적합한 경우

1. **대량 발송** (월 10만 통 이상)
   - SendGrid 비용이 급증
   - 자체 서버가 경제적

2. **완전한 통제 필요**
   - 발송 로직 커스터마이징
   - 개인정보 외부 서비스 노출 불가

3. **받은 메일함 필요**
   - 사용자가 이메일 수신도 해야 함
   - IMAP/POP3 서버 필요

4. **사내 메일 시스템**
   - 회사 내부용 메일 서버
   - 외부 발송 불필요

---

## 📊 구축 난이도 비교

```
SendGrid API 연동:        ⭐ (매우 쉬움, 30분)
Docker Mailserver:        ⭐⭐⭐ (보통, 1일)
Postfix + Dovecot 직접:  ⭐⭐⭐⭐⭐ (어려움, 2-3일)
프로덕션 레벨 메일 서버:  ⭐⭐⭐⭐⭐⭐ (매우 어려움, 1주일+)
```

---

## 🎤 면접 답변 정리

**"자체 SMTP 서버 구축 경험이 있나요?"**

> "SendGrid를 사용했지만, SMTP 서버 구축 방법도 학습했습니다.
> 
> 자체 SMTP 서버는 **Postfix**(전송)와 **Dovecot**(수신)을 조합하여 구축할 수 있고, **MX, SPF, DKIM, DMARC** 등 DNS 설정이 필수적입니다.
> 
> 하지만 프로젝트 초기에는 다음 이유로 SendGrid를 선택했습니다:
> 1. IP 평판 확보 시간 (3-6개월) 절약
> 2. AWS EC2의 포트 25 제한 회피
> 3. 개발 시간을 비즈니스 로직에 집중
> 4. 높은 전달률 보장
> 
> 만약 대량 발송이 필요하거나, 완전한 메일 시스템이 필요하다면 **Docker Mailserver** 또는 **Mail-in-a-Box** 같은 솔루션을 사용하여 구축할 수 있습니다."

---

**다음 파일로 Docker/배포 관련 질문을 만들겠습니다!** 🚀

