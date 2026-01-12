# GitHub Secrets 추가 설정값

## ✅ EKS 클러스터 사용 시 추가할 Secrets

### 1. EKS_CLUSTER_NAME
```
이름: EKS_CLUSTER_NAME
값: chat-prod
```
**설명:** AWS EKS 클러스터 이름 (스크린샷에서 확인된 클러스터 이름)

### 2. K8S_CLUSTER_TYPE
```
이름: K8S_CLUSTER_TYPE
값: EKS
```
**설명:** Kubernetes 클러스터 타입 (대문자로 정확히 입력)

### 3. AWS_REGION (이미 있다면 확인만)
```
이름: AWS_REGION
값: ap-northeast-2
```
**설명:** 스크린샷에서 서울 리전 사용 중 (이미 있을 수 있음)

---

## 📝 GitHub Secrets 추가 방법

### 단계별 가이드:

1. **GitHub 저장소 접속**
   - https://github.com/your-username/final_project_coreconnect

2. **Settings 탭 클릭**
   - 저장소 상단의 Settings 클릭

3. **Secrets and variables → Actions 클릭**
   - 왼쪽 메뉴에서 선택

4. **New repository secret 클릭** (초록색 버튼)

5. **각 Secret 추가:**

   **Secret 1:**
   ```
   Name: EKS_CLUSTER_NAME
   Secret: chat-prod
   ```
   → Add secret 클릭

   **Secret 2:**
   ```
   Name: K8S_CLUSTER_TYPE
   Secret: EKS
   ```
   → Add secret 클릭

---

## ⚠️ 중요 확인 사항

### 기존 Secrets 값 확인:

1. **MYSQL_HOST**
   - RDS 엔드포인트 주소인지 확인
   - 예: `your-rds.xxxxx.ap-northeast-2.rds.amazonaws.com`

2. **CORS_ALLOWED_ORIGINS**
   - 쿠버네티스 서비스 도메인이 포함되어 있는지 확인
   - 예: `http://localhost:3000,https://your-domain.com`

3. **WEBSOCKET_ALLOWED_ORIGINS**
   - WebSocket 허용 도메인 확인
   - 예: `http://localhost:3000,https://your-domain.com`

4. **ALLOWED_ORIGIN**
   - Frontend 도메인 확인
   - 예: `https://your-domain.com`

---

## 📋 최종 체크리스트

설정 완료 후 확인:

- [ ] EKS_CLUSTER_NAME 추가 (값: chat-prod)
- [ ] K8S_CLUSTER_TYPE 추가 (값: EKS)
- [ ] AWS_ACCESS_KEY_ID 확인 (EKS 접근 권한 있는지)
- [ ] AWS_SECRET_ACCESS_KEY 확인
- [ ] AWS_REGION 확인 (값: ap-northeast-2)
- [ ] MYSQL_HOST가 RDS 엔드포인트인지 확인
- [ ] 모든 다른 Secrets 값 확인

---

## 🔍 AWS_ACCESS_KEY_ID 권한 확인

GitHub Actions에서 EKS에 접근하려면 IAM 사용자에 다음 권한 필요:

**필수 권한:**
- `eks:DescribeCluster`
- `eks:ListClusters`
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:GetDownloadUrlForLayer`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`

**확인 방법:**
1. AWS Console → IAM → Users
2. GitHub Actions에서 사용 중인 IAM 사용자 선택
3. Permissions 탭에서 권한 확인

**권한이 없다면:**
- `AmazonEKSClusterPolicy` 또는
- `AmazonEKSServicePolicy` 또는
- Custom Policy 추가
