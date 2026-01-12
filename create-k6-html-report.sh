#!/bin/bash

# K6 테스트 결과를 HTML 리포트로 변환하는 스크립트
# 사용법: ./create-k6-html-report.sh [json_file]

JSON_FILE="$1"

if [ -z "$JSON_FILE" ]; then
    echo "사용법: $0 <json_file>"
    echo "예시: $0 k6-web-reports/result_20251216_210042.json"
    exit 1
fi

if [ ! -f "$JSON_FILE" ]; then
    echo "❌ JSON 파일을 찾을 수 없습니다: $JSON_FILE"
    exit 1
fi

HTML_FILE="${JSON_FILE%.json}.html"

cat > "$HTML_FILE" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>K6 부하 테스트 리포트</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            margin-bottom: 30px;
            text-align: center;
        }
        h1 { color: #333; font-size: 42px; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 18px; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            text-align: center;
        }
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 50px rgba(0,0,0,0.2);
        }
        .metric-label {
            color: #999;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .metric-value {
            font-size: 48px;
            font-weight: bold;
            color: #333;
            line-height: 1;
        }
        .metric-unit {
            font-size: 16px;
            color: #999;
            margin-top: 5px;
        }
        .success { color: #10b981; }
        .warning { color: #f59e0b; }
        .info { color: #3b82f6; }
        .error { color: #ef4444; }
        .section {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            margin-bottom: 30px;
        }
        h2 {
            color: #333;
            margin-bottom: 25px;
            font-size: 28px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        .scenarios-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .scenario-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .performance-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .performance-table th {
            background: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: #333;
            border-bottom: 2px solid #dee2e6;
        }
        .performance-table td {
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
            color: #666;
        }
        .performance-table tr:hover {
            background: #f8f9fa;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-pass { background: #d1fae5; color: #065f46; }
        .status-fail { background: #fee2e2; color: #991b1b; }
        .timestamp {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #666;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 K6 부하 테스트 리포트</h1>
            <div class="subtitle">CoreConnect 성능 테스트 결과</div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">총 HTTP 요청</div>
                <div class="metric-value info" id="total-requests">-</div>
                <div class="metric-unit">requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">총 반복 수</div>
                <div class="metric-value info" id="iterations">-</div>
                <div class="metric-unit">iterations</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">체크 성공</div>
                <div class="metric-value success" id="checks-passed">-</div>
                <div class="metric-unit" id="check-rate">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">최대 가상 사용자</div>
                <div class="metric-value" id="vus">-</div>
                <div class="metric-unit">VUs</div>
            </div>
        </div>

        <div class="section">
            <h2>🎯 테스트 시나리오</h2>
            <div class="scenarios-grid" id="scenarios">
                <div class="loading">데이터 로딩 중...</div>
            </div>
        </div>

        <div class="section">
            <h2>⚡ 성능 메트릭</h2>
            <table class="performance-table">
                <thead>
                    <tr>
                        <th>메트릭</th>
                        <th>평균</th>
                        <th>최소</th>
                        <th>최대</th>
                        <th>P95</th>
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody id="performance-metrics">
                    <tr><td colspan="6" class="loading">데이터 로딩 중...</td></tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📈 상세 통계</h2>
            <div id="detailed-stats"></div>
            <div class="timestamp">
                리포트 생성 시간: <span id="timestamp"></span>
            </div>
        </div>
    </div>

    <script>
        const jsonFile = 'JSONFILE_PLACEHOLDER';
        
        fetch(jsonFile)
            .then(response => response.text())
            .then(text => {
                const lines = text.trim().split('\n');
                const metrics = {
                    http_reqs: 0,
                    iterations: 0,
                    checks_passed: 0,
                    checks_total: 0,
                    vus: 0,
                    http_req_duration: [],
                    scenarios: new Set()
                };

                lines.forEach(line => {
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.type === 'Point') {
                            const metric = data.metric;
                            const value = data.data?.value || 0;
                            
                            if (metric === 'http_reqs') metrics.http_reqs += value;
                            if (metric === 'iterations') metrics.iterations += value;
                            if (metric === 'vus') metrics.vus = Math.max(metrics.vus, value);
                            if (metric === 'checks') {
                                if (value === 1) metrics.checks_passed++;
                                metrics.checks_total++;
                            }
                            if (metric === 'http_req_duration') {
                                metrics.http_req_duration.push(value);
                            }
                            
                            if (data.data?.tags?.scenario) {
                                metrics.scenarios.add(data.data.tags.scenario);
                            }
                        }
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                });

                // Update main metrics
                document.getElementById('total-requests').textContent = metrics.http_reqs.toLocaleString();
                document.getElementById('iterations').textContent = metrics.iterations.toLocaleString();
                document.getElementById('checks-passed').textContent = metrics.checks_passed.toLocaleString();
                
                const checkRate = metrics.checks_total > 0 
                    ? ((metrics.checks_passed / metrics.checks_total) * 100).toFixed(2) 
                    : 0;
                document.getElementById('check-rate').textContent = `${checkRate}% 성공률`;
                document.getElementById('vus').textContent = metrics.vus;

                // Scenarios
                let scenariosHTML = '';
                if (metrics.scenarios.size > 0) {
                    metrics.scenarios.forEach(scenario => {
                        scenariosHTML += `<div class="scenario-badge">${scenario}</div>`;
                    });
                } else {
                    scenariosHTML = '<div>시나리오 데이터 없음</div>';
                }
                document.getElementById('scenarios').innerHTML = scenariosHTML;

                // Performance metrics
                if (metrics.http_req_duration.length > 0) {
                    const sorted = metrics.http_req_duration.sort((a, b) => a - b);
                    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
                    const min = sorted[0];
                    const max = sorted[sorted.length - 1];
                    const p95 = sorted[Math.floor(sorted.length * 0.95)];
                    
                    const status = avg < 1000 ? 'pass' : 'fail';
                    const statusText = avg < 1000 ? '✓ 양호' : '✗ 개선 필요';
                    
                    document.getElementById('performance-metrics').innerHTML = `
                        <tr>
                            <td><strong>HTTP Request Duration</strong></td>
                            <td>${avg.toFixed(2)}ms</td>
                            <td>${min.toFixed(2)}ms</td>
                            <td>${max.toFixed(2)}ms</td>
                            <td>${p95.toFixed(2)}ms</td>
                            <td><span class="status-badge status-${status}">${statusText}</span></td>
                        </tr>
                    `;
                } else {
                    document.getElementById('performance-metrics').innerHTML = 
                        '<tr><td colspan="6">성능 메트릭 데이터 없음</td></tr>';
                }

                // Detailed stats
                document.getElementById('detailed-stats').innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                            <strong>총 요청:</strong> ${metrics.http_reqs.toLocaleString()}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                            <strong>총 반복:</strong> ${metrics.iterations.toLocaleString()}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                            <strong>체크 성공:</strong> ${metrics.checks_passed} / ${metrics.checks_total}
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                            <strong>최대 VUs:</strong> ${metrics.vus}
                        </div>
                    </div>
                `;

                document.getElementById('timestamp').textContent = new Date().toLocaleString('ko-KR');
            })
            .catch(error => {
                console.error('Error loading data:', error);
                document.body.innerHTML = `
                    <div class="container">
                        <div class="section" style="margin-top: 50px;">
                            <h2 style="color: #ef4444;">❌ 데이터 로딩 실패</h2>
                            <p>JSON 파일을 읽을 수 없습니다: ${jsonFile}</p>
                            <p style="margin-top: 20px; color: #666;">
                                웹 서버가 실행 중인지 확인하세요:<br>
                                <code style="background: #f8f9fa; padding: 5px 10px; border-radius: 5px;">
                                    python3 -m http.server 8000
                                </code>
                            </p>
                        </div>
                    </div>
                `;
            });
    </script>
</body>
</html>
HTMLEOF

# JSON 파일명을 HTML에 삽입
JSON_BASENAME=$(basename "$JSON_FILE")
sed -i "s|JSONFILE_PLACEHOLDER|$JSON_BASENAME|g" "$HTML_FILE"

echo ""
echo "=========================================="
echo "  ✅ HTML 리포트 생성 완료!"
echo "=========================================="
echo ""
echo "📂 리포트 파일: $HTML_FILE"
echo ""
echo "🌐 웹 서버 실행 방법:"
echo "   cd $(dirname "$JSON_FILE")"
echo "   cd .."
echo "   python3 -m http.server 8000"
echo ""
echo "🔗 브라우저 접속:"
echo "   http://54.116.26.182:8000/$(dirname "$JSON_FILE")/$(basename "$HTML_FILE")"
echo ""
echo "=========================================="

