import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { connectNotification, disconnectNotification } from "./notificationSocket";
import { useSnackbarContext } from "../../components/utils/SnackbarContext";

// 실시간 알림 Context 생성
const RealtimeNotificationContext = createContext({
  notifications: [],
  pushNotification: () => {},
  clearNotifications: () => {},
  removeRoomNotifications: () => {},
});

export const useRealtimeNotifications = () => useContext(RealtimeNotificationContext);

/**
 * 사용법:
 * - main.jsx에서 앱 루트를 감싸세요:
 *   <RealtimeNotificationProvider>...</RealtimeNotificationProvider>
 */
export function RealtimeNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const { showSnack } = useSnackbarContext();

  const pushNotification = useCallback((payload) => {
    setNotifications(prev => [payload, ...prev].slice(0, 100)); // 최근 100개만
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  // 채팅방을 나가면 그 방 채팅 알림을 목록에서 뺌 (같은 탭: ChatLayout handleLeaveRoom, 다른 탭: 서버 이벤트)
  const removeRoomNotifications = useCallback((roomId) => {
    setNotifications(prev => prev.filter(n => Number(n.roomId) !== Number(roomId)));
  }, []);

  // 알림 타입별 severity
  const typeToSeverity = (type) => {
    switch ((type || "").toUpperCase()) {
      case "NOTICE": return "info";
      case "SCHEDULE": return "success";
      case "APPROVAL": return "warning";
      case "EMAIL": return "info";
      case "CHAT": return "info";
      default: return "info";
    }
  };

  useEffect(() => {
    // access_token이 HttpOnly 쿠키에 있다면, JS에서는 읽을 수 없으니 getCookie/token 관련 없이 무조건 접속만!
    // SockJS가 자동으로 쿠키를 전송하므로 쿼리 파라미터 불필요

    const handleMessage = (payload) => {
      console.log("[Notification WS] message payload ::", payload);

      // 서버가 방 나가기 커밋 뒤 보내는 이벤트: 알림으로 표시하지 않고, 그 방 알림만 목록에서 지움
      if (payload?.type === "CHAT_ROOM_NOTIFICATIONS_REMOVED") {
        removeRoomNotifications(payload.roomId);
        return;
      }

      const notif = {
        id: payload.notificationId || payload.id || `${Date.now()}`,
        type: payload.notificationType || payload.type || "NOTICE",
        message: payload.message || payload.body || (payload.raw ? String(payload.raw) : ""),
        senderName: payload.senderName || payload.sender || "",
        createdAt: payload.createdAt || new Date().toISOString(),
        roomId: payload.roomId || null, // 채팅 알림용 roomId
        raw: payload
      };
      pushNotification(notif);
      
      // SnackbarContext를 사용하여 알림 표시
      const message = notif.senderName 
        ? `${notif.senderName} — ${notif.message}`
        : notif.message;
      showSnack(message, typeToSeverity(notif.type));
      
      // 채팅 알림이 오면 자동으로 채팅방으로 이동하던 코드는 제거함
      // - 지금까지는 서버가 roomId를 보내지 않아 실행된 적이 없었음
      // - 서버가 roomId를 채우면서 실행되면, 다른 화면에서 일하던 사용자가 0.5초 뒤 강제로 이동하게 됨
      // - 알림을 "눌렀을 때" 이동은 NotificationPopover에서 그대로 처리
};

    // SockJS를 사용하여 상대 경로로 연결 (Vite 프록시를 통해 쿠키 자동 전송)
    connectNotification({ onMessage: handleMessage });

    return () => {
      // 컴포넌트 언마운트 시 연결 해제
      try {
        disconnectNotification();
      } catch (err) {
        console.warn("[RealtimeNotificationProvider] cleanup 중 오류 (무시):", err);
      }
    };
  }, [pushNotification, removeRoomNotifications, showSnack]); // showSnack 추가

  return (
    <RealtimeNotificationContext.Provider value={{ notifications, pushNotification, clearNotifications, removeRoomNotifications }}>
      {children}
    </RealtimeNotificationContext.Provider>
  );
}

export default RealtimeNotificationProvider;