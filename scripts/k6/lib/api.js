import http from 'k6/http';
import { API_BASE } from './config.js';

export function get(path, params = {}) {
  return http.get(`${API_BASE}${path}`, params);
}

export function postJson(path, body, params = {}) {
  return http.post(`${API_BASE}${path}`, JSON.stringify(body), {
    ...params,
    headers: { 'Content-Type': 'application/json', ...(params.headers || {}) },
  });
}

export function patchJson(path, body, params = {}) {
  return http.patch(`${API_BASE}${path}`, JSON.stringify(body), {
    ...params,
    headers: { 'Content-Type': 'application/json', ...(params.headers || {}) },
  });
}

export function patchEmpty(path, params = {}) {
  // Some endpoints (e.g. PATCH read markers) don't accept/need a JSON body.
  // k6 requires a body argument for PATCH, so send an empty string.
  return http.patch(`${API_BASE}${path}`, '', {
    ...params,
    headers: { ...(params.headers || {}) },
  });
}

export function putJson(path, body, params = {}) {
  return http.put(`${API_BASE}${path}`, JSON.stringify(body), {
    ...params,
    headers: { 'Content-Type': 'application/json', ...(params.headers || {}) },
  });
}

export function postRaw(path, rawBody, params = {}) {
  return http.post(`${API_BASE}${path}`, rawBody, params);
}
