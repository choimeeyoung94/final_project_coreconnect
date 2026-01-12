# SendGrid 스팸 방지 완벽 가이드 📧

## 🎯 개요
외부 메일 발송 시 스팸으로 분류되지 않도록 하는 종합 가이드입니다.

---

## 1️⃣ SendGrid 설정 (가장 중요! 🔥)

### A. 도메인 인증 (Domain Authentication)
**필수 작업! 이것만 하면 80% 해결됩니다.**

#### SendGrid 대시보드에서 설정:
1. Settings → Sender Authentication → Domain Authentication
2. `coreconnect.io.kr` 도메인 추가
3. DNS 레코드 추가 (도메인 관리 페이지에서):

```dns
# SPF 레코드 (발신자 인증)
Type: TXT
Name: coreconnect.io.kr
Value: v=spf1 include:sendgrid.net ~all

# DKIM 레코드 (메시지 무결성)
Type: CNAME
Name: s1._domainkey.coreconnect.io.kr
Value: s1.domainkey.u12345.wl.sendgrid.net (SendGrid에서 제공)

Type: CNAME
Name: s2._domainkey.coreconnect.io.kr
Value: s2.domainkey.u12345.wl.sendgrid.net (SendGrid에서 제공)

# DMARC 레코드 (정책 설정)
Type: TXT
Name: _dmarc.coreconnect.io.kr
Value: v=DMARC1; p=none; rua=mailto:admin@coreconnect.io.kr
```

#### 검증 방법:
```bash
# SPF 확인
nslookup -type=txt coreconnect.io.kr

# DKIM 확인
nslookup -type=cname s1._domainkey.coreconnect.io.kr
```

### B. 링크 브랜딩 (Link Branding)
- Settings → Sender Authentication → Link Branding
- 메일 내 모든 링크가 `coreconnect.io.kr`에서 발송되도록 설정

### C. Dedicated IP (선택사항 - 비용 발생)
- 대량 발송 시 전용 IP 사용 고려
- 월 100,000통 이상 발송 시 권장

---

## 2️⃣ 이메일 제목 (Subject) 작성 가이드

### ✅ 좋은 제목 예시
```
✓ [CoreConnect] 회의록이 공유되었습니다
✓ 김철수님이 프로젝트에 초대하셨습니다
✓ [알림] 새 메시지 3건이 도착했습니다
✓ 월간 리포트 - 2025년 12월
```

### ❌ 피해야 할 제목 (스팸 트리거)
```
✗ 무료!!!, 지금 바로!!!, 100% 보장
✗ RE: RE: RE: (과도한 답장 표시)
✗ 전체 대문자: FREE MONEY NOW!!!
✗ 과도한 특수문자: $$$ 돈벌기 $$$
✗ 긴급/경고 남발: 긴급!!경고!!주의!!
```

### 📋 제목 작성 원칙
1. **길이**: 30-50자 (모바일에서 잘림 방지)
2. **개인화**: 수신자 이름 포함 (예: "김철수님께 알림")
3. **명확성**: 메일 내용을 정확히 설명
4. **이모지**: 적절히 사용 (1-2개)
5. **브랜드**: [CoreConnect] 같은 식별자 추가

---

## 3️⃣ 이메일 본문 (Content) 작성 가이드

### A. HTML 구조 (현재 코드에 구현됨 ✅)
```html
<!DOCTYPE html>
<html lang='ko'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>메일 제목</title>
</head>
<body style='max-width: 600px; margin: 0 auto;'>
    <!-- 메인 콘텐츠 -->
    <div>메일 내용</div>
    
    <!-- 푸터 (회사 정보 + 수신거부) -->
    <footer>...</footer>
</body>
</html>
```

### B. 콘텐츠 작성 원칙

#### ✅ 해야 할 것
```
1. Plain Text + HTML 버전 모두 제공 (현재 구현됨 ✅)
2. 실제 회사 주소 포함 (CAN-SPAM 법률 준수)
3. 수신거부 링크 제공 (현재 구현됨 ✅)
4. 명확한 발신자 정보 (현재 구현됨 ✅)
5. 적절한 텍스트/이미지 비율 (80:20)
6. 모바일 반응형 디자인
7. 대체 텍스트 (alt) 제공
```

#### ❌ 피해야 할 것
```
1. 이미지만 있는 메일 (텍스트 필수)
2. 전체 빨간색 텍스트
3. 과도한 링크 (3-5개 이하 권장)
4. 단축 URL (bit.ly 등) → 전체 URL 사용
5. 첨부파일 크기 > 10MB
6. JavaScript 사용 (대부분 차단됨)
7. Form 태그 (보안 문제)
```

### C. 스팸 트리거 단어 피하기

#### ❌ 금융 관련
```
무료, 공짜, 무료배송, 100% 보장
돈벌기, 수익, 투자, 대출
카드번호, 계좌번호, 비밀번호
```

#### ❌ 긴급성 강조
```
긴급!, 지금 바로!, 서두르세요!
기회!, 마지막 기회!, 놓치지 마세요!
시간 제한, 오늘만, 24시간 내
```

#### ✅ 대신 사용할 표현
```
"안내", "알림", "공유", "업데이트"
"확인 부탁드립니다", "참고하시기 바랍니다"
"새로운 소식", "월간 리포트"
```

---

## 4️⃣ 발송 전략

### A. 워밍업 (Warm-up) - 신규 도메인 필수!
```
Day 1-3:   20통/일
Day 4-7:   50통/일
Day 8-14:  100통/일
Day 15-30: 200통/일
Day 31+:   제한 없음 (단계적 증가)
```

