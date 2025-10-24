const API_BASE = "http://localhost:8080/api/auth";

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ Refresh 쿠키 받기
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("로그인 실패");
  return await res.json(); // { accessToken, user: {...} }
}

export async function refreshAccessToken() {
  const res = await fetch(`${API_BASE}/refresh`, {
    method: "POST",
    credentials: "include", // ✅ Refresh 쿠키 전송
  });
  if (!res.ok) throw new Error("재발급 실패");
  return await res.json();
}

export async function logout() {
  await fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
}
