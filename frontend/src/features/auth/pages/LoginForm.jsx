import React, { useState, useEffect } from "react";
import { login } from "../../auth/api/authAPI";
import { createPasswordResetRequest } from "../../user/api/passwordResetAPI";
import { clearAuthCache } from "../utils/authUtils";
import { resetRedirectFlag } from "../../../api/http";
import {
  Box, TextField, Button, IconButton, InputAdornment,
  Stack, Checkbox, FormControlLabel, Link,
} from "@mui/material";
import { Visibility, VisibilityOff, Close as CloseIcon } from "@mui/icons-material";
import PasswordResetDialog from "../components/PasswordResetDialog";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";

export default function LoginForm({ onLoginSuccess }) {
  const { showSnack } = useSnackbarContext();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(() => {
    // savedEmail이 있으면 true, 없으면 false
    return !!localStorage.getItem("savedEmail");
  });
  const [resetOpen, setResetOpen] = useState(false);

  // 처음 렌더 시 savedEmail 복원
  useEffect(() => {
    const saved = localStorage.getItem("savedEmail");
    if(saved) setEmail(saved);
  }, []);

  const handleOpenReset = () => {
    setResetOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if(!email.trim() || !pw.trim()) {
      showSnack("아이디와 비밀번호를 모두 입력해주세요.", "error");
      return;
    }
    
    try {
      // 로그인 성공 시 이전 사용자 정보 캐시 초기화
      clearAuthCache();
      
      const data = await login(email, pw);
      
      // 로그인 성공 시 리다이렉트 플래그 리셋
      resetRedirectFlag();

      if(remember) {
        localStorage.setItem("savedEmail", email);
      } else {
        localStorage.removeItem("savedEmail");
      }

      // onLoginSuccess가 존재할 경우에만 호출
      onLoginSuccess?.();
    } catch (e) {
      console.error("에러:", e);
      showSnack("아이디 또는 비밀번호가 올바르지 않습니다.", "error");
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {/* 아이디 */}
        <TextField
          placeholder="아이디"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus
          variant="outlined"
          InputProps={{
            sx: { borderRadius: 2 },
            endAdornment: (
              <InputAdornment position="end">
                {!!email && (
                  <IconButton aria-label="아이디 지우기" onClick={() => setEmail("")} edge="end" tabIndex={-1}>
                    <CloseIcon />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
        />

        {/* 비밀번호 */}
        <TextField
          placeholder="비밀번호"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          fullWidth
          variant="outlined"
          InputProps={{
            sx: { borderRadius: 2 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPw((v) => !v)}
                  edge="end"
                  aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPw ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* 계정 기억 + 비밀번호 초기화 */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <FormControlLabel
            control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} size="small" />}
            label="계정 기억"
            sx={{ "& .MuiFormControlLabel-label": { fontSize: 14 } }}
          />
          <Link component="button" 
                type="button" 
                underline="none" 
                sx={{ fontSize: 14, 
                color: "black"}}
                onClick={handleOpenReset}>
            비밀번호 초기화
          </Link>
        </Box>

        {/* 로그인 버튼 */}
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          sx={{
            borderRadius: 2,
            py: 1.2,
            backgroundColor: "#08a7bf",
            "&:hover": { backgroundColor: "#0693a8" },
          }}
        >
          로그인
        </Button>

        {/* 비밀번호 초기화 요청 모달 */}
        <PasswordResetDialog
          open={resetOpen}
          email={email}
          onClose={() => setResetOpen(false)}
        />
      </Stack>
    </Box>
  );
}