### B. 발송 빈도
```
✓ 점진적 증가 (급증 금지)
✓ 일정한 패턴 유지
✓ 스파이크 방지 (갑자기 1만 통 → 스팸 의심)
```

### C. 시간대
```
최적 발송 시간:
- 평일 오전 10-11시
- 평일 오후 2-3시
피해야 할 시간:
- 심야 (밤 11시-새벽 6시)
- 주말 (토/일요일)
```

---

## 5️⃣ 수신자 관리

### A. 이메일 리스트 검증
```java
// 이메일 유효성 검사 강화
private boolean isValidEmail(String email) {
    // 1. 형식 검증
    String regex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";
    if (!email.matches(regex)) return false;
    
    // 2. 일회용 이메일 차단
    String[] disposableDomains = {
        "temp-mail.org", "guerrillamail.com", "10minutemail.com"
    };
    for (String domain : disposableDomains) {
        if (email.endsWith(domain)) return false;
    }
    
    return true;
}
```

### B. 반송(Bounce) 관리
```java
// SendGrid Webhook으로 자동 처리
// 1. Hard Bounce: 즉시 리스트에서 제거
// 2. Soft Bounce: 3회 실패 시 제거
// 3. 스팸 신고: 즉시 수신거부 처리
```

### C. 수신거부 (Unsubscribe)
```
✓ 모든 메일에 수신거부 링크 포함 (현재 구현됨 ✅)
✓ 원클릭 수신거부 지원
✓ 수신거부 후 즉시 발송 중단 (24시간 내)
```

---

## 6️⃣ 모니터링 및 개선

### A. SendGrid 통계 확인
```
매일 확인할 지표:
1. Delivered Rate (전달율): > 95%
2. Open Rate (열람율): 15-25%
3. Click Rate (클릭율): 2-5%
4. Bounce Rate (반송율): < 5%
5. Spam Report Rate (스팸신고율): < 0.1%
6. Unsubscribe Rate (수신거부율): < 0.5%
```

### B. 개선 액션
```
⚠️ Spam Report Rate > 0.1%
→ 제목/본문 재검토, 발송 빈도 감소

⚠️ Bounce Rate > 5%
→ 이메일 리스트 검증 강화

⚠️ Open Rate < 10%
→ 제목 개선, 발송 시간대 변경
```

### C. 테스트 방법
```bash
# 1. 스팸 점수 확인
https://www.mail-tester.com/

# 2. 여러 메일 클라이언트 테스트
- Gmail
- Outlook
- Naver Mail
- Daum Mail

# 3. 스팸 폴더 확인
각 메일 서비스에서 스팸 폴더 도착 여부 확인
```

---

## 7️⃣ CAN-SPAM 법률 준수 (미국)

### 필수 포함 사항 (현재 구현됨 ✅)
```
✓ 실제 발신자 이름 및 이메일
✓ 정확한 제목 (기만적 제목 금지)
✓ 실제 회사 주소
✓ 수신거부 링크
✓ 수신거부 후 10일 내 처리
```

---

## 8️⃣ 체크리스트

### 발송 전 확인사항
```
□ SendGrid 도메인 인증 완료 (SPF, DKIM, DMARC)
□ 링크 브랜딩 설정 완료
□ 제목에 스팸 트리거 단어 없음
□ Plain Text + HTML 버전 모두 제공
□ 회사 정보 푸터 포함
□ 수신거부 링크 포함
□ 이미지/텍스트 비율 적절 (80:20)
□ 모바일 반응형 확인
□ 여러 메일 클라이언트에서 테스트
□ mail-tester.com 점수 > 8/10
□ 발송량 워밍업 계획 수립
```

---

## 9️⃣ 코드 구현 상태

### ✅ 현재 구현됨 (SendGridEmailSender.java)
```java
1. Plain Text + HTML 버전 제공
2. 회사 정보 푸터
3. 수신거부 안내
4. Reply-To 설정
5. 적절한 HTML 구조 (DOCTYPE, meta 태그)
6. 추적 설정 (Open/Click Tracking)
7. 카테고리 설정 (통계 관리)
```

### 🔄 추가 구현 권장사항
```java
1. 이메일 유효성 검증 강화
2. 반송(Bounce) 자동 처리 (Webhook)
3. 수신거부 원클릭 구현
4. 스팸 점수 사전 체크
5. A/B 테스트 기능
```

---

## 🎓 참고 자료

1. **SendGrid 공식 문서**
   - https://docs.sendgrid.com/ui/sending-email/deliverability

2. **스팸 점수 테스트**
   - https://www.mail-tester.com/
   - https://mxtoolbox.com/spf.aspx

3. **법률 준수**
   - CAN-SPAM: https://www.ftc.gov/can-spam
   - GDPR (EU): https://gdpr.eu/

4. **모범 사례**
   - SendGrid Best Practices: https://sendgrid.com/blog/category/deliverability/

---

## 📞 문제 발생 시

### SendGrid 지원팀 연락
```
1. SendGrid 대시보드 → Support
2. 이메일: support@sendgrid.com
3. 평판 문제 발생 시 즉시 연락
```

### 자가 진단
```bash
# SPF 확인
dig TXT coreconnect.io.kr

# DKIM 확인
dig TXT s1._domainkey.coreconnect.io.kr

# MX 레코드 확인
dig MX coreconnect.io.kr
```

---

## 💡 요약

**가장 중요한 3가지:**
1. 🔐 **SendGrid 도메인 인증** (SPF, DKIM, DMARC)
2. 📝 **적절한 콘텐츠 구성** (Plain Text + HTML, 푸터, 수신거부)
3. 📊 **점진적 발송** (워밍업 + 지속적 모니터링)

이 3가지만 제대로 하면 **95% 이상 받은편지함**에 도착합니다! 🎯

