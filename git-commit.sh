#!/bin/bash
# ================================================================
# Git 커밋 자동화 스크립트
# 10만명 동시접속 채팅방 - 서버 스케일 아웃 구성
# ================================================================

set -e

echo "========================================"
echo "🚀 Git 커밋 준비"
echo "========================================"
echo ""

# ----------------------------------------------------------------
# 1️⃣ 변경사항 확인
# ----------------------------------------------------------------
echo "1️⃣ 변경사항 확인 중..."
echo ""

# 신규 파일 목록
NEW_FILES=(
    "docker-compose.yml"
    "환경변수_설정.txt"
    "nginx/nginx.conf"
    "monitoring/prometheus.yml"
    "monitoring/grafana/datasources/datasource.yml"
    "monitoring/grafana/dashboards/dashboard.yml"
    "start-cluster.sh"
    "stop-cluster.sh"
    "health-check.sh"
    "README_DOCKER_COMPOSE.md"
    "QUICK_START.md"
    "서버_스케일_아웃_10대_구축_가이드.md"
    "PULL_REQUEST.md"
    "commit_message.txt"
    "CHANGES.md"
    "git-commit.sh"
)

# 수정 파일 목록
MODIFIED_FILES=(
    "backend/src/main/java/com/goodee/coreconnect/chat/service/ChatRoomServiceImpl.java"
)

echo "📦 신규 파일: ${#NEW_FILES[@]}개"
for file in "${NEW_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (파일 없음!)"
    fi
done

echo ""
echo "📝 수정 파일: ${#MODIFIED_FILES[@]}개"
for file in "${MODIFIED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ⚠️  $file (파일 없음)"
    fi
done

# ----------------------------------------------------------------
# 2️⃣ Git 상태 확인
# ----------------------------------------------------------------
echo ""
echo "2️⃣ Git 상태 확인 중..."
echo ""

git status --short

# ----------------------------------------------------------------
# 3️⃣ 커밋 확인
# ----------------------------------------------------------------
echo ""
echo "3️⃣ 커밋 메시지 미리보기:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
head -20 commit_message.txt
echo "..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ----------------------------------------------------------------
# 4️⃣ 사용자 확인
# ----------------------------------------------------------------
read -p "커밋을 진행하시겠습니까? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 커밋 취소됨"
    exit 1
fi

# ----------------------------------------------------------------
# 5️⃣ Git Add
# ----------------------------------------------------------------
echo ""
echo "5️⃣ Git Add 실행 중..."
echo ""

# 신규 파일 추가
for file in "${NEW_FILES[@]}"; do
    if [ -f "$file" ]; then
        git add "$file"
        echo "  ✅ Added: $file"
    fi
done

# 수정 파일 추가
for file in "${MODIFIED_FILES[@]}"; do
    if [ -f "$file" ]; then
        git add "$file"
        echo "  ✅ Added: $file"
    fi
done

# ----------------------------------------------------------------
# 6️⃣ Git Commit
# ----------------------------------------------------------------
echo ""
echo "6️⃣ Git Commit 실행 중..."
echo ""

git commit -F commit_message.txt

echo ""
echo "✅ 커밋 완료!"

# ----------------------------------------------------------------
# 7️⃣ 커밋 정보 출력
# ----------------------------------------------------------------
echo ""
echo "7️⃣ 커밋 정보:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log -1 --stat
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ----------------------------------------------------------------
# 8️⃣ 푸시 확인
# ----------------------------------------------------------------
echo ""
read -p "푸시하시겠습니까? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "8️⃣ Git Push 실행 중..."
    
    # 현재 브랜치 확인
    CURRENT_BRANCH=$(git branch --show-current)
    echo "현재 브랜치: $CURRENT_BRANCH"
    
    # 푸시
    git push origin "$CURRENT_BRANCH"
    
    echo ""
    echo "✅ 푸시 완료!"
else
    echo ""
    echo "ℹ️  푸시를 건너뛰었습니다."
    echo "   나중에 푸시하려면: git push origin $(git branch --show-current)"
fi

# ----------------------------------------------------------------
# 9️⃣ 완료
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo "✅ 작업 완료!"
echo "========================================"
echo ""
echo "📊 변경사항 요약:"
echo "  - 신규 파일: ${#NEW_FILES[@]}개"
echo "  - 수정 파일: ${#MODIFIED_FILES[@]}개"
echo "  - 총 라인 수: ~7,500 lines"
echo ""
echo "📚 다음 단계:"
echo "  1. GitHub에서 Pull Request 생성"
echo "  2. PULL_REQUEST.md 내용을 PR Description에 복사"
echo "  3. 리뷰 요청"
echo ""
echo "🎉 수고하셨습니다!"
echo ""



