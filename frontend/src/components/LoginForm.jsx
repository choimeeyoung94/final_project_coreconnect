import React, { useState } from "react";
import { login } from "../api/authAPI";
import { setAccessToken } from "../utils/tokenUtils";
import "../login.css";

export default function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, pw);
      setAccessToken(data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user)); // 유저 저장
      onLoginSuccess();
    } catch {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <input type="text" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} />
      {error && <div className="error-msg">{error}</div>}
      <button type="submit" className="login-btn">로그인</button>
    </form>
  );
}
