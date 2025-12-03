/** 로그인 상태를 관리하고 로그아웃 기능을 제공하기 위한 커스텀 훅
 *  로그인 여부를 서버 API 호출로 판단하고, 그 결과를 isLoggedIn 상태로 관리하는 훅 
 */

import { useState, useEffect } from "react";
import { logout as logoutApi } from "../features/auth/api/authAPI";
import { getMyProfileInfo } from "../features/user/api/userAPI";
import { clearAuthCache } from "../features/auth/utils/authUtils";

export default function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true); // 초기 인증 확인 중인지 여부

  // 서버 API로 인증 상태 확인
  useEffect(() => {
    let isMounted = true; // 컴포넌트가 마운트되어 있는지 확인하는 플래그
    
    const checkAuth = async () => {
      try {
        setIsChecking(true);
        // 인증이 필요한 API 호출로 로그인 상태 확인
        await getMyProfileInfo();
        // 컴포넌트가 마운트되어 있을 때만 상태 업데이트
        if (isMounted) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        // 401 또는 기타 에러 시 비로그인 상태
        // http.js에서 이미 리다이렉트를 처리하므로 여기서는 조용히 처리
        if (isMounted) {
          setIsLoggedIn(false);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();
    
    // cleanup 함수: 컴포넌트 언마운트 시 플래그 설정
    return () => {
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      // 서버에서 로그아웃 요청해서 access_token / refresh_token 쿠키 제거
      await logoutApi();
    } catch (error) {
      console.error("로그아웃 API 호출 실패:", error);
    }
    // 사용자 정보 캐시 초기화
    clearAuthCache();
    setIsLoggedIn(false);
  };

  return { isLoggedIn, setIsLoggedIn, logout, isChecking };
}
