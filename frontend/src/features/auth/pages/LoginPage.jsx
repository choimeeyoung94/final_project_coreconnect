import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Box, Typography, Container } from "@mui/material";
import LoginForm from "./LoginForm";
import useAuth from "../../../hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isLoggedIn, setIsLoggedIn } = useAuth();

  // 로그인 된 상태로 뒤로가기 눌렀을 때 다시 로그인창으로 이동 방지(대신 /home으로 이동)
  if(isLoggedIn) {
    return <Navigate to="/home" replace />;
  }

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    navigate("/home");
  };

  return (
    <Box sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "#ffffff",   
    }}>
      <Container
        maxWidth="xs"
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        {/* 상단 로고 + 제목 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            mb: 4,
          }}
        >
          <Box 
            component="img" 
            src="/coreconnect-logo.png" 
            alt="logo" 
            onError={(e) => {
              // 로고 로드 실패 시 vite.svg로 fallback
              e.target.src = "/vite.svg";
            }}
            sx={{ height: 70 }} 
          />
          <Typography variant="h3" fontWeight={500}>
            코어커넥트
          </Typography>
        </Box>

        {/* 로그인 폼 */}
        <Box sx={{ width: "100%", px: 3 }}>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </Box>
      </Container>
    </Box>
  );
}
