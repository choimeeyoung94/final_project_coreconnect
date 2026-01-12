#!/bin/bash

# Grafana Cloud K6 토큰 설정
export K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504"

echo "========================================="
echo "K6 Cloud 로그인 중..."
echo "========================================="
k6 cloud login

echo ""
echo "========================================="
echo "K6 Cloud 테스트 실행 중..."
echo "========================================="
k6 run --out cloud test.js

echo ""
echo "========================================="
echo "테스트 완료!"
echo "Grafana Cloud에서 결과를 확인하세요:"
echo "https://choimeeyoung2.grafana.net/a/k6-app/"
echo "========================================="

