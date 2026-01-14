// ============================================
// 공통: API 클라이언트
// ============================================

import http from 'k6/http';
import { check } from 'k6';

// 환경 변수에서 Base URL 가져오기
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/ws';

/**
 * 로그인
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {string|null} JWT 토큰 또는 null
 */
export function login(email, password) {
    const payload = JSON.stringify({
        email: email,
        password: password
    });
    
    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: '30s',
    };
    
    const response = http.post(`${BASE_URL}/api/v1/auth/login`, payload, params);
    
    const success = check(response, {
        'login status is 200': (r) => r.status === 200,
        'response has token': (r) => r.json('token') !== undefined,
    });
    
    if (!success) {
        console.error(`Login failed for ${email}: ${response.status} ${response.body}`);
        return null;
    }
    
    return response.json('token');
}

/**
 * 채팅방 목록 조회
 * @param {string} token - JWT 토큰
 * @returns {object} HTTP 응답
 */
export function getChatRooms(token) {
    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        timeout: '30s',
    };
    
    return http.get(`${BASE_URL}/api/chatrooms`, params);
}

/**
 * 채팅방 생성
 * @param {string} token - JWT 토큰
 * @param {string} name - 채팅방 이름
 * @param {array} userIds - 참여자 ID 배열
 * @returns {object} HTTP 응답
 */
export function createChatRoom(token, name, userIds) {
    const payload = JSON.stringify({
        name: name,
        userIds: userIds
    });
    
    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        timeout: '30s',
    };
    
    return http.post(`${BASE_URL}/api/chatrooms`, payload, params);
}

/**
 * 메시지 히스토리 조회
 * @param {string} token - JWT 토큰
 * @param {number} roomId - 채팅방 ID
 * @param {number} page - 페이지 번호
 * @param {number} size - 페이지 크기
 * @returns {object} HTTP 응답
 */
export function getMessages(token, roomId, page = 0, size = 100) {
    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        timeout: '30s',
    };
    
    return http.get(`${BASE_URL}/api/chatrooms/${roomId}/messages?page=${page}&size=${size}`, params);
}

/**
 * 알림 목록 조회
 * @param {string} token - JWT 토큰
 * @returns {object} HTTP 응답
 */
export function getNotifications(token) {
    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        timeout: '30s',
    };
    
    return http.get(`${BASE_URL}/api/notifications`, params);
}
