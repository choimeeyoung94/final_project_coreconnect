import http from "../../../api/http";

/** 미읽은 알림 요약 조회 (최근 알림 1개 + 개수) */
export async function getUnreadNotificationSummary() {
  const res = await http.get("/chat/notifications/unread");
  return res.data?.data || null;
}

/** 나에게 온 전체 알림 조회 (최신순) */
export async function getMyNotifications() {
  const res = await http.get("/chat/notifications");
  return res.data?.data || [];
}

/** 안읽은 알림 목록 조회 (최근 알림 제외) */
export async function getUnreadNotificationsExceptLatest() {
  const res = await http.get("/chat/unread/list");
  return res.data || [];
}

/** 모든 안읽은 알림 목록 조회 */
export async function getAllUnreadNotifications() {
  const res = await http.get("/chat/notifications/unread/all");
  return res.data?.data || [];
}

/** 알림 읽음 처리 (채팅·결재·메일·일정 공통, 서버 NotificationController) */
export async function markNotificationAsRead(notificationId) {
  const res = await http.put(`/notification/${notificationId}/read`);
  return res.data;
}

/** 모든 알림 읽음 처리 */
export async function markAllNotificationsAsRead() {
  const res = await http.put("/chat/notifications/read-all");
  return res.data;
}

