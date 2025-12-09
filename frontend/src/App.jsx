import React, { useState, useMemo, useEffect, createContext, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Topbar from "./components/layout/Topbar/Topbar";
import Sidebar from "./components/layout/Sidebar";
import { getMyProfileInfo } from "./features/user/api/userAPI";
import {
  fetchInboxCount,
  fetchUnreadCount,
  fetchDraftbox,
  fetchFavoriteCount,
} from "./features/email/api/emailApi";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Box, CssBaseline } from "@mui/material";
import useAuth from "./hooks/useAuth";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
// ----------- 채팅 컴포넌트 import 추가 -----------
import { getMyPendingApprovalCount } from "./features/dashboard/api/dashboardAPI";
import { fetchChatRoomsLatest } from "./features/chat/api/ChatRoomApi";
// ----------- 알림 API import 추가 -----------
import { getAllUnreadNotifications } from "./features/notification/api/notificationAPI";
import { useRealtimeNotifications } from "./features/notification/RealtimeNotificationProvider";
// -----------------------------------------------

export const MailCountContext = createContext();
export const UserProfileContext = createContext(null);
export const ApprovalCountContext = createContext();

const themeOptions = {
  light: {
    name: "라이트",
    palette: {
      mode: "light",
      primary: { main: "#08a7bf" },
      background: { default: "#f5f5f5", paper: "#ffffff", secondary: "#f5f5f5" },
      divider: "rgba(0, 0, 0, 0.12)",
    },
  },
  dark: {
    name: "다크",
    palette: {
      mode: "dark",
      primary: { main: "#08a7bf" },
      background: { default: "#121212", paper: "#1e1e1e", secondary: "#2d2d2d" },
      text: {
        primary: "rgba(255, 255, 255, 0.87)",
        secondary: "rgba(255, 255, 255, 0.6)",
      },
      divider: "rgba(255, 255, 255, 0.12)",
    },
  },
  pink: {
    name: "핑크",
    palette: {
      mode: "light",
      primary: { main: "#ec4899" },
      background: { default: "#fdd3efff", paper: "#ffffff", secondary: "#fce4f0" },
      divider: "rgba(0, 0, 0, 0.12)",
    },
  },
  blue: {
    name: "블루",
    palette: {
      mode: "light",
      primary: { main: "#1976d2" },
      background: { default: "#e3f2fd", paper: "#ffffff", secondary: "#e1eff9" },
      divider: "rgba(0, 0, 0, 0.12)",
    },
  },
  green: {
    name: "그린",
    palette: {
      mode: "light",
      primary: { main: "#2e7d32" },
      background: { default: "#e8f5e9", paper: "#ffffff", secondary: "#e1f5e4" },
      divider: "rgba(0, 0, 0, 0.12)",
    },
  },

};

function App() {
  const [userProfile, setUserProfile] = useState(null);

  const [inboxCount, setInboxCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const navigate = useNavigate();

  // 실시간 알림 구독
  const { notifications } = useRealtimeNotifications();

  // ------------ 채팅 상태 추가 -------------
  const [chatRoomList, setChatRoomList] = useState([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  // --------------------------------------------

  // 알림 미읽은 개수 상태
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  // 결재 대기 개수 상태
  const [approvalCount, setApprovalCount] = useState(0);

  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem("themeMode");
    return saved && themeOptions[saved] ? saved : "light";
  });

  const theme = useMemo(() => {
    const selectedTheme = themeOptions[themeMode];
    return createTheme({
      palette: {
        ...selectedTheme.palette,
      },
      typography: {
        fontFamily:
        '"Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
    });
  }, [themeMode]);

  // 테마 변경 함수
  const handleThemeChange = newTheme => {
    if (themeOptions[newTheme]) {
      setThemeMode(newTheme);
      localStorage.setItem("themeMode", newTheme);
    }
  };

  // 받은메일함 전체 개수
  const refreshInboxCount = useCallback(async () => {
    const userEmail = userProfile?.email;
    if (!userEmail) return;
    const count = await fetchInboxCount(userEmail);
    setInboxCount(count || 0);
  }, [userProfile?.email]);

  // 받은메일함(안읽은)
  const refreshUnreadCount = useCallback(async () => {
    const userEmail = userProfile?.email;
    if (!userEmail) return;
    const count = await fetchUnreadCount(userEmail);
    setUnreadCount(count || 0);
  }, [userProfile?.email]);

  // 임시보관함(임시저장 개수)
  const refreshDraftCount = useCallback(async () => {
    const userEmail = userProfile?.email;
    if (!userEmail) return setDraftCount(0);

    // 임시보관함 '목록' 조회를 통해 개수 얻음!
    const res = await fetchDraftbox(userEmail, 0, 1); // size=1로 최소만 받아오기
    const count =
      res?.data?.data?.totalElements !== undefined
        ? res.data.data.totalElements
        : 0;
    setDraftCount(count);
  }, [userProfile?.email]);

  // 중요 메일 개수
  const refreshFavoriteCount = useCallback(async () => {
    const userEmail = userProfile?.email;
    if (!userEmail) return;
    const count = await fetchFavoriteCount(userEmail);
    setFavoriteCount(count || 0);
  }, [userProfile?.email]);

  const refreshApprovalCount = useCallback(async () => {
    const userEmail = userProfile?.email;
    if (!userEmail) return;
    try {
      const count = await getMyPendingApprovalCount();
      setApprovalCount(count || 0);
    } catch (e) {
      console.warn("결재 대기 개수 조회 실패:", e);
    }
  }, [userProfile?.email]);

  // 알림 미읽은 개수 새로고침
  const refreshNotificationCount = useCallback(async () => {
    try {
      const allNotifications = await getAllUnreadNotifications();
      const count = Array.isArray(allNotifications) ? allNotifications.length : 0;
      setNotificationUnreadCount(count);
    } catch (e) {
      console.warn("알림 개수 조회 실패:", e);
      setNotificationUnreadCount(0);
    }
  }, []);

  // 알림 개수 직접 업데이트 (NotificationPopover에서 개수를 전달받을 때 사용)
  const updateNotificationCount = useCallback((count) => {
    setNotificationUnreadCount(count || 0);
  }, []);

  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // 프로필 정보 로딩
  useEffect(() => {
    (async () => {
      try {
        const profileData = await getMyProfileInfo();
        setUserProfile(profileData);
      } catch (e) {
        console.warn("프로필 정보 불러오기 실패:", e);
      }
    })();
  }, []);

  // 채팅방 목록 및 읽지 않은 메시지 개수 로드
  const refreshChatRooms = async () => {
    try {
      const data = await fetchChatRoomsLatest();
      const rooms = data?.data || [];
      setChatRoomList(rooms);
      // 안읽은 메시지의 총 개수 계산 (각 채팅방의 unreadCount 합계)
      const totalUnreadCount = rooms.reduce((sum, room) => {
        return sum + (room?.unreadCount || 0);
      }, 0);
      setChatUnreadCount(totalUnreadCount);
    } catch (e) {
      console.warn("채팅방 목록 불러오기 실패:", e);
      setChatRoomList([]);
      setChatUnreadCount(0);
    }
  };

  // 최초 마운트 시 개수 상태 동기화 (받은메일함+안읽은+임시보관+중요메일+채팅+알림)
  useEffect(() => {
    if (userProfile?.email) {
      refreshInboxCount();
      refreshUnreadCount();
      refreshDraftCount();
      refreshFavoriteCount();
      refreshApprovalCount();
      refreshChatRooms();
      refreshNotificationCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.email]);

  // 실시간 알림 수신 시 알림 개수 증가
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // 실시간 알림이 올 때마다 알림 개수 새로고침
      refreshNotificationCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications?.length]);

  // context value: count, set, refresh 함수
  // useMemo를 사용하여 항상 동일한 객체 참조를 유지하고, userProfile이 없어도 기본값 제공
  const mailCountContextValue = useMemo(() => ({
    inboxCount: inboxCount || 0,
    refreshInboxCount,
    unreadCount: unreadCount || 0,
    refreshUnreadCount,
    setUnreadCountDirectly: setUnreadCount,
    draftCount: draftCount || 0,
    refreshDraftCount,
    favoriteCount: favoriteCount || 0,
    refreshFavoriteCount,
  }), [inboxCount, unreadCount, draftCount, favoriteCount, refreshInboxCount, refreshUnreadCount, refreshDraftCount, refreshFavoriteCount]);

  const approvalCountContextValue = useMemo(() => ({
    approvalCount: approvalCount || 0,
    refreshApprovalCount
  }), [approvalCount, refreshApprovalCount]);

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <CssBaseline />
        <UserProfileContext.Provider value={useMemo(() => ({ userProfile, setUserProfile }), [userProfile])}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
              bgcolor: "background.default",
            }}
          >
            {/* ----------- Topbar(채팅아이콘 추가) ------------ */}
            <Topbar 
              onLogout={handleLogout}
              themeMode={themeMode}
              themeOptions={themeOptions}
              onThemeChange={handleThemeChange}
              chatRoomList={chatRoomList}
              chatUnreadCount={chatUnreadCount}
              refreshChatRooms={refreshChatRooms}
              notificationUnreadCount={notificationUnreadCount}
              refreshNotificationCount={refreshNotificationCount}
              updateNotificationCount={updateNotificationCount}
            />
            {/* ----------------------------------------------- */}
            {/* MailCountContext Provider */}
            <MailCountContext.Provider value={mailCountContextValue}>
              <ApprovalCountContext.Provider value={approvalCountContextValue}>
                <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
                  <Sidebar />
                  <Box
                    component="main"
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      bgcolor: "background.default",
                    }}
                  >
                    <Outlet context={{ refreshUnreadCount }} />
                  </Box>
                </Box>
              </ApprovalCountContext.Provider>
            </MailCountContext.Provider>

          </Box>
        </UserProfileContext.Provider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;