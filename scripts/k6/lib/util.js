import { SLEEP_MIN, SLEEP_MAX } from './config.js';
import { sleep } from 'k6';

export function randomIntBetween(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars.charAt(randomIntBetween(0, chars.length - 1));
  return out;
}

export function sleepJitter() {
  const minMs = Math.floor(SLEEP_MIN * 1000);
  const maxMs = Math.floor(SLEEP_MAX * 1000);
  const ms = randomIntBetween(minMs, maxMs);
  sleep(ms / 1000);
}

export function pick(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[randomIntBetween(0, arr.length - 1)];
}

export function safeJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

export function buildMultipart(parts) {
  // parts: [{ name, contentType, data, filename? }]
  const boundary = `----k6boundary${randomString(16)}`;
  const lines = [];

  for (const p of parts) {
    lines.push(`--${boundary}`);

    const disp = p.filename
      ? `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"`
      : `Content-Disposition: form-data; name="${p.name}"`;
    lines.push(disp);

    if (p.contentType) lines.push(`Content-Type: ${p.contentType}`);
    lines.push('');
    lines.push(p.data ?? '');
  }

  lines.push(`--${boundary}--`);
  lines.push('');

  return {
    boundary,
    body: lines.join('\r\n'),
  };
}
