import http from "../../../api/http";

/** 미읽은 알림 요약 조회 (최근 알림 1개 + 개수) */
export async function getUnreadNotificationSummary() {
  const res = await http.get("/chat/notifications/unread");
  return res.data?.data || null;
}

/**
 * 내 알림 목록 한 페이지 (서버 NotificationController, 최신순)
 * @param status "unread"(안 읽은 것만) | "all"(읽은 것도, 항목의 readYn으로 구분)
 * @returns {content: [...], page, last}
 */
export async function getNotificationPage(status = "unread", page = 0, size = 20) {
  const res = await http.get("/notification", { params: { status, page, size } });
  return res.data?.data || { content: [], page: 0, last: true };
}

/** 나에게 온 전체 알림 조회 (최신순) — 제한 없이 전부 받음, 화면에서는 getNotificationPage 사용 */
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

