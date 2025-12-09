/**
 * ============================================================
 * SnackbarContext.jsx
 * ------------------------------------------------------------
 * useSnackbar 훅을 전역 Context로 연결.
 * ------------------------------------------------------------
 * - 모든 페이지에서 showSnack("문구", "success") 호출만으로 알림 표시 가능
 * - Snackbar의 위치, 크기, 스타일을 전역에서 통일 관리
 * ============================================================
 */

import React, { createContext, useContext } from "react";
import { Snackbar, Alert } from "@mui/material";
import useSnackbar from "../../hooks/useSnackbar";

// Context 생성
const SnackbarContext = createContext(null);

/** Provider 컴포넌트 */
export function SnackbarProvider({ children }) {
  const { snack, showSnack, closeSnack } = useSnackbar();

  return (
    <SnackbarContext.Provider value={{ showSnack, closeSnack }}>
      {children}

      {/* 전역 Snackbar UI */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          "& .MuiSnackbarContent-root": {
            width: "480px",        // 가로
            minHeight: "72px",     // 세로
            borderRadius: "12px",
            fontSize: "1rem",
          },
        }}
      >
        <Alert
          onClose={closeSnack}
          severity={snack.severity}
          variant="filled"
          sx={{
            width: "100%",
            fontSize: "1.05rem",
            py: 2,
            px: 3,
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)", // 그림자 효과
            backgroundColor:
              snack.severity === "success" ? "#08a7bf" : // 하늘
              snack.severity === "error"   ? "#c62828" : // 빨강
              snack.severity === "warning" ? "#ff7b00ff" : // 주황
              "#08a7bf", // info
          }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

/** Context 사용 훅 (전역 접근용) */
export function useSnackbarContext() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbarContext는 SnackbarProvider 내부에서만 사용 가능합니다.");
  }
  return context;
}
