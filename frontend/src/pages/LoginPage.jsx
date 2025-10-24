import React from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";

export default function LoginPage({ setIsLoggedIn }) {
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    navigate("/home");
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>CoreConnect 로그인</h2>
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
}
