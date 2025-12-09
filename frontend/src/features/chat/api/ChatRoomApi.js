// ChatRoomApi.js
import http from '../../../api/http'; // http.js의 instance를 import

// 채팅방별 마지막 메시지 목록 가져오기
export async function fetchChatRoomsLatest() {
  // 실제 요청: GET /api/v1/chat/rooms/messages/latest
  const res = await http.get("/chat/rooms/messages/latest");
  return res.data;
}

// 채팅방별 전체 메시지 (roomId 기준) - 페이징 지원
export async function fetchChatRoomMessages(roomId, page = 0, size = 20) {
  const res = await http.get(`/chat/${roomId}/messages`, {
    params: { page, size }
  });
  return res.data;
}

// 내가 참여중인 채팅방의 안읽은 메시지 개수/목록 조회
export async function fetchUnreadmessages() {
  // 실제 요청: GET /api/v1/chat/messages/unread
  const res = await http.get("/chat/messages/unread");
  return res.data;
}

// 채팅바에서 모든 메시지를 읽음처리 (PATCH)
// ⭐ 쿠키 기반 인증 사용 (http.js에서 withCredentials: true 설정)
// Authorization 헤더는 불필요하며, 쿠키로 자동 인증됨
export const markRoomMessagesAsRead = async (roomId) => {
  // PATCH /api/v1/chat/rooms/{roomId}/messages/read
  const res = await http.patch(`/chat/rooms/${roomId}/messages/read`);
  return res.data;
}

// 채팅방 생성 API (POST)
// body: { roomName, roomType, userIds }, accessToken(optional)
// ★ 채팅방 생성 (반드시 http 인스턴스 사용, fetch X)
export async function createChatRoom(data) {
  const res = await http.post("chat", data);
  // 백엔드 응답 구조: ResponseEntity<ChatRoomResponseDTO>
  // Spring이 자동으로 JSON 변환: { "id": ..., "roomName": ..., ... }
  // axios는 res.data에 응답 본문을 담음
  // ResponseDTO로 감싸져 있으면 res.data.data, 아니면 res.data
  return res.data; // { id, roomName, roomType, ... } 또는 { data: { id, ... } }
}

// 채팅방 참여자 목록 조회 API
export async function fetchChatRoomUsers(roomId) {
  const res = await http.get(`/chat/${roomId}/users`);
  // ⭐ ResponseDTO 구조: { status: 200, message: "...", data: List<ChatUserResponseDTO> }
  // 실제 리스트는 res.data.data에 있음
  return res.data?.data || res.data || [];
}

// 채팅방 나가기 API
export async function leaveChatRoom(roomId) {
  const res = await http.delete(`/chat/${roomId}/leave`);
  return res.data;
}