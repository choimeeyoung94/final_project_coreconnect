import http from 'k6/http';
import { check } from 'k6';
import { API_BASE, USERS } from './config.js';

let session = null;

function userForVu() {
  // __VU is 1-based; spread users across VUs
  const idx = (__VU - 1) % USERS.length;
  return USERS[idx];
}

export function ensureLoggedIn() {
  if (session) return session;

  const user = userForVu();
  const loginUrl = `${API_BASE}/auth/login`;

  const res = http.post(
    loginUrl,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/login' },
      redirects: 0,
    }
  );

  check(res, {
    'auth: login status 200': (r) => r.status === 200,
  });

  // Fetch current user profile (id/email) for subsequent API calls
  const profileRes = http.get(`${API_BASE}/user/profile-info`, {
    tags: { name: 'GET /user/profile-info' },
  });

  check(profileRes, {
    'auth: profile-info status 200': (r) => r.status === 200,
  });

  const profile = profileRes.json();

  session = {
    user,
    profile: {
      id: profile?.id ?? profile?.userId,
      email: profile?.email ?? user.email,
      name: profile?.name,
    },
  };

  return session;
}
