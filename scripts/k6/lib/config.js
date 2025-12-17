import { SharedArray } from 'k6/data';

function parseJsonEnv(name, fallbackValue) {
  const raw = __ENV[name];
  if (!raw || String(raw).trim() === '') return fallbackValue;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in env ${name}: ${e.message}`);
  }
}

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
export const API_PREFIX = (__ENV.API_PREFIX || '/api/v1').startsWith('/')
  ? (__ENV.API_PREFIX || '/api/v1')
  : `/${__ENV.API_PREFIX || 'api/v1'}`;
export const API_BASE = `${BASE_URL}${API_PREFIX.replace(/\/$/, '')}`;

export const USERS = new SharedArray('users', () => {
  const defaultUsers = [{ email: 'admin@example.com', password: '1' }];
  const users = parseJsonEnv('K6_USERS', defaultUsers);
  if (!Array.isArray(users) || users.length === 0) return defaultUsers;
  return users.map((u) => ({
    email: u.email,
    password: String(u.password),
  }));
});

export const SLEEP_MIN = Number(__ENV.SLEEP_MIN || 0.2);
export const SLEEP_MAX = Number(__ENV.SLEEP_MAX || 1.0);

export const EMAIL_WRITE_RATIO = Number(__ENV.EMAIL_WRITE_RATIO || 0); // 0~1
export const ENABLE_EMAIL_SEND = String(__ENV.ENABLE_EMAIL_SEND || 'false').toLowerCase() === 'true';
export const CHAT_CREATE_ROOM_IF_NONE = String(__ENV.CHAT_CREATE_ROOM_IF_NONE || 'true').toLowerCase() === 'true';
export const NOTIFICATION_PUSH_TEST_RATIO = Number(__ENV.NOTIFICATION_PUSH_TEST_RATIO || 0.1); // 0~1
