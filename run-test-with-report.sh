#!/bin/bash

echo "========================================="
echo "K6 테스트 실행 중..."
echo "========================================="

# 테스트 실행하고 JSON 결과 저장
k6 run test.js --out json=results.json --summary-export=summary.json

echo ""
echo "========================================="
echo "결과 분석 중..."
echo "========================================="

# summary.json에서 주요 메트릭 추출
cat > analyze_results.sh << 'EOF'
#!/bin/bash

echo ""
echo "📊 ========================================="
echo "   CoreConnect 성능 테스트 결과"
echo "========================================="
echo ""

# 이메일 받은편지함 조회 시간
echo "📧 이메일 받은편지함 조회 (type:email_inbox)"
echo "─────────────────────────────────────────"
cat summary.json | jq -r '
  .metrics."http_req_duration{type:email_inbox}" | 
  "  평균: \(.values.avg)ms\n  최소: \(.values.min)ms\n  중간: \(.values.med)ms\n  최대: \(.values.max)ms\n  P90: \(.values["p(90)"])ms\n  P95: \(.values["p(95)"])ms"
' 2>/dev/null || echo "  데이터 없음"

echo ""

# 채팅 조회 시간
echo "💬 채팅 최근 목록 조회 (type:chat_latest)"
echo "─────────────────────────────────────────"
cat summary.json | jq -r '
  .metrics."http_req_duration{type:chat_latest}" | 
  "  평균: \(.values.avg)ms\n  최소: \(.values.min)ms\n  중간: \(.values.med)ms\n  최대: \(.values.max)ms\n  P90: \(.values["p(90)"])ms\n  P95: \(.values["p(95)"])ms"
' 2>/dev/null || echo "  데이터 없음"

echo ""

# 알림 조회 시간
echo "🔔 알림 조회 (type:notif)"
echo "─────────────────────────────────────────"
cat summary.json | jq -r '
  .metrics."http_req_duration{type:notif}" | 
  "  평균: \(.values.avg)ms\n  최소: \(.values.min)ms\n  중간: \(.values.med)ms\n  최대: \(.values.max)ms\n  P90: \(.values["p(90)"])ms\n  P95: \(.values["p(95)"])ms"
' 2>/dev/null || echo "  데이터 없음"

echo ""

# 전체 통계
echo "📈 전체 HTTP 요청 통계"
echo "─────────────────────────────────────────"
cat summary.json | jq -r '
  .metrics.http_req_duration | 
  "  평균: \(.values.avg)ms\n  최소: \(.values.min)ms\n  중간: \(.values.med)ms\n  최대: \(.values.max)ms\n  P90: \(.values["p(90)"])ms\n  P95: \(.values["p(95)"])ms"
'

echo ""

# 성공률
echo "✅ 요청 성공률"
echo "─────────────────────────────────────────"
cat summary.json | jq -r '
  .metrics.http_req_failed | 
  "  실패율: \(.values.rate * 100)%\n  성공률: \((1 - .values.rate) * 100)%"
'

echo ""

# Check 통과율
echo "✔️  Check 통과율"
echo "─────────────────────────────────────────"
cat summary.json | jq -r '
  .metrics.checks | 
  "  통과율: \(.values.rate * 100)%\n  통과: \(.values.passes)개\n  실패: \(.values.fails)개"
'

echo ""
echo "========================================="
echo ""

# HTML 리포트 생성
echo "📄 HTML 리포트 생성 중..."

