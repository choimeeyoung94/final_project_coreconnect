# ============================================
# 모든 시나리오 순차 실행 스크립트 (PowerShell)
# ============================================

param(
    [string]$BaseURL = "http://localhost:8080",
    [string]$WsURL = "ws://localhost:8080/ws",
    [switch]$SkipEndurance = $false  # 4시간 테스트 스킵
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "k6 부하 테스트 전체 실행" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 환경 변수 설정
$env:BASE_URL = $BaseURL
$env:WS_URL = $WsURL

Write-Host "환경 설정:" -ForegroundColor Yellow
Write-Host "  - BASE_URL: $BaseURL" -ForegroundColor White
Write-Host "  - WS_URL: $WsURL" -ForegroundColor White
Write-Host ""

# results 폴더 생성
if (-not (Test-Path "results")) {
    New-Item -ItemType Directory -Path "results" | Out-Null
    Write-Host "✅ results 폴더 생성 완료" -ForegroundColor Green
}

# 시작 시간 기록
$startTime = Get-Date
Write-Host "테스트 시작 시간: $startTime" -ForegroundColor Yellow
Write-Host ""

# 시나리오 목록
$scenarios = @(
    @{
        Name = "시나리오 1: 일반 채팅 (Baseline)"
        File = "scenario1-baseline-chat.js"
        Duration = "10분"
        Skip = $false
    },
    @{
        Name = "시나리오 2: 스트레스 테스트"
        File = "scenario2-stress-test.js"
        Duration = "20분"
        Skip = $false
    },
    @{
        Name = "시나리오 3: 스파이크 테스트"
        File = "scenario3-spike-test.js"
        Duration = "8분"
        Skip = $false
    },
    @{
        Name = "시나리오 5: 대규모 그룹 채팅"
        File = "scenario5-large-group-chat.js"
        Duration = "15분"
        Skip = $false
    },
    @{
        Name = "시나리오 6: 알림 폭주"
        File = "scenario6-notification-burst.js"
        Duration = "5분"
        Skip = $false
    },
    @{
        Name = "시나리오 4: 지속성 테스트"
        File = "scenario4-endurance-test.js"
        Duration = "4시간"
        Skip = $SkipEndurance
    }
)

$totalScenarios = $scenarios.Count
$completedScenarios = 0
$failedScenarios = 0

# 각 시나리오 실행
foreach ($scenario in $scenarios) {
    if ($scenario.Skip) {
        Write-Host "⏭️  $($scenario.Name) - 스킵" -ForegroundColor Yellow
        Write-Host ""
        continue
    }
    
    $scenarioStartTime = Get-Date
    
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "실행 중: $($scenario.Name)" -ForegroundColor Cyan
    Write-Host "예상 소요 시간: $($scenario.Duration)" -ForegroundColor Cyan
    Write-Host "시작 시간: $scenarioStartTime" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    
    # k6 실행
    $process = Start-Process -FilePath "k6" `
        -ArgumentList "run", $scenario.File `
        -NoNewWindow `
        -PassThru `
        -Wait
    
    $scenarioEndTime = Get-Date
    $scenarioDuration = $scenarioEndTime - $scenarioStartTime
    
    if ($process.ExitCode -eq 0) {
        Write-Host ""
        Write-Host "✅ $($scenario.Name) - 완료" -ForegroundColor Green
        Write-Host "   소요 시간: $($scenarioDuration.ToString('hh\:mm\:ss'))" -ForegroundColor Green
        $completedScenarios++
    } else {
        Write-Host ""
        Write-Host "❌ $($scenario.Name) - 실패 (Exit Code: $($process.ExitCode))" -ForegroundColor Red
        $failedScenarios++
    }
    
    Write-Host ""
    Write-Host "진행 상황: $completedScenarios / $totalScenarios 완료" -ForegroundColor Yellow
    Write-Host ""
    
    # 다음 시나리오 전 30초 대기
    if ($completedScenarios -lt $totalScenarios) {
        Write-Host "다음 시나리오 시작까지 30초 대기..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
        Write-Host ""
    }
}

# 종료 시간 및 총 소요 시간
$endTime = Get-Date
$totalDuration = $endTime - $startTime

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "전체 테스트 완료" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 테스트 요약:" -ForegroundColor Yellow
Write-Host "  - 총 시나리오: $totalScenarios" -ForegroundColor White
Write-Host "  - 완료: $completedScenarios" -ForegroundColor Green
Write-Host "  - 실패: $failedScenarios" -ForegroundColor Red
Write-Host "  - 시작 시간: $startTime" -ForegroundColor White
Write-Host "  - 종료 시간: $endTime" -ForegroundColor White
Write-Host "  - 총 소요 시간: $($totalDuration.ToString('hh\:mm\:ss'))" -ForegroundColor White
Write-Host ""
Write-Host "결과 파일: .\results\" -ForegroundColor Yellow
Write-Host ""

# 결과 파일 목록 출력
if (Test-Path "results") {
    Write-Host "생성된 결과 파일:" -ForegroundColor Yellow
    Get-ChildItem "results" | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

# 종료 코드 반환
if ($failedScenarios -gt 0) {
    exit 1
} else {
    exit 0
}