cat > report.html << 'HTML_EOF'
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoreConnect K6 성능 테스트 결과</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 30px;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        .card h3 {
            color: #667eea;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .metric-row:last-child {
            border-bottom: none;
        }
        .metric-label {
            color: #6c757d;
            font-size: 14px;
        }
        .metric-value {
            font-weight: 600;
            color: #212529;
        }
        .highlight {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .highlight h2 {
            margin-bottom: 10px;
        }
        .success { color: #28a745; font-weight: 600; }
        .warning { color: #ffc107; font-weight: 600; }
        .danger { color: #dc3545; font-weight: 600; }
        .footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 CoreConnect 성능 테스트 결과</h1>
            <p>K6 부하 테스트 분석 리포트</p>
        </div>
        
        <div class="content">
            <div class="highlight">
                <h2>📧 이메일 받은편지함 조회 시간</h2>
                <div id="email-summary"></div>
            </div>

            <div class="metric-grid">
                <div class="card">
                    <h3>📧 이메일 (Email Inbox)</h3>
                    <div id="email-metrics"></div>
                </div>
                
                <div class="card">
                    <h3>💬 채팅 (Chat Latest)</h3>
                    <div id="chat-metrics"></div>
                </div>
                
                <div class="card">
                    <h3>🔔 알림 (Notification)</h3>
                    <div id="notif-metrics"></div>
                </div>
            </div>

            <div class="card">
                <h3>📊 전체 통계</h3>
                <div id="overall-stats"></div>
            </div>
        </div>

        <div class="footer">
            <p>Generated by K6 Performance Test | CoreConnect Project</p>
        </div>
    </div>

    <script>
        fetch('summary.json')
            .then(res => res.json())
            .then(data => {
                const metrics = data.metrics;

                // 이메일 하이라이트
                const emailMetric = metrics['http_req_duration{type:email_inbox}'];
                if (emailMetric) {
                    const p95 = emailMetric.values['p(95)'].toFixed(2);
                    const avg = emailMetric.values.avg.toFixed(2);
                    document.getElementById('email-summary').innerHTML = `
                        <h3 style="font-size: 24px;">평균: ${avg}ms | P95: ${p95}ms</h3>
                    `;
                }

                // 이메일 상세
                if (emailMetric) {
                    document.getElementById('email-metrics').innerHTML = createMetricRows(emailMetric.values);
                }

                // 채팅 상세
                const chatMetric = metrics['http_req_duration{type:chat_latest}'];
                if (chatMetric) {
                    document.getElementById('chat-metrics').innerHTML = createMetricRows(chatMetric.values);
                }

                // 알림 상세
                const notifMetric = metrics['http_req_duration{type:notif}'];
                if (notifMetric) {
                    document.getElementById('notif-metrics').innerHTML = createMetricRows(notifMetric.values);
                }

                // 전체 통계
                const overallMetric = metrics.http_req_duration;
                const checksMetric = metrics.checks;
                const failedMetric = metrics.http_req_failed;

                let overallHTML = createMetricRows(overallMetric.values);
                overallHTML += `
                    <div class="metric-row">
                        <span class="metric-label">성공률</span>
                        <span class="metric-value ${(1 - failedMetric.values.rate) >= 0.95 ? 'success' : 'danger'}">
                            ${((1 - failedMetric.values.rate) * 100).toFixed(2)}%
                        </span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Check 통과율</span>
                        <span class="metric-value ${checksMetric.values.rate >= 0.95 ? 'success' : 'danger'}">
                            ${(checksMetric.values.rate * 100).toFixed(2)}%
                        </span>
                    </div>
                `;
                document.getElementById('overall-stats').innerHTML = overallHTML;
            });

        function createMetricRows(values) {
            return `
                <div class="metric-row">
                    <span class="metric-label">평균 (Avg)</span>
                    <span class="metric-value">${values.avg.toFixed(2)} ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">최소 (Min)</span>
                    <span class="metric-value">${values.min.toFixed(2)} ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">중간 (Med)</span>
                    <span class="metric-value">${values.med.toFixed(2)} ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">최대 (Max)</span>
                    <span class="metric-value">${values.max.toFixed(2)} ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P90</span>
                    <span class="metric-value">${values['p(90)'].toFixed(2)} ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P95</span>
                    <span class="metric-value">${values['p(95)'].toFixed(2)} ms</span>
                </div>
            `;
        }
    </script>
</body>
</html>
HTML_EOF

echo "✅ report.html 생성 완료!"
echo ""

EOF

chmod +x analyze_results.sh
./analyze_results.sh

echo ""
echo "========================================="
echo "✅ 완료!"
echo "========================================="
echo ""
echo "📊 결과 파일:"
echo "  - summary.json : JSON 형식 요약"
echo "  - results.json : 전체 결과 (타임라인)"
echo "  - report.html  : HTML 대시보드"
echo ""
echo "🌐 HTML 리포트 보기:"
echo "  report.html 파일을 다운로드해서 브라우저로 열어보세요!"
echo ""















