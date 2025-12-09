import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useLocation } from "react-router-dom";

import { Box } from "@mui/material";
import ChatHeader from "../components/ChatHeader";
import ChatRoomListPane from "../components/ChatRoomListPane";
import ChatDetailPane from "../components/ChatDetailPane";
import ChatRoomCreateDialog from "../components/ChatRoomCreateDialog";
import ToastList from "../components/ToastList";
import { UserProfileContext } from "../../../App";

import {
  markRoomMessagesAsRead,
  fetchChatRoomMessages,
  fetchChatRoomsLatest,
  createChatRoom
} from "../api/ChatRoomApi";

import {
  connectStomp,
  disconnectStomp,
  sendStompMessage
} from "../api/chatSocket";

import http from "../../../api/http";

// ===================== 시간 및 유저명 유틸 함수 =====================
// 시간 포맷팅 유틸 (한국 시간 기준)
function formatTime(sendAt) {
  if (!sendAt) return "";
  
  try {
    let d;
    const dateStr = String(sendAt);
    
    // ISO 8601 형식인 경우 (서버에서 "2025-11-25T00:42:00" 형식으로 보냄)
    if (dateStr.includes('T')) {
      // 타임존 정보가 없으면 한국 시간(UTC+9)으로 간주하여 파싱
      if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
        // "2025-11-25T00:42:00" 형식을 한국 시간으로 파싱
        const [datePart, timePart] = dateStr.split('T');
        const [year, month, day] = datePart.split('-');
        const [timeOnly] = (timePart || '').split('.');
        const [hour, minute, second = '00'] = (timeOnly || '').split(':');
        
        // UTC로 Date 객체 생성 후 한국 시간(UTC+9)으로 변환
        d = new Date(Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        ));
        // 한국 시간은 UTC+9이므로 9시간을 빼서 UTC로 변환
        d = new Date(d.getTime() - (9 * 60 * 60 * 1000));
      } else {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(sendAt);
    }
    
    // 한국 시간으로 변환
    const koreaTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
    const koreaTime = new Date(koreaTimeStr);
    const today = new Date();
    const todayKoreaStr = today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
    const todayKorea = new Date(todayKoreaStr);
    
    const isToday =
      koreaTime.getFullYear() === todayKorea.getFullYear() &&
      koreaTime.getMonth() === todayKorea.getMonth() &&
      koreaTime.getDate() === todayKorea.getDate();
      
    if (isToday) {
      return koreaTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: 'Asia/Seoul' });
    } else {
      const yyyy = koreaTime.getFullYear();
      const mm = String(koreaTime.getMonth() + 1).padStart(2, "0");
      const dd = String(koreaTime.getDate()).padStart(2, "0");
      const hh = String(koreaTime.getHours()).padStart(2, "0");
      const min = String(koreaTime.getMinutes()).padStart(2, "0");
      const ss = String(koreaTime.getSeconds()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    }
  } catch (error) {
    console.error('[ChatLayout] formatTime 에러:', error, sendAt);
    return "";
  }
}

export default function ChatLayout() {
  // ---------- 상태 변수 ----------
  const { userProfile } = useContext(UserProfileContext) || {};
  const [roomList, setRoomList] = useState([]); // 전체 채팅방 목록
  const [selectedRoomId, setSelectedRoomId] = useState(null); // 현재 선택된 방ID
  const [messages, setMessages] = useState([]); // 현재 방 메시지 목록
  const [tabIdx, setTabIdx] = useState(0); // 탭 인덱스
  const [toastRooms, setToastRooms] = useState([]); // 토스트 알림 Rooms
  const [createOpen, setCreateOpen] = useState(false); // 방 생성 다이얼로그 열림 여부
  const [highlightedRoomId, setHighlightedRoomId] = useState(null); // 하이라이팅된 채팅방 ID

  const userName = userProfile?.name || ""; // 유저명
  const inputRef = useRef(); // 입력창 관리 ref

  const [socketConnected, setSocketConnected] = useState(false); // 소켓 연결 상태

  // 페이징 관련 상태
  const [currentPage, setCurrentPage] = useState(0); // 현재 페이지 (0부터 시작)
  const [hasMore, setHasMore] = useState(true); // 더 불러올 메시지가 있는지
  const [isLoadingMore, setIsLoadingMore] = useState(false); // 이전 메시지 로딩 중인지
  const [totalPages, setTotalPages] = useState(0); // 전체 페이지 수
  
  // 안읽은 메시지 위치로 스크롤할지 여부
  const [scrollToUnread, setScrollToUnread] = useState(false);

  // ⭐ 중복 메시지 방지: 최근 처리한 메시지 ID 추적 (동시 호출 방지)
  const processedMessageIdsRef = useRef(new Set());
  const processingMessageIdsRef = useRef(new Set()); // 현재 처리 중인 메시지 ID
  const pendingFileUrlsRef = useRef(new Map()); // 메시지 ID -> fileUrls 매핑 (파일 업로드 응답에서 받은 fileUrls 저장)

  // ⭐ UNREAD_COUNT_UPDATE 대기 큐: 메시지가 아직 로드되지 않은 경우 unreadCount 업데이트 저장
  const pendingUnreadCountUpdatesRef = useRef(new Map()); // chatId -> unreadCount


  const location = useLocation();
  const [presetUser, setPresetUser] = useState(null);
  
  // 쿼리 파라미터에서 roomId 추출 (알림 클릭 시 사용)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomIdFromQuery = searchParams.get('roomId');
    if (roomIdFromQuery) {
      const roomIdNum = Number(roomIdFromQuery);
      if (roomIdNum && !isNaN(roomIdNum)) {
        setSelectedRoomId(roomIdNum);
        // 쿼리 파라미터 제거 (깔끔한 URL 유지)
        window.history.replaceState({}, document.title, location.pathname);
      }
    }
  }, [location.search, location.pathname]);
  
  useEffect(() => {
  if (location.state?.startChatWith) {
    const target = location.state.startChatWith;

   // ChatRoomCreateDialog에서 사용하는 필드에 완전히 맞춰 변환
   setPresetUser([
     {
       id: target.id,         // userId
       userId: target.id,     // 혹시 Dialog가 userId를 쓴다면 대비
       name: target.name,
       email: target.email,
       profileImageUrl: target.profileImageUrl,
       profileUrl: target.profileImageUrl, // 혹시 Dialog가 profileUrl을 쓴다면 대비
     }
   ]);

    setCreateOpen(true);
    window.history.replaceState({}, document.title);
  }
  
  // Topbar에서 채팅방 생성 버튼 클릭 시
  if (location.state?.openCreateDialog) {
    setCreateOpen(true);
    window.history.replaceState({}, document.title);
  }
}, [location]);

  // ---------- 읽지 않은 메시지 총 개수 계산 ----------
  const unreadRoomCount = Array.isArray(roomList)
    ? roomList.reduce((sum, room) => sum + (room?.unreadCount || 0), 0)
    : 0;

  // 채팅방 목록 정렬 함수
  // 우선순위: 1) 최근 생성된 방 (5분 이내) 2) 최근 메시지 시간
  const sortRoomList = (rooms) => {
    const now = new Date().getTime();
    const FIVE_MINUTES = 5 * 60 * 1000; // 5분을 밀리초로

    return [...rooms].sort((a, b) => {
      // 1. 최근 생성된 방 우선 정렬 (5분 이내)
      const aCreatedAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreatedAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const aIsRecent = aCreatedAt > 0 && (now - aCreatedAt) < FIVE_MINUTES;
      const bIsRecent = bCreatedAt > 0 && (now - bCreatedAt) < FIVE_MINUTES;

      if (aIsRecent && !bIsRecent) return -1; // a가 최근 생성
      if (!aIsRecent && bIsRecent) return 1;  // b가 최근 생성
      if (aIsRecent && bIsRecent) {
        // 둘 다 최근 생성이면 생성 시간 기준 내림차순
        return bCreatedAt - aCreatedAt;
      }

      // 2. 최근 메시지 시간 기준 정렬
      const timeA = a.lasMessageTime ? new Date(a.lasMessageTime).getTime() : 0;
      const timeB = b.lasMessageTime ? new Date(b.lasMessageTime).getTime() : 0;

      // 둘 다 메시지가 없으면 생성 시간 기준 (있는 경우만)
      if (timeA === 0 && timeB === 0) {
        if (aCreatedAt > 0 && bCreatedAt > 0) {
          return bCreatedAt - aCreatedAt;
        }
        return 0;
      }

      // 메시지 시간 기준 내림차순
      return timeB - timeA;
    });
  };

  // ---------- 채팅방 생성 ----------
  const handleCreateRoom = async (data) => {
    try {
      const res = await createChatRoom(data);
      // 백엔드 응답 구조: ResponseEntity<ChatRoomResponseDTO> (ResponseDTO로 감싸지 않음)
      // res.data가 바로 ChatRoomResponseDTO: { id, roomName, roomType, ... }
      const room = res?.data || res;
      // 백엔드 DTO는 id 필드를 사용하므로 roomId 대신 id 확인
      const roomId = room?.id || room?.roomId;
      if (!room || !roomId) {
        console.error("응답 데이터:", res);
        throw new Error("응답 데이터 없음");
      }
      // roomId 필드로 통일하여 추가 (다른 곳에서 roomId를 사용하므로)
      const now = new Date().toISOString();
      const roomWithRoomId = {
        ...room,
        roomId: roomId,
        roomName: room.roomName || room.roomName,
        unreadCount: 0,
        lastMessageContent: null,
        lasMessageTime: null,
        lastSenderName: null,
        createdAt: now // 생성 시간 추가 (최근 생성된 방을 맨 위에 표시하기 위해)
      };

      // 새로 생성된 방을 맨 위에 추가하고 정렬
      setRoomList(prev => {
        const updated = [roomWithRoomId, ...prev];
        return sortRoomList(updated);
      });

      // 새로 생성된 방 하이라이팅
      setHighlightedRoomId(roomId);
      // 5초 후 하이라이팅 제거
      setTimeout(() => {
        setHighlightedRoomId(null);
      }, 5000);

      setSelectedRoomId(roomId); // 방 생성시에만 바로 진입
      setCreateOpen(false);
      // 목록 새로고침하여 최신 상태 유지 (백엔드에서 받은 데이터로 동기화)
      // 하이라이팅을 유지하기 위해 selectedRoomId를 보존
      setTimeout(() => loadRooms(true, roomId), 500);
    } catch (error) {
      console.error("채팅방 생성 에러:", error);
      alert("채팅방 생성 에러: " + (error.message || "응답 데이터 없음"));
    }
  };

  // ---------- 새 메시지 도착 처리 (+ 토스트 알림) ----------
  const handleNewMessage = (msg) => {
    // ⭐ handleNewMessage 진입 로그 (모든 메시지 수신 추적)
    const handleNewMessageTimestamp = new Date().toISOString();
    console.log("📨 [ChatLayout] ========== handleNewMessage 진입 ==========", {
      timestamp: handleNewMessageTimestamp,
      fileYn: msg?.fileYn,
      fileUrl: msg?.fileUrl,
      fileUrls: msg?.fileUrls,
      fileUrlsLength: msg?.fileUrls?.length,
      messageType: msg?.type || "일반메시지",
      messageId: msg?.id,
      roomId: msg?.roomId,
      selectedRoomId: selectedRoomId,
      senderEmail: msg?.senderEmail,
      senderName: msg?.senderName,
      unreadCount: msg?.unreadCount,
      chatId: msg?.chatId, // UNREAD_COUNT_UPDATE용
      현재messages배열길이: messages.length,
      메시지전체: msg,
      msgType값: msg?.type,
      msgType타입: typeof msg?.type,
      msgType비교결과: msg?.type === "UNREAD_COUNT_UPDATE"
    });

    // ⭐ unreadCount 업데이트 메시지 처리 (다른 참여자가 메시지를 읽었을 때)
    // ⭐ 중요: msg.type이 정확히 "UNREAD_COUNT_UPDATE"인지 확인
    // ⭐ 중요: 자신이 보낸 메시지도 unreadCount를 업데이트해야 함 (다른 사람이 읽었을 때)
    if (msg && msg.type === "UNREAD_COUNT_UPDATE") {
      // ⭐ 자신이 보낸 메시지인지 확인 (로그용)
      const isMyMessage = msg.senderEmail && userProfile?.email &&
        msg.senderEmail.trim().toLowerCase() === userProfile.email.trim().toLowerCase();

      if (isMyMessage) {
        console.log("📊 [ChatLayout] UNREAD_COUNT_UPDATE 처리 - 자신이 보낸 메시지 (unreadCount 업데이트):", {
          chatId: msg.chatId,
          roomId: msg.roomId,
          senderEmail: msg.senderEmail,
          myEmail: userProfile?.email,
          unreadCount: msg.unreadCount,
          viewerId: msg.viewerId,
          viewerEmail: msg.viewerEmail
        });
        // ⭐ 자신이 보낸 메시지도 unreadCount를 업데이트해야 함 (다른 사람이 읽었을 때)
      }

      console.log("📊 [ChatLayout] ⭐ UNREAD_COUNT_UPDATE 조건 만족! 처리 시작");
      const { chatId, unreadCount, roomId, viewerId, viewerEmail } = msg;

      // ⭐ 디버깅: UNREAD_COUNT_UPDATE 메시지 수신 확인 (상세 로그)
      const timestamp = new Date().toISOString();
      console.log("📊 [ChatLayout] ========== UNREAD_COUNT_UPDATE 수신 ==========", {
        timestamp,
        chatId,
        unreadCount,
        roomId,
        selectedRoomId,
        viewerId,
        viewerEmail,
        현재messages배열길이: messages.length,
        현재messages배열상태: messages.map(m => ({ id: m?.id, unreadCount: m?.unreadCount })),
        메시지전체: msg,
        호출스택: new Error().stack
      });

      // ⭐ 현재 선택된 방의 메시지 목록에서 해당 메시지의 unreadCount 업데이트
      // (다른 참여자가 메시지를 읽었을 때 모든 참여자의 화면에서 unreadCount가 -1씩 감소)
      // 발신자도 자신의 메시지에 대한 unreadCount를 실시간으로 업데이트받아야 함
      if (Number(roomId) === Number(selectedRoomId)) {
        console.log("📊 [ChatLayout] UNREAD_COUNT_UPDATE 처리 시작 - 현재 방의 메시지 업데이트:", {
          chatId,
          unreadCount,
          roomId,
          selectedRoomId,
          messages배열길이: messages.length,
          viewerId,
          viewerEmail
        });

        // ⭐ setMessages 호출 전 상태 확인 (race condition 감지용)
        const beforeSetMessagesState = {
          timestamp: new Date().toISOString(),
          messagesLength: messages.length,
          messagesIds: messages.map(m => ({ id: m?.id, unreadCount: m?.unreadCount })),
          targetChatId: chatId
        };
        console.log("📊 [ChatLayout] setMessages 호출 전 상태:", beforeSetMessagesState);

        setMessages((prev) => {
          // ⭐ setMessages 내부 진입 시점 로그 (race condition 감지)
          const setMessagesTimestamp = new Date().toISOString();
          console.log("📊 [ChatLayout] setMessages 내부 진입:", {
            timestamp: setMessagesTimestamp,
            prev배열길이: prev.length,
            prev배열Ids: prev.map(m => ({ id: m?.id, unreadCount: m?.unreadCount })),
            targetChatId: chatId,
            새로운unreadCount: unreadCount
          });

          // ⭐ 이전 상태에서 해당 메시지 찾기
          // ⭐ m.id가 숫자일 수 있으므로 안전하게 비교
          const targetMessage = prev.find(m => {
            const mId = m?.id;
            const chatIdNum = Number(chatId);
            if (mId == null) return false;
            // 숫자로 변환하여 비교 (문자열과 숫자 모두 처리)
            return Number(mId) === chatIdNum;
          });
          const previousUnreadCount = targetMessage?.unreadCount;

          // ⭐ 메시지를 찾지 못한 경우 대기 큐에 저장
          // 메시지가 아직 로드되지 않았을 수 있으므로, 나중에 로드되면 업데이트됨
          if (!targetMessage) {
            console.warn("📊 [ChatLayout] ⚠️ UNREAD_COUNT_UPDATE: 해당 chatId의 메시지를 찾을 수 없음 (대기 큐에 저장):", {
              timestamp: setMessagesTimestamp,
              chatId,
              unreadCount,
              현재메시지수: prev.length,
              현재메시지Ids: prev.map(m => ({ id: m?.id, type: typeof m?.id, unreadCount: m?.unreadCount }))
            });
            // ⭐ 대기 큐에 저장 (메시지가 로드되면 적용됨)
            pendingUnreadCountUpdatesRef.current.set(Number(chatId), Number(unreadCount));
            return prev;
          }

          // ⭐ 깊은 복사로 불변성 보장 및 정확한 patch
          // ⭐ Number 타입 변환으로 정확한 매핑 보장
          const updated = prev.map((m) => {
            const mId = m?.id;
            const chatIdNum = Number(chatId);
            if (mId == null) return m;
            // 숫자로 변환하여 비교 (문자열과 숫자 모두 처리)
            if (Number(mId) === chatIdNum) {
              // ⭐ 기존 메시지의 모든 속성을 유지하면서 unreadCount만 업데이트
              // ⭐ 깊은 복사로 불변성 보장
              const updatedMsg = {
                ...m,
                unreadCount: unreadCount != null ? Number(unreadCount) : 0
              };
              console.log("📊 [ChatLayout] 메시지 unreadCount 업데이트:", {
                chatId: mId,
                이전unreadCount: m.unreadCount,
                새로운unreadCount: updatedMsg.unreadCount,
                업데이트여부: m.unreadCount !== updatedMsg.unreadCount
              });
              return updatedMsg;
            }
            return m;
          });

          // ⭐ 디버깅: 업데이트된 메시지 확인
          const updatedMessage = updated.find(m => Number(m.id) === Number(chatId));
          console.log("📊 [ChatLayout] ✅ unreadCount 업데이트 완료 (불변성 보장):", {
            timestamp: setMessagesTimestamp,
            chatId,
            이전unreadCount: previousUnreadCount,
            새로운unreadCount: unreadCount,
            업데이트된메시지: updatedMessage,
            전체메시지수: updated.length,
            업데이트여부: previousUnreadCount !== unreadCount,
            발신자여부: updatedMessage?.senderEmail === userProfile?.email,
            messages배열변경여부: prev !== updated, // 불변성 확인
            prev배열참조: prev,
            updated배열참조: updated
          });

          return updated;
        });

        // ⭐ setMessages 호출 후 상태 확인 (race condition 감지용)
        setTimeout(() => {
          console.log("📊 [ChatLayout] setMessages 호출 후 상태 확인 (비동기):", {
            timestamp: new Date().toISOString(),
            messagesLength: messages.length,
            messagesIds: messages.map(m => ({ id: m?.id, unreadCount: m?.unreadCount })),
            targetChatId: chatId
          });
        }, 0);

        // ⭐ 현재 선택된 방의 채팅방 목록 unreadCount도 업데이트 (실시간 반영)
        // ⭐ 접속 중인 사용자는 읽음 처리되므로 unreadCount를 0으로 설정
        setRoomList((prevRoomList) => {
          return prevRoomList.map((room) => {
            if (Number(room.roomId) === Number(roomId)) {
              console.log("📊 [ChatLayout] UNREAD_COUNT_UPDATE - 채팅방 목록 unreadCount 업데이트 (접속 중이므로 0으로 설정):", {
                roomId: room.roomId,
                roomName: room.roomName,
                이전unreadCount: room.unreadCount,
                새로운unreadCount: 0
              });
              return {
                ...room,
                unreadCount: 0 // 접속 중이므로 읽음 처리됨
              };
            }
            return room;
          });
        });
      } else {
        // ⭐ 다른 방의 메시지인 경우 로그만 출력
        console.log("📊 [ChatLayout] UNREAD_COUNT_UPDATE 수신 (다른 방):", {
          chatId,
          unreadCount,
          roomId,
          selectedRoomId
        });
      }

      return;
    }

    // ⭐ ROOM_UNREAD_COUNT_UPDATE 메시지 처리 (채팅방 목록의 unreadCount 업데이트용)
    // ⭐ 백엔드에서 새로운 메시지가 왔을 때 채팅방 목록의 unreadCount를 업데이트하기 위해 브로드캐스트
    // ⭐ 자신이 해당 채팅방에 접속 중이 아닌 경우, 채팅방 목록의 unreadCount를 증가시켜야 함
    // ⭐ 중요: 접속 중인 사용자가 메시지를 보낼 때는 채팅방 목록의 unreadCount를 0으로 설정해야 함
    if (msg && msg.type === "ROOM_UNREAD_COUNT_UPDATE") {
      // ⭐ 자신이 보낸 메시지인지 확인
      const isMyMessage = msg.senderEmail && userProfile?.email &&
        msg.senderEmail.trim().toLowerCase() === userProfile.email.trim().toLowerCase();

      const { roomId, chatId } = msg;
      const roomIdNum = Number(roomId);
      const isCurrentlySelected = Number(selectedRoomId) === roomIdNum;

      // ⭐ 자신이 보낸 메시지이고 현재 선택된 방인 경우, unreadCount를 0으로 설정
      // (접속 중인 사용자는 이미 읽음 처리되었으므로 unreadCount는 0이어야 함)
      if (isMyMessage && isCurrentlySelected) {
        console.log("📊 [ChatLayout] ROOM_UNREAD_COUNT_UPDATE - 자신이 보낸 메시지이고 접속 중: unreadCount를 0으로 설정", {
          roomId: roomIdNum,
          chatId: chatId,
          senderEmail: msg.senderEmail,
          myEmail: userProfile?.email
        });
        
        // ⭐ 채팅방 목록에서 해당 방의 unreadCount를 0으로 설정
        setRoomList((prevRoomList) => {
          return prevRoomList.map((room) => {
            if (Number(room.roomId) === roomIdNum) {
              return {
                ...room,
                unreadCount: 0 // 접속 중인 사용자는 읽음 처리되므로 0
              };
            }
            return room;
          });
        });
        
        return;
      }

      // ⭐ 자신이 보낸 메시지이지만 다른 방인 경우는 무시 (일반적으로 발생하지 않음)
      if (isMyMessage) {
        console.log("📊 [ChatLayout] ROOM_UNREAD_COUNT_UPDATE 무시 - 자신이 보낸 메시지 (다른 방):", {
          roomId: roomIdNum,
          chatId: chatId,
          selectedRoomId: selectedRoomId,
          senderEmail: msg.senderEmail,
          myEmail: userProfile?.email
        });
        return;
      }

      console.log("📊 [ChatLayout] ⭐ ROOM_UNREAD_COUNT_UPDATE 조건 만족! 처리 시작");
      
      // ⭐ 현재 선택된 방이 아닌 경우에만 채팅방 목록의 unreadCount 증가
      // (현재 선택된 방이면 이미 메시지를 보고 있으므로 읽음 처리됨)
      if (!isCurrentlySelected) {
        console.log("📊 [ChatLayout] ROOM_UNREAD_COUNT_UPDATE 처리 - 다른 방의 새 메시지:", {
          roomId: roomIdNum,
          chatId: chatId,
          selectedRoomId: selectedRoomId,
          isCurrentlySelected
        });

        // ⭐ 채팅방 목록의 unreadCount 증가 (백엔드에서 정확한 값을 가져오기 위해 목록 다시 로드)
        // ⭐ 또는 프론트엔드에서 직접 +1 증가시킬 수도 있지만, 백엔드에서 정확한 값을 가져오는 것이 더 정확함
        loadRooms();
      } else {
        // ⭐ 현재 선택된 방이면 접속 중이므로 unreadCount를 0으로 설정
        console.log("📊 [ChatLayout] ROOM_UNREAD_COUNT_UPDATE 수신 (현재 선택된 방): unreadCount를 0으로 설정", {
          roomId: roomIdNum,
          chatId: chatId,
          selectedRoomId: selectedRoomId
        });
        
        setRoomList((prevRoomList) => {
          return prevRoomList.map((room) => {
            if (Number(room.roomId) === roomIdNum) {
              return {
                ...room,
                unreadCount: 0 // 접속 중이므로 읽음 처리됨
              };
            }
            return room;
          });
        });
      }

      return;
    }

    // ⭐ MESSAGE_UPDATE 메시지 처리 (초대 메시지가 입장 메시지로 변경될 때)
    if (msg && msg.type === "MESSAGE_UPDATE") {
      const { chatId, messageContent, roomId } = msg;
      
      console.log("📝 [ChatLayout] MESSAGE_UPDATE 수신:", {
        chatId,
        messageContent,
        roomId,
        selectedRoomId
      });

      // 현재 선택된 방의 메시지 목록에서 해당 메시지 업데이트
      if (Number(roomId) === Number(selectedRoomId)) {
        setMessages((prev) => {
          return prev.map((m) => {
            if (Number(m.id) === Number(chatId)) {
              console.log("📝 [ChatLayout] 메시지 내용 업데이트:", {
                chatId,
                이전내용: m.messageContent,
                새로운내용: messageContent
              });
              return { ...m, messageContent: messageContent };
            }
            return m;
          });
        });
      }
      
      // 채팅방 목록의 마지막 메시지도 업데이트
      setRoomList((prevRoomList) => {
        return prevRoomList.map((room) => {
          if (Number(room.roomId) === Number(roomId)) {
            return {
              ...room,
              lastMessageContent: messageContent
            };
          }
          return room;
        });
      });
      
      return;
    }

    // senderEmail로 내 메시지 판단 (백엔드에서 senderEmail 포함)
    // 대소문자/공백 차이를 방지하기 위해 trim().toLowerCase() 적용
    const isMyMessage =
      msg.senderEmail &&
      userProfile?.email &&
      msg.senderEmail.trim().toLowerCase() === userProfile.email.trim().toLowerCase();

    if (isMyMessage) {
      console.log("🔥 [ChatLayout] 내 메시지로 판단됨:", {
        msgRoomId: msg.roomId,
        selectedRoomId: selectedRoomId,
        msgId: msg.id,
        senderEmail: msg.senderEmail,
        userEmail: userProfile?.email
      });

      if (Number(msg.roomId) === Number(selectedRoomId)) {
        console.log("🔥 [ChatLayout] 현재 방의 내 메시지 - messages state에 추가 시작");

        // ⭐ 즉시 중복 체크: 동시 호출 방지를 위해 ref 사용
        const msgId = msg?.id;
        if (msgId == null) {
          console.warn("📨 [ChatLayout] 메시지 ID가 없어 무시:", msg);
          return;
        }

        const numMsgId = Number(msgId);

        // ⭐ 이미 처리 중이거나 처리된 메시지인지 확인
        if (processingMessageIdsRef.current.has(numMsgId) || processedMessageIdsRef.current.has(numMsgId)) {
          console.log("📨 [ChatLayout] 중복 메시지 무시 (내 메시지, ref 체크):", {
            messageId: msgId,
            messageContent: msg.messageContent,
            처리중: processingMessageIdsRef.current.has(numMsgId),
            처리완료: processedMessageIdsRef.current.has(numMsgId)
          });
          return;
        }

        // ⭐ 처리 중 표시
        processingMessageIdsRef.current.add(numMsgId);

        // ⭐ 내가 보낸 새 메시지의 unreadCount가 있으면 그대로 사용 (백엔드에서 실시간 계산된 값)
        // unreadCount가 없거나 undefined인 경우 0으로 설정
        // ⚠️ 중요: fileUrls를 명시적으로 포함하여 여러 파일이 제대로 표시되도록 함
        // ⚠️ 중요: msg.fileUrls가 배열이고 길이가 0보다 크면 그대로 사용
        // ⚠️ 중요: WebSocket 메시지에 fileUrls가 없으면 파일 업로드 응답에서 저장한 fileUrls 사용
        let fileUrls = null;
        if (msg.fileUrls && Array.isArray(msg.fileUrls) && msg.fileUrls.length > 0) {
          fileUrls = msg.fileUrls;
        } else {
          // 파일 업로드 응답에서 저장한 fileUrls 확인
          const pendingFileUrls = pendingFileUrlsRef.current.get(numMsgId);
          if (pendingFileUrls && Array.isArray(pendingFileUrls) && pendingFileUrls.length > 0) {
            fileUrls = pendingFileUrls;
            console.log("📨 [ChatLayout] 파일 업로드 응답에서 저장한 fileUrls 사용:", {
              messageId: numMsgId,
              fileUrlsLength: fileUrls.length,
              fileUrls: fileUrls
            });
            // 사용 후 삭제
            pendingFileUrlsRef.current.delete(numMsgId);
          } else if (msg.fileUrl) {
            fileUrls = [msg.fileUrl];
          }
        }

        const newMessage = {
          ...msg,
          unreadCount: msg.unreadCount != null ? msg.unreadCount : 0,
          fileUrls: fileUrls, // fileUrls 명시적으로 설정
          fileUrl: msg.fileUrl, // 하위 호환성을 위해 fileUrl도 유지
          fileYn: msg.fileYn
        };

        console.log("🔥 [ChatLayout] 새 메시지 객체 생성:", {
          id: newMessage.id,
          roomId: newMessage.roomId,
          messageContent: newMessage.messageContent,
          unreadCount: newMessage.unreadCount,
          fileYn: newMessage.fileYn,
          fileUrl: newMessage.fileUrl,
          fileUrls: newMessage.fileUrls,
          fileUrlsLength: newMessage.fileUrls?.length,
          fileUrls타입: Array.isArray(newMessage.fileUrls) ? "배열" : typeof newMessage.fileUrls,
          원본msgfileUrls: msg.fileUrls,
          원본msgfileUrls타입: Array.isArray(msg.fileUrls) ? "배열" : typeof msg.fileUrls,
          원본msgfileUrls길이: msg.fileUrls?.length,
          전체메시지: newMessage
        });

        setMessages((prev) => {
          console.log("🔥 [ChatLayout] setMessages 호출 - 이전 메시지 수:", prev.length);

          // ⭐ 이중 체크: ref와 state 모두 확인
          const existsInState = prev.some(m => {
            const mId = m?.id;
            if (mId == null) return false;
            return Number(mId) === numMsgId;
          });

          if (existsInState) {
            console.log("📨 [ChatLayout] 중복 메시지 무시 (내 메시지, state 체크):", {
              messageId: msgId,
              messageContent: msg.messageContent
            });
            processingMessageIdsRef.current.delete(numMsgId);
            return prev;
          }

          // ⭐ 처리 완료 표시: processing에서 제거하고 processed에 추가
          processingMessageIdsRef.current.delete(numMsgId);
          processedMessageIdsRef.current.add(numMsgId);

          // ⭐ 최근 처리한 메시지 ID는 최대 1000개만 유지 (메모리 관리)
          if (processedMessageIdsRef.current.size > 1000) {
            const idsArray = Array.from(processedMessageIdsRef.current);
            processedMessageIdsRef.current = new Set(idsArray.slice(-500));
          }

          // ⭐ 내가 보낸 메시지를 추가할 때, 기존 메시지들의 unreadCount도 업데이트
          // 접속 중인 사용자들이 읽음 처리되었으므로, 같은 방의 모든 메시지의 unreadCount가 감소할 수 있음
          // 하지만 실제로는 각 메시지마다 unreadCount가 다르므로, UNREAD_COUNT_UPDATE 메시지로 처리됨
          const updated = [...prev, newMessage];
          console.log("📨 [ChatLayout] 내가 보낸 메시지 추가 완료:", {
            messageId: msg.id,
            unreadCount: newMessage.unreadCount,
            fileYn: newMessage.fileYn,
            fileUrl: newMessage.fileUrl,
            fileUrls: newMessage.fileUrls,
            fileUrlsLength: newMessage.fileUrls?.length,
            fileUrls타입: Array.isArray(newMessage.fileUrls) ? "배열" : typeof newMessage.fileUrls,
            전체메시지수: updated.length,
            추가된메시지의fileUrls: updated[updated.length - 1]?.fileUrls,
            추가된메시지의fileUrls길이: updated[updated.length - 1]?.fileUrls?.length
          });
          return updated;
        });

        // ⭐ 자신이 보낸 메시지인 경우에도 채팅방 목록의 메시지 내용과 시간을 업데이트해야 함
        // ⭐ 현재 선택된 방에서 메시지를 보낸 경우에도 채팅방 목록에 반영되어야 함
        const roomIdNum = Number(msg.roomId);
        setRoomList((prevRoomList) => {
          const updated = prevRoomList.map(room => {
            if (Number(room.roomId) === roomIdNum) {
              // ⭐ 자신이 보낸 메시지는 unreadCount를 유지하지만, 메시지 내용과 시간은 업데이트
              return {
                ...room,
                lastMessageContent: msg.messageContent,
                lasMessageTime: msg.sendAt,
                lastMessageFileYn: msg.fileYn || false, // 마지막 메시지의 파일 첨부 여부
                fileYn: msg.fileYn,
                sendAt: msg.sendAt,
                // ⭐ unreadCount는 유지 (자신이 보낸 메시지는 읽음 처리되므로)
                unreadCount: room.unreadCount || 0
              };
            }
            return room;
          });
          return sortRoomList(updated);
        });

        console.log("📨 [ChatLayout] 자신이 보낸 메시지 - 채팅방 목록 업데이트 완료:", {
          roomId: roomIdNum,
          messageContent: msg.messageContent,
          sendAt: msg.sendAt
        });
      }
      return;
    }
    const roomIdNum = Number(msg.roomId);
    const foundRoom = Array.isArray(roomList)
      ? roomList.find(r => r && Number(r.roomId) === roomIdNum)
      : null;

    // ⭐ 현재 선택된 방의 메시지인 경우, foundRoom이 없어도 메시지 추가
    // (roomList가 아직 로드되지 않았거나 업데이트되지 않은 경우에도 메시지 수신 가능)
    if (roomIdNum === Number(selectedRoomId)) {
      // ⭐ 즉시 중복 체크: 동시 호출 방지를 위해 ref 사용
      const msgId = msg?.id;
      if (msgId == null) {
        console.warn("📨 [ChatLayout] 메시지 ID가 없어 무시:", msg);
        return;
      }

      const numMsgId = Number(msgId);

      // ⭐ 이미 처리 중이거나 처리된 메시지인지 확인
      if (processingMessageIdsRef.current.has(numMsgId) || processedMessageIdsRef.current.has(numMsgId)) {
        console.log("📨 [ChatLayout] 중복 메시지 무시 (ref 체크):", {
          messageId: msgId,
          messageContent: msg.messageContent,
          처리중: processingMessageIdsRef.current.has(numMsgId),
          처리완료: processedMessageIdsRef.current.has(numMsgId)
        });
        return;
      }

      // ⭐ 처리 중 표시
      processingMessageIdsRef.current.add(numMsgId);

      // ⭐ 다른 사람이 보낸 새 메시지의 unreadCount가 있으면 그대로 사용 (백엔드에서 실시간 계산된 값)
      // unreadCount가 없거나 undefined인 경우 0으로 설정
      // ⚠️ 중요: fileUrls를 명시적으로 포함하여 여러 파일이 제대로 표시되도록 함
      // ⚠️ 중요: msg.fileUrls가 배열이고 길이가 0보다 크면 그대로 사용
      // ⚠️ 중요: WebSocket 메시지에 fileUrls가 없으면 파일 업로드 응답에서 저장한 fileUrls 사용
      let fileUrls = null;
      if (msg.fileUrls && Array.isArray(msg.fileUrls) && msg.fileUrls.length > 0) {
        fileUrls = msg.fileUrls;
      } else {
        // 파일 업로드 응답에서 저장한 fileUrls 확인
        const pendingFileUrls = pendingFileUrlsRef.current.get(numMsgId);
        if (pendingFileUrls && Array.isArray(pendingFileUrls) && pendingFileUrls.length > 0) {
          fileUrls = pendingFileUrls;
          console.log("📨 [ChatLayout] 파일 업로드 응답에서 저장한 fileUrls 사용 (다른 사람 메시지):", {
            messageId: numMsgId,
            fileUrlsLength: fileUrls.length,
            fileUrls: fileUrls
          });
          // 사용 후 삭제
          pendingFileUrlsRef.current.delete(numMsgId);
        } else if (msg.fileUrl) {
          fileUrls = [msg.fileUrl];
        }
      }

      // ⭐ 현재 선택된 방에서 메시지를 받는 경우, 접속 중인 사용자는 이미 읽음 처리되므로 unreadCount를 0으로 설정
      // ⭐ 백엔드에서 계산한 전체 unreadCount는 다른 접속하지 않은 사용자들의 수이지만,
      // ⭐ 현재 접속 중인 사용자 입장에서는 자신이 읽었으므로 0으로 표시
      const newMessage = {
        ...msg,
        unreadCount: 0, // 현재 선택된 방이므로 접속 중인 사용자는 읽음 처리됨
        fileUrls: fileUrls, // fileUrls 명시적으로 설정
        fileUrl: msg.fileUrl, // 하위 호환성을 위해 fileUrl도 유지
        fileYn: msg.fileYn
      };

      // ⭐ 디버깅: 다른 사람이 보낸 메시지의 unreadCount 확인 (필요시 주석 해제)
      console.log("📨 [ChatLayout] 다른 사람이 보낸 메시지 수신:", {
        messageId: msg.id,
        senderName: msg.senderName,
        senderEmail: msg.senderEmail,
        unreadCount: newMessage.unreadCount,
        messageContent: msg.messageContent,
        fileYn: newMessage.fileYn,
        fileUrl: newMessage.fileUrl,
        fileUrls: newMessage.fileUrls,
        fileUrlsLength: newMessage.fileUrls?.length,
        fileUrls타입: Array.isArray(newMessage.fileUrls) ? "배열" : typeof newMessage.fileUrls,
        원본msgfileUrls: msg.fileUrls,
        원본msgfileUrls타입: Array.isArray(msg.fileUrls) ? "배열" : typeof msg.fileUrls,
        메시지전체: newMessage
      });

      setMessages((prev) => {
        // ⭐ 이중 체크: ref와 state 모두 확인
        const existsInState = prev.some(m => {
          const mId = m?.id;
          if (mId == null) return false;
          return Number(mId) === numMsgId;
        });

        if (existsInState) {
          console.log("📨 [ChatLayout] 중복 메시지 무시 (state 체크):", {
            messageId: msgId,
            messageContent: msg.messageContent
          });
          processingMessageIdsRef.current.delete(numMsgId);
          return prev;
        }

        // ⭐ 처리 완료 표시: processing에서 제거하고 processed에 추가
        processingMessageIdsRef.current.delete(numMsgId);
        processedMessageIdsRef.current.add(numMsgId);

        // ⭐ 최근 처리한 메시지 ID는 최대 1000개만 유지 (메모리 관리)
        if (processedMessageIdsRef.current.size > 1000) {
          const idsArray = Array.from(processedMessageIdsRef.current);
          processedMessageIdsRef.current = new Set(idsArray.slice(-500));
        }

        const updated = [...prev, newMessage];
        console.log("📨 [ChatLayout] 다른 사람이 보낸 메시지 추가 완료:", {
          messageId: msg.id,
          unreadCount: newMessage.unreadCount,
          fileYn: newMessage.fileYn,
          fileUrl: newMessage.fileUrl,
          fileUrls: newMessage.fileUrls,
          fileUrlsLength: newMessage.fileUrls?.length,
          fileUrls타입: Array.isArray(newMessage.fileUrls) ? "배열" : typeof newMessage.fileUrls,
          전체메시지수: updated.length,
          추가된메시지의fileUrls: updated[updated.length - 1]?.fileUrls,
          추가된메시지의fileUrls길이: updated[updated.length - 1]?.fileUrls?.length
        });
        return updated;
      });

      // ⭐ 현재 선택된 방에서 다른 사람이 보낸 메시지인 경우에도 채팅방 목록의 메시지 내용과 시간을 업데이트해야 함
      // ⭐ 중요: 현재 선택된 방이므로 접속 중인 사용자는 읽음 처리되므로 unreadCount를 0으로 설정
      setRoomList((prevRoomList) => {
        const updated = prevRoomList.map(room => {
          if (Number(room.roomId) === roomIdNum) {
            // ⭐ 현재 선택된 방이므로 접속 중인 사용자는 이미 읽음 처리되므로 unreadCount를 0으로 설정
            return {
              ...room,
              lastMessageContent: msg.messageContent,
              lasMessageTime: msg.sendAt,
              lastMessageFileYn: msg.fileYn || false, // 마지막 메시지의 파일 첨부 여부
              fileYn: msg.fileYn,
              sendAt: msg.sendAt,
              // ⭐ 현재 선택된 방이므로 접속 중인 사용자는 읽음 처리되므로 unreadCount를 0으로 설정
              unreadCount: 0
            };
          }
          return room;
        });
        return sortRoomList(updated);
      });

      console.log("📨 [ChatLayout] 현재 선택된 방의 다른 사람 메시지 - 채팅방 목록 업데이트 완료:", {
        roomId: roomIdNum,
        messageContent: msg.messageContent,
        sendAt: msg.sendAt,
        senderName: msg.senderName
      });
    } else { // 다른 방이면 토스트 알림
      // ⭐ foundRoom이 없으면 토스트 알림을 생성하지 않음 (roomList에 방이 없을 수 있음)
      if (foundRoom) {
        setToastRooms((prev) => {
          const filtered = prev.filter(r => Number(r.roomId) !== roomIdNum);
          const newToast = {
            roomId: msg.roomId,
            unreadCount: msg.unreadCount || 1,
            lastUnreadMessageContent: msg.messageContent,
            lastUnreadMessageSenderName: msg.senderName,
            lastUnreadMessageTime: msg.sendAt,
            roomName: foundRoom.roomName
          };
          return [...filtered, newToast].sort(
            (a, b) => new Date(b.lastUnreadMessageTime) - new Date(a.lastUnreadMessageTime)
          );
        });
      }
    }
    // ⭐ roomList의 해당 방 정보를 최신화하고 정렬
    // ⭐ 중요: 자신이 해당 채팅방에 접속 중이 아닌 경우 (다른 방이거나 선택된 방이 없는 경우)
    //          채팅방 목록의 unreadCount를 증가시켜야 함
    // ⭐ 중요: 자신이 보낸 메시지인 경우에도 메시지 내용과 시간은 업데이트되어야 함
    setRoomList((prevRoomList) => {
      const updated = prevRoomList.map(room => {
        if (Number(room.roomId) === roomIdNum) {
          // ⭐ 현재 선택된 방인지 확인
          const isCurrentlySelected = Number(selectedRoomId) === roomIdNum;

          // ⭐ 자신이 보낸 메시지인지 확인
          const isMyMessage = msg.senderEmail && userProfile?.email &&
            msg.senderEmail.trim().toLowerCase() === userProfile.email.trim().toLowerCase();

          const currentUnreadCount = room.unreadCount || 0;
          let newUnreadCount = currentUnreadCount;

          // ⭐ 자신이 보낸 메시지인 경우: unreadCount를 업데이트하지 않음 (발신자는 읽음 처리되므로)
          if (isMyMessage) {
            // ⭐ 자신이 보낸 메시지는 unreadCount를 유지
            // 백엔드에서 이미 발신자는 readYn=true로 설정했으므로, 채팅방 목록의 unreadCount는 변경하지 않음
            newUnreadCount = currentUnreadCount;
            console.log("📨 [ChatLayout] 자신이 보낸 메시지 - unreadCount 유지, 메시지 내용/시간 업데이트:", {
              roomId: roomIdNum,
              roomName: room.roomName,
              unreadCount: newUnreadCount,
              messageContent: msg.messageContent,
              sendAt: msg.sendAt,
              fileYn: msg.fileYn,
              isMyMessage: true,
              isCurrentlySelected
            });
          }
          // ⭐ 현재 선택된 방이 아닌 경우에만 unreadCount 증가
          // (현재 선택된 방이면 이미 메시지를 보고 있으므로 읽음 처리됨)
          else if (!isCurrentlySelected) {
            // ⭐ 새로운 메시지가 왔으므로 unreadCount 증가
            // 백엔드에서 받은 unreadCount가 있으면 그것을 사용하고, 없으면 +1
            newUnreadCount = msg.unreadCount != null ? Number(msg.unreadCount) : currentUnreadCount + 1;
            console.log("📨 [ChatLayout] 다른 방의 새 메시지 수신 - unreadCount 증가:", {
              roomId: roomIdNum,
              roomName: room.roomName,
              이전unreadCount: currentUnreadCount,
              새로운unreadCount: newUnreadCount,
              isMyMessage: false,
              isCurrentlySelected: false,
              msgUnreadCount: msg.unreadCount
            });
          }
          // ⭐ 현재 선택된 방인 경우: 백엔드에서 받은 unreadCount가 있으면 그것을 사용
          else if (msg.unreadCount != null) {
            newUnreadCount = Number(msg.unreadCount);
            console.log("📨 [ChatLayout] 현재 선택된 방의 메시지 - unreadCount 업데이트:", {
              roomId: roomIdNum,
              roomName: room.roomName,
              이전unreadCount: currentUnreadCount,
              새로운unreadCount: newUnreadCount,
              isMyMessage: false,
              isCurrentlySelected: true,
              msgUnreadCount: msg.unreadCount
            });
          }

          // ⭐ 중요: 자신이 보낸 메시지인 경우에도 메시지 내용과 시간은 항상 업데이트되어야 함
          return {
            ...room,
            lastMessageContent: msg.messageContent,
            lasMessageTime: msg.sendAt,
            lastMessageFileYn: msg.fileYn || false, // 마지막 메시지의 파일 첨부 여부
            fileYn: msg.fileYn,
            sendAt: msg.sendAt,
            unreadCount: newUnreadCount,
          };
        }
        return room;
      });
      return sortRoomList(updated);
    });
  };

  // ---------- 파일 업로드 (다중 파일 지원 - 하나의 메시지로 묶기) ----------
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0 || !selectedRoomId) return;

    // ⭐ 여러 파일을 한 번에 업로드 (하나의 메시지로 묶기)
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await http.post(`/chat/${selectedRoomId}/messages/files`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const chatMessage = res.data.data;

      // ⚠️ 디버깅: 업로드된 파일 정보 확인
      console.log("[ChatLayout] 파일 업로드 응답:", {
        messageId: chatMessage?.id,
        fileUrl: chatMessage?.fileUrl,
        fileUrls: chatMessage?.fileUrls,
        fileUrlsLength: chatMessage?.fileUrls?.length,
        fileYn: chatMessage?.fileYn
      });

      // ⭐ fileUrls가 없으면 fileUrl을 배열로 변환하여 설정
      const messageWithFileUrls = {
        ...chatMessage,
        fileUrls: chatMessage.fileUrls || (chatMessage.fileUrl ? [chatMessage.fileUrl] : undefined),
        fileUrl: chatMessage.fileUrl, // 하위 호환성을 위해 유지
        fileYn: chatMessage.fileYn
      };

      console.log("[ChatLayout] 파일 업로드 메시지 처리:", {
        messageId: messageWithFileUrls?.id,
        fileUrls: messageWithFileUrls?.fileUrls,
        fileUrlsLength: messageWithFileUrls?.fileUrls?.length,
        fileUrl: messageWithFileUrls?.fileUrl
      });

      // ⚠️ 중요: 파일 업로드 API 응답으로 받은 메시지는 추가하지 않음
      // WebSocket으로 받은 메시지가 더 최신이고, 모든 참여자에게 동일하게 전달되므로
      // WebSocket 메시지만 사용하도록 함
      // 파일 업로드 API 응답은 성공 여부 확인용으로만 사용
      console.log("📨 [ChatLayout] 파일 업로드 성공 - WebSocket 메시지 대기 중:", {
        messageId: messageWithFileUrls.id,
        fileUrlsLength: messageWithFileUrls.fileUrls?.length
      });

      // ⭐ 파일 업로드 응답으로 받은 fileUrls를 임시 저장 (WebSocket 메시지에 fileUrls가 없을 경우 대비)
      const msgId = messageWithFileUrls?.id;
      if (msgId != null && messageWithFileUrls.fileUrls && messageWithFileUrls.fileUrls.length > 0) {
        const numMsgId = Number(msgId);
        pendingFileUrlsRef.current.set(numMsgId, messageWithFileUrls.fileUrls);
        console.log("📨 [ChatLayout] 파일 업로드 응답의 fileUrls 임시 저장:", {
          messageId: numMsgId,
          fileUrlsLength: messageWithFileUrls.fileUrls.length,
          fileUrls: messageWithFileUrls.fileUrls
        });

        // 5초 후 자동 삭제 (메모리 관리)
        setTimeout(() => {
          pendingFileUrlsRef.current.delete(numMsgId);
        }, 5000);
      }
    } catch (err) {
      alert(`파일 업로드에 실패했습니다: ${err.message}`);
    }
  };

  // ---------- 메시지 보내기 ----------
  const handleSend = async () => {
    const message = inputRef.current.value;
    if (!message.trim()) {
      return;
    }

    if (!selectedRoomId) {
      alert("채팅방을 선택해주세요.");
      return;
    }

    // ⭐ 메시지 전송 전: 접속 중인 사용자가 메시지를 보내므로 채팅방 목록의 unreadCount를 0으로 설정
    // (백엔드에서 WebSocket 메시지를 받기 전에 먼저 UI를 업데이트하여 즉시 피드백 제공)
    setRoomList((prevRoomList) => {
      return prevRoomList.map((room) => {
        if (Number(room.roomId) === Number(selectedRoomId)) {
          console.log("📊 [ChatLayout] 메시지 전송 전: 채팅방 목록의 unreadCount를 0으로 설정", {
            roomId: room.roomId,
            roomName: room.roomName,
            이전unreadCount: room.unreadCount
          });
          return {
            ...room,
            unreadCount: 0 // 접속 중인 사용자가 메시지를 보내므로 읽음 처리됨
          };
        }
        return room;
      });
    });

    // ⭐ WebSocket을 통해 메시지 전송 (서버에서 브로드캐스트된 메시지를 수신하여 표시)
    // ⭐ 재연결이 필요한 경우를 대비해 콜백 전달
    // ⭐ socketConnected 체크 제거 - sendStompMessage가 자동으로 재연결 처리
    try {
      const success = await sendStompMessage(
        { roomId: selectedRoomId, content: message },
        {
          onMessage: msg => handleNewMessage(msg),
          onConnect: () => {
            console.log('🔥 [ChatLayout] 재연결 성공 - socketConnected를 true로 설정');
            setSocketConnected(true);
          },
          onError: () => {
            console.log('🔥 [ChatLayout] 재연결 실패 - socketConnected를 false로 설정');
            setSocketConnected(false);
          }
        }
      );
      
      if (success) {
        inputRef.current.value = "";
      } else {
        // ⭐ 재연결 시도 후에도 실패한 경우
        console.warn('🔥 [ChatLayout] 메시지 전송 실패 - 재연결 시도 후에도 실패');
        alert("채팅 서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch (error) {
      console.error('🔥 [ChatLayout] 메시지 전송 중 예외 발생:', error);
      alert("메시지 전송 중 오류가 발생했습니다.");
    }
  };

  // ---------- 스크롤로 읽음 처리 ----------
  const handleScrollRead = async () => {
    if (selectedRoomId && messages.length > 0) {
      await markRoomMessagesAsRead(selectedRoomId);
      loadRooms();
    }
  };

  // ---------- 채팅방 목록 새로고침 (최신화) ----------
  // 이 함수에서 방 목록을 받아와도 setSelectedRoomId(null)로 설정하여
  // 첫 진입시 아무 방도 선택하지 않게 한다
  // preserveSelectedRoomId: true인 경우 선택된 채팅방 ID를 유지
  const loadRooms = useCallback(async (preserveSelectedRoomId = false, selectedRoomIdToPreserve = null) => {
    const res = await fetchChatRoomsLatest();
    if (res && Array.isArray(res.data)) {
      // 정렬 함수 사용
      const sortedRooms = sortRoomList(res.data);
      setRoomList(sortedRooms);
      if (preserveSelectedRoomId && selectedRoomIdToPreserve != null) {
        // 선택된 채팅방 ID 유지
        setSelectedRoomId(selectedRoomIdToPreserve);
      } else if (!preserveSelectedRoomId) {
        setSelectedRoomId(null); // ★ 첫 진입시 아무 방도 자동 선택 안 함
      }
    } else {
      setRoomList([]);
      if (!preserveSelectedRoomId) {
        setSelectedRoomId(null);
      }
    }
  }, []);

  // ---------- 채팅방 나가기 핸들러 ----------
  const handleLeaveRoom = useCallback(async (roomId) => {
    try {
      // WebSocket 연결 해제
      await disconnectStomp();
      
      // 채팅방 목록에서 제거
      setRoomList(prev => prev.filter(room => room.roomId !== roomId));
      
      // 선택된 채팅방 해제
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
        setMessages([]);
      }
      
      // 채팅방 목록 새로고침
      await loadRooms();
      
      console.log("[ChatLayout] 채팅방 나가기 완료 - roomId:", roomId);
    } catch (error) {
      console.error("[ChatLayout] 채팅방 나가기 처리 중 오류:", error);
    }
  }, [selectedRoomId, loadRooms]);

  // ---------- 채팅방 선택 핸들러 (안읽은 메시지가 있으면 읽음 처리) ----------
  const handleRoomSelect = useCallback(async (roomId) => {
    // 먼저 채팅방 선택 (즉시 UI 반영)
    setSelectedRoomId(roomId);
    
    // 현재 roomList에서 선택하려는 채팅방 정보 확인
    const selectedRoom = roomList.find((room) => room && room.roomId === roomId);
    
    // 안읽은 메시지가 있는 채팅방을 선택한 경우 스크롤 설정
    // ⭐ 중요: 메시지를 먼저 로드한 후 읽음 처리해야 마커가 표시됨
    if (selectedRoom && selectedRoom.unreadCount > 0) {
      // 안읽은 메시지 위치로 스크롤하도록 설정
      setScrollToUnread(true);
      // 메시지 로드는 selectedRoomId 변경 시 useEffect에서 자동으로 실행됨
      // 읽음 처리는 메시지 로드 후에 실행되도록 변경 (아래 useEffect에서 처리)
    } else {
      // 안읽은 메시지가 없으면 스크롤 설정 해제
      setScrollToUnread(false);
    }
  }, [roomList]);

  // ---------- 채팅방 목록 최초 로드 ----------
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // ---------- location.state.selectedRoomId 처리 (ChatPopover에서 채팅방 클릭 시) ----------
  useEffect(() => {
    if (location.state?.selectedRoomId) {
      const roomId = location.state.selectedRoomId;
      // state 초기화 (뒤로가기 시 재선택 방지 및 무한 루프 방지)
      window.history.replaceState({}, document.title);
      
      // 즉시 채팅방 선택 (메시지 로딩을 위해)
      setSelectedRoomId(roomId);
      
      // ChatPopover에서 클릭한 경우 안읽은 메시지가 있을 가능성이 높으므로 scrollToUnread 설정
      const selectedRoom = roomList.find((room) => room && room.roomId === roomId);
      if (selectedRoom && selectedRoom.unreadCount > 0) {
        setScrollToUnread(true);
      }
      
      // 채팅방 목록이 로드된 후 읽음 처리
      // roomList가 비어있으면 먼저 로드
      if (roomList.length === 0) {
        loadRooms(true, roomId).then(() => {
          // 채팅방 목록 로드 후 읽음 처리
          handleRoomSelect(roomId);
        });
      } else {
        // 채팅방 목록이 이미 있으면 바로 읽음 처리
        handleRoomSelect(roomId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.selectedRoomId]);

  // ---------- 채팅방 선택시 메시지 로딩 (최신 메시지부터) ----------
  useEffect(() => {
    async function loadMessages() {
      if (selectedRoomId) {
        // 채팅방이 변경되면 페이징 상태 초기화
        setCurrentPage(0);
        setHasMore(true);
        setIsLoadingMore(false);

        const res = await fetchChatRoomMessages(selectedRoomId, 0, 20);
        if (res && res.data) {
          // ResponseDTO 구조: { status, message, data: Page<ChatMessageResponseDTO> }
          const pageData = res.data.data || res.data; // res.data.data가 Page 객체
          if (pageData && Array.isArray(pageData.content)) {
            // 최신 메시지부터 내림차순으로 받아오므로 역순으로 정렬하여 오름차순으로 표시
            const sortedMessages = [...pageData.content].reverse();

            // ⭐ 중간에 초대된 사용자는 초대 시점부터의 메시지만 표시
            // 현재 사용자의 입장 메시지를 찾아서 초대 시점 확인
            const currentUserId = userProfile?.id || userProfile?.userId;
            const currentUserEmail = userProfile?.email;
            let joinedAtTime = null;

            if (currentUserId || currentUserEmail) {
              // 현재 사용자의 입장 메시지 찾기 (시스템 메시지)
              // "~~님이 입장했습니다" 또는 "~~님이 초대되었습니다" 메시지 확인
              const joinMessage = sortedMessages.find((msg) => {
                const isJoinMessage = msg.messageContent && 
                  (msg.messageContent.includes("님이 입장했습니다") || 
                   msg.messageContent.includes("님이 초대되었습니다"));
                
                // 메시지 내용에서 사용자 이름 추출하여 현재 사용자와 비교
                if (isJoinMessage && msg.messageContent) {
                  // "상어님이 입장했습니다" -> "상어" 추출
                  const nameMatch = msg.messageContent.match(/^(.+?)님이/);
                  if (nameMatch) {
                    const messageSenderName = nameMatch[1];
                    // 현재 사용자 이름과 비교
                    const isMyJoinMessage = 
                      (userProfile?.name && messageSenderName === userProfile.name) ||
                      (msg.senderId === currentUserId) ||
                      (msg.senderEmail && currentUserEmail &&
                        msg.senderEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
                    return isMyJoinMessage;
                  }
                }
                return false;
              });

              if (joinMessage && joinMessage.sendAt) {
                joinedAtTime = new Date(joinMessage.sendAt).getTime();
                console.log("📅 [ChatLayout] 사용자 초대 시점 확인:", {
                  joinMessageId: joinMessage.id,
                  joinMessageContent: joinMessage.messageContent,
                  joinedAtTime: joinMessage.sendAt,
                  timestamp: joinedAtTime,
                  currentUserName: userProfile?.name
                });
              }
            }

            // 초대 시점 이후의 메시지만 필터링
            // ⭐ 중요: 다른 사람의 입장 메시지도 초대 시점 이전이면 제외
            const filteredMessages = joinedAtTime
              ? sortedMessages.filter((msg) => {
                const msgTime = msg.sendAt ? new Date(msg.sendAt).getTime() : 0;
                
                // 입장/초대 메시지인 경우
                const isJoinOrInviteMessage = msg.messageContent && 
                  (msg.messageContent.includes("님이 입장했습니다") || 
                   msg.messageContent.includes("님이 초대되었습니다"));
                
                if (isJoinOrInviteMessage) {
                  // 메시지 내용에서 사용자 이름 추출
                  const nameMatch = msg.messageContent.match(/^(.+?)님이/);
                  if (nameMatch) {
                    const messageSenderName = nameMatch[1];
                    // 현재 사용자의 입장/초대 메시지인지 확인
                    const isMyMessage = 
                      (userProfile?.name && messageSenderName === userProfile.name) ||
                      (msg.senderId === currentUserId) ||
                      (msg.senderEmail && currentUserEmail &&
                        msg.senderEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
                    
                    // 현재 사용자의 입장/초대 메시지는 항상 포함
                    if (isMyMessage) {
                      return true;
                    }
                    // 다른 사람의 입장/초대 메시지는 초대 시점 이후만 포함
                    return msgTime >= joinedAtTime;
                  }
                }
                
                // 일반 메시지는 초대 시점 이후만 포함
                return msgTime >= joinedAtTime;
              })
              : sortedMessages; // 초대 시점을 찾을 수 없으면 모든 메시지 표시

            console.log("📅 [ChatLayout] 메시지 필터링 결과:", {
              전체메시지수: sortedMessages.length,
              필터링된메시지수: filteredMessages.length,
              초대시점: joinedAtTime ? new Date(joinedAtTime).toISOString() : "없음",
              필터링여부: joinedAtTime !== null
            });

            // ⭐ 중요: 채팅방 진입 시 fetch한 메시지 사용
            // ⭐ selectedRoomId가 변경되면 이전 방의 메시지는 무시하고 새로 fetch
            // ⭐ 서버에서 최신 unreadCount를 가져오므로 그대로 사용
            // ⭐ UNREAD_COUNT_UPDATE는 fetch 이후에도 도착할 수 있으므로,
            //    handleNewMessage의 UNREAD_COUNT_UPDATE 처리 로직에서 병합됨

            // ⭐ setMessages 호출 전 상태 확인
            const fetchTimestamp = new Date().toISOString();
            console.log("📨 [ChatLayout] 채팅방 진입 시 setMessages 호출 전:", {
              timestamp: fetchTimestamp,
              이전messages배열길이: messages.length,
              이전messagesIds: messages.map(m => ({ id: m?.id, unreadCount: m?.unreadCount })),
              새로운messages배열길이: sortedMessages.length,
              새로운messagesIds: sortedMessages.map(m => ({ id: m?.id, unreadCount: m?.unreadCount })),
              roomId: selectedRoomId
            });

            // ⭐ 대기 중인 unreadCount 업데이트 적용 (메시지가 로드되기 전에 도착한 UNREAD_COUNT_UPDATE 처리)
            const messagesWithPendingUpdates = filteredMessages.map((m) => {
              const chatId = Number(m.id);
              const pendingUpdate = pendingUnreadCountUpdatesRef.current.get(chatId);
              if (pendingUpdate !== undefined) {
                console.log("📊 [ChatLayout] 대기 중인 unreadCount 업데이트 적용:", {
                  chatId,
                  이전unreadCount: m.unreadCount,
                  새로운unreadCount: pendingUpdate
                });
                pendingUnreadCountUpdatesRef.current.delete(chatId);
                return { ...m, unreadCount: pendingUpdate };
              }
              return m;
            });

            setMessages(messagesWithPendingUpdates);

            console.log("📨 [ChatLayout] 채팅방 진입 시 메시지 로드 완료:", {
              timestamp: fetchTimestamp,
              메시지수: messagesWithPendingUpdates.length,
              roomId: selectedRoomId,
              첫번째메시지unreadCount: messagesWithPendingUpdates[0]?.unreadCount,
              마지막메시지unreadCount: messagesWithPendingUpdates[messagesWithPendingUpdates.length - 1]?.unreadCount,
              모든메시지unreadCount: messagesWithPendingUpdates.map(m => ({ id: m?.id, unreadCount: m?.unreadCount }))
            });
            setTotalPages(pageData.totalPages || 0);
            setHasMore(!pageData.last); // last가 false면 더 있음
            setCurrentPage(0);

            // ⭐ 채팅방 선택 시 메시지 로드 후 스크롤 처리
            // scrollToUnread가 true이면 ChatMessageList에서 처리하므로 여기서는 스크롤하지 않음
            // scrollToUnread가 false일 때만 최신 메시지로 스크롤
            if (!scrollToUnread) {
              setTimeout(() => {
                const scrollContainer = document.querySelector('.chat-message-list-container');
                if (scrollContainer) {
                  scrollContainer.scrollTop = scrollContainer.scrollHeight;
                  console.log("📜 [ChatLayout] 채팅방 선택 시 최신 메시지로 스크롤:", {
                    scrollTop: scrollContainer.scrollTop,
                    scrollHeight: scrollContainer.scrollHeight,
                    messagesLength: messagesWithPendingUpdates.length
                  });
                }
              }, 300);
            }

            // ⭐ 채팅방 접속 시 안읽은 메시지들을 읽음 처리
            // ⭐ 중요: 메시지 로드 후 마커가 렌더링되고 스크롤이 완료된 후에 읽음 처리
            // scrollToUnread가 true이면 ChatMessageList에서 스크롤 완료 후 onScrollToUnreadComplete 호출
            // 그 시점에 읽음 처리를 하도록 변경 (아래 useEffect에서 처리)
            // 여기서는 즉시 읽음 처리하지 않음

            // ⭐ 채팅방 변경 시 처리된 메시지 ID 초기화 (새 방의 메시지 로드)
            processedMessageIdsRef.current.clear();
            processingMessageIdsRef.current.clear();
            pendingUnreadCountUpdatesRef.current.clear(); // ⭐ 대기 중인 unreadCount 업데이트도 초기화
          } else if (Array.isArray(pageData)) {
            // 기존 형식 (배열) 지원
            setMessages(pageData);
            setHasMore(false);

            // ⭐ 채팅방 접속 시 안읽은 메시지들을 읽음 처리
            // ⭐ 중요: scrollToUnread가 false일 때만 즉시 읽음 처리
            // scrollToUnread가 true이면 ChatMessageList에서 스크롤 완료 후 onScrollToUnreadComplete에서 읽음 처리
            if (!scrollToUnread) {
              try {
                await markRoomMessagesAsRead(selectedRoomId);
                console.log("[ChatLayout] 채팅방 접속 시 메시지 읽음 처리 완료 - roomId:", selectedRoomId);

                // ⭐ 채팅방 목록의 unreadCount를 0으로 업데이트
                setRoomList((prevRoomList) => {
                  const updated = prevRoomList.map(room => {
                    if (Number(room.roomId) === Number(selectedRoomId)) {
                      return {
                        ...room,
                        unreadCount: 0
                      };
                    }
                    return room;
                  });
                  return sortRoomList(updated);
                });

                // 채팅방 목록 새로고침
                await loadRooms(true, selectedRoomId);
              } catch (error) {
                console.error("[ChatLayout] 메시지 읽음 처리 실패:", error);
              }
            }

            // ⭐ 채팅방 변경 시 처리된 메시지 ID 초기화 (새 방의 메시지 로드)
            processedMessageIdsRef.current.clear();
            processingMessageIdsRef.current.clear();
            pendingUnreadCountUpdatesRef.current.clear(); // ⭐ 대기 중인 unreadCount 업데이트도 초기화
          } else {
            setMessages([]);
            setHasMore(false);
            // ⭐ 메시지가 없을 때도 초기화
            processedMessageIdsRef.current.clear();
            processingMessageIdsRef.current.clear();
            pendingUnreadCountUpdatesRef.current.clear(); // ⭐ 대기 중인 unreadCount 업데이트도 초기화
          }
        } else {
          setMessages([]);
          setHasMore(false);
          processedMessageIdsRef.current.clear();
          processingMessageIdsRef.current.clear();
          pendingUnreadCountUpdatesRef.current.clear(); // ⭐ 대기 중인 unreadCount 업데이트도 초기화
        }
      } else {
        setMessages([]);
        setHasMore(false);
        processedMessageIdsRef.current.clear();
        processingMessageIdsRef.current.clear();
        pendingUnreadCountUpdatesRef.current.clear(); // ⭐ 대기 중인 unreadCount 업데이트도 초기화
      }
    }
    loadMessages();
  }, [selectedRoomId]);

  // ---------- 이전 메시지 로딩 (무한 스크롤) ----------
  const handleLoadMoreMessages = async () => {
    if (!selectedRoomId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    // 스크롤 위치 저장을 위한 ref (ChatMessageList에서 접근 가능하도록)
    const scrollContainerRef = document.querySelector('.chat-message-list-container');
    let scrollHeightBefore = 0;
    let scrollTopBefore = 0;

    if (scrollContainerRef) {
      scrollHeightBefore = scrollContainerRef.scrollHeight;
      scrollTopBefore = scrollContainerRef.scrollTop;
    }

    try {
      const nextPage = currentPage + 1;
      const res = await fetchChatRoomMessages(selectedRoomId, nextPage, 20);

      if (res && res.data) {
        // ResponseDTO 구조: { status, message, data: Page<ChatMessageResponseDTO> }
        const pageData = res.data.data || res.data; // res.data.data가 Page 객체
        if (pageData && Array.isArray(pageData.content)) {
          // 이전 메시지를 앞에 추가 (오름차순 유지)
          // pageData.content는 내림차순이므로 역순으로 정렬
          const newMessages = [...pageData.content].reverse();

          // ⭐ 중간에 초대된 사용자는 초대 시점부터의 메시지만 표시
          const currentUserId = userProfile?.id || userProfile?.userId;
          const currentUserEmail = userProfile?.email;
          let joinedAtTime = null;

          if (currentUserId || currentUserEmail) {
            // 현재 사용자의 입장 메시지 찾기 (기존 메시지 + 새로 로드한 메시지에서)
            const allMessagesForJoinCheck = [...messages, ...newMessages];
            const joinMessage = allMessagesForJoinCheck.find((msg) => {
              const isJoinOrInviteMessage = msg.messageContent && 
                (msg.messageContent.includes("님이 입장했습니다") || 
                 msg.messageContent.includes("님이 초대되었습니다"));
              
              // 메시지 내용에서 사용자 이름 추출하여 현재 사용자와 비교
              if (isJoinOrInviteMessage && msg.messageContent) {
                const nameMatch = msg.messageContent.match(/^(.+?)님이/);
                if (nameMatch) {
                  const messageSenderName = nameMatch[1];
                  // 현재 사용자 이름과 비교
                  const isMyJoinMessage = 
                    (userProfile?.name && messageSenderName === userProfile.name) ||
                    (msg.senderId === currentUserId) ||
                    (msg.senderEmail && currentUserEmail &&
                      msg.senderEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
                  return isMyJoinMessage;
                }
              }
              return false;
            });

            if (joinMessage && joinMessage.sendAt) {
              joinedAtTime = new Date(joinMessage.sendAt).getTime();
            }
          }

          // 초대 시점 이후의 메시지만 필터링
          // ⭐ 중요: 다른 사람의 입장 메시지도 초대 시점 이전이면 제외
          const filteredNewMessages = joinedAtTime
            ? newMessages.filter((msg) => {
              const msgTime = msg.sendAt ? new Date(msg.sendAt).getTime() : 0;
              
              // 입장/초대 메시지인 경우
              const isJoinOrInviteMessage = msg.messageContent && 
                (msg.messageContent.includes("님이 입장했습니다") || 
                 msg.messageContent.includes("님이 초대되었습니다"));
              
              if (isJoinOrInviteMessage) {
                // 메시지 내용에서 사용자 이름 추출
                const nameMatch = msg.messageContent.match(/^(.+?)님이/);
                if (nameMatch) {
                  const messageSenderName = nameMatch[1];
                  // 현재 사용자의 입장/초대 메시지인지 확인
                  const isMyMessage = 
                    (userProfile?.name && messageSenderName === userProfile.name) ||
                    (msg.senderId === currentUserId) ||
                    (msg.senderEmail && currentUserEmail &&
                      msg.senderEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase());
                  
                  // 현재 사용자의 입장/초대 메시지는 항상 포함
                  if (isMyMessage) {
                    return true;
                  }
                  // 다른 사람의 입장/초대 메시지는 초대 시점 이후만 포함
                  return msgTime >= joinedAtTime;
                }
              }
              
              // 일반 메시지는 초대 시점 이후만 포함
              return msgTime >= joinedAtTime;
            })
            : newMessages;

          // ⭐ 중복 메시지 체크: 이미 존재하는 메시지는 제외
          // ⭐ 중요: 기존 메시지의 unreadCount를 보존하기 위해 병합 로직 사용
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => {
              const mId = m?.id;
              return mId != null ? Number(mId) : null;
            }).filter(id => id != null));

            // ⭐ 기존 메시지의 unreadCount를 Map으로 저장 (병합 시 사용)
            const existingUnreadCounts = new Map();
            prev.forEach(m => {
              const mId = m?.id;
              if (mId != null) {
                existingUnreadCounts.set(Number(mId), m.unreadCount);
              }
            });

            const processedNewMessages = filteredNewMessages.map(msg => {
              const msgId = msg?.id;
              if (msgId == null) return null;
              const numId = Number(msgId);

              // ⭐ 대기 중인 unreadCount 업데이트 우선 적용
              const pendingUpdate = pendingUnreadCountUpdatesRef.current.get(numId);
              if (pendingUpdate !== undefined) {
                console.log("📊 [ChatLayout] 이전 메시지 로드 시 대기 중인 unreadCount 업데이트 적용:", {
                  chatId: numId,
                  이전unreadCount: msg.unreadCount,
                  새로운unreadCount: pendingUpdate
                });
                pendingUnreadCountUpdatesRef.current.delete(numId);
                return {
                  ...msg,
                  unreadCount: pendingUpdate,
                  fileUrls: msg.fileUrls || (msg.fileUrl ? [msg.fileUrl] : undefined), // fileUrls 보존
                  fileUrl: msg.fileUrl,
                  fileYn: msg.fileYn
                };
              }

              // ⭐ 기존 메시지가 있으면 unreadCount를 보존 (UNREAD_COUNT_UPDATE로 patch된 값 우선)
              if (existingIds.has(numId)) {
                const existingUnreadCount = existingUnreadCounts.get(numId);
                // ⭐ 기존에 patch된 unreadCount가 있으면 그것을 사용 (더 최신일 수 있음)
                if (existingUnreadCount != null) {
                  return {
                    ...msg,
                    unreadCount: existingUnreadCount,
                    fileUrls: msg.fileUrls || (msg.fileUrl ? [msg.fileUrl] : undefined), // fileUrls 보존
                    fileUrl: msg.fileUrl,
                    fileYn: msg.fileYn
                  };
                }
              }

              // ⭐ 새로운 메시지이거나 기존 unreadCount가 없으면 fetch된 값 사용
              // ⚠️ 중요: fileUrls 보존
              return {
                ...msg,
                fileUrls: msg.fileUrls || (msg.fileUrl ? [msg.fileUrl] : undefined),
                fileUrl: msg.fileUrl,
                fileYn: msg.fileYn
              };
            }).filter(msg => msg != null);

            // ⭐ 중복 제거: 기존에 없는 메시지만 추가
            const trulyNewMessages = processedNewMessages.filter(msg => {
              const msgId = msg?.id;
              if (msgId == null) return false;
              return !existingIds.has(Number(msgId));
            });

            // ⭐ 기존 메시지와 병합: 기존 메시지는 unreadCount 보존, 새로운 메시지는 추가
            const merged = prev.map(existingMsg => {
              const existingId = existingMsg?.id;
              if (existingId == null) return existingMsg;

              // ⭐ fetch된 메시지 중 같은 ID가 있으면 unreadCount를 보존한 채로 병합
              const fetchedMsg = processedNewMessages.find(m => Number(m.id) === Number(existingId));
              if (fetchedMsg) {
                // ⭐ 기존 unreadCount가 있으면 보존 (UNREAD_COUNT_UPDATE로 patch된 값)
                return {
                  ...fetchedMsg,
                  unreadCount: existingMsg.unreadCount != null ? existingMsg.unreadCount : fetchedMsg.unreadCount,
                  fileUrls: fetchedMsg.fileUrls || (fetchedMsg.fileUrl ? [fetchedMsg.fileUrl] : undefined), // fileUrls 보존
                  fileUrl: fetchedMsg.fileUrl,
                  fileYn: fetchedMsg.fileYn
                };
              }

              return existingMsg;
            });

            if (trulyNewMessages.length < processedNewMessages.length) {
              console.log("📨 [ChatLayout] 중복 메시지 제외 (이전 메시지 로딩, unreadCount 보존):", {
                전체메시지수: processedNewMessages.length,
                중복제외후: trulyNewMessages.length,
                제외된메시지수: processedNewMessages.length - trulyNewMessages.length,
                병합된메시지수: merged.length
              });
            }

            return [...trulyNewMessages, ...merged];
          });
          setTotalPages(pageData.totalPages || 0);
          setHasMore(!pageData.last);
          setCurrentPage(nextPage);
        }
      }
    } catch (error) {
      console.error("이전 메시지 로딩 실패:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ---------- STOMP 기반 채팅방 소켓 연결관리 ----------
  useEffect(() => {
    const useEffectTimestamp = new Date().toISOString();
    console.log('🔥 [ChatLayout] ========== STOMP useEffect 실행 ==========', {
      timestamp: useEffectTimestamp,
      selectedRoomId: selectedRoomId,
      현재socketConnected: socketConnected,
      현재messages배열길이: messages.length
    });

    if (!selectedRoomId) {
      console.log('🔥 [ChatLayout] selectedRoomId가 없어 연결하지 않음:', {
        timestamp: useEffectTimestamp,
        selectedRoomId: selectedRoomId
      });
      // ⭐ selectedRoomId가 없으면 기존 연결 해제
      setSocketConnected(false);
      disconnectStomp();
      return;
    }

    console.log('🔥 [ChatLayout] connectStomp 호출 시작:', {
      timestamp: useEffectTimestamp,
      roomId: selectedRoomId,
      이전연결상태: socketConnected
    });

    // ⭐ 중복 구독 방지: 기존 연결 해제 완료 후 새로 연결 (Promise 기반)
    console.log('🔥 [ChatLayout] 기존 연결 해제 시작');
    disconnectStomp().then(() => {
      console.log('🔥 [ChatLayout] 기존 연결 해제 완료, 새 연결 시작');
      connectStomp(
        selectedRoomId,
        msg => {
          // ⭐ 중복 메시지 수신 방지: handleNewMessage에서 이미 중복 체크를 하지만
          // WebSocket 구독이 중복되면 같은 메시지가 여러 번 수신될 수 있으므로
          // 여기서도 추가 로그를 남겨 디버깅 가능하도록 함
          const receiveTimestamp = new Date().toISOString();
          console.log('🔥 [ChatLayout] ========== WebSocket 메시지 수신 (콜백) ==========', {
            timestamp: receiveTimestamp,
            messageId: msg?.id,
            messageType: msg?.type || "일반메시지",
            roomId: msg?.roomId,
            selectedRoomId: selectedRoomId,
            senderEmail: msg?.senderEmail,
            unreadCount: msg?.unreadCount,
            chatId: msg?.chatId, // UNREAD_COUNT_UPDATE용
            현재messages배열길이: messages.length
          });
          handleNewMessage(msg);
          console.log('🔥 [ChatLayout] handleNewMessage 호출 완료:', {
            timestamp: receiveTimestamp,
            messageId: msg?.id
          });
        },
        () => {
          const connectTimestamp = new Date().toISOString();
          console.log('🔥 [ChatLayout] ========== 연결 성공 콜백 ==========', {
            timestamp: connectTimestamp,
            roomId: selectedRoomId,
            socketConnected변경전: socketConnected
          });
          setSocketConnected(true);
          console.log('🔥 [ChatLayout] socketConnected를 true로 설정 완료:', {
            timestamp: connectTimestamp
          });
        },
        () => {
          const errorTimestamp = new Date().toISOString();
          console.error('🔥 [ChatLayout] ========== 연결 에러 콜백 ==========', {
            timestamp: errorTimestamp,
            roomId: selectedRoomId,
            socketConnected변경전: socketConnected
          });
          setSocketConnected(false);
          console.log('🔥 [ChatLayout] socketConnected를 false로 설정 완료:', {
            timestamp: errorTimestamp
          });
        }
      );
    });

    return () => {
      const cleanupTimestamp = new Date().toISOString();
      console.log("🔥 [ChatLayout] ========== 채팅방 나가기 (cleanup) ==========", {
        timestamp: cleanupTimestamp,
        selectedRoomId: selectedRoomId,
        socketConnected변경전: socketConnected
      });
      setSocketConnected(false);
      // ⭐ cleanup에서는 Promise를 기다리지 않음 (컴포넌트 언마운트 시)
      disconnectStomp().catch(err => {
        console.warn("🔥 [ChatLayout] cleanup에서 disconnectStomp 실패 (무시):", err);
      });
      console.log("🔥 [ChatLayout] 소켓 연결 해제 요청 완료:", {
        timestamp: cleanupTimestamp
      });
    };
  }, [selectedRoomId]);

  // ---------- 메시지 박스 끝으로 스크롤 ----------
  const messagesEndRef = useRef(null);
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ⭐ 디버깅: messages 상태 변경 추적 (필요시 주석 해제)
  useEffect(() => {
    console.log("📋 [ChatLayout] messages 상태 변경:", {
      메시지수: messages.length,
      unreadCount포함메시지: messages.filter(m => m.unreadCount != null && m.unreadCount > 0).map(m => ({
        id: m.id,
        unreadCount: m.unreadCount,
        senderName: m.senderName
      })),
      전체메시지unreadCount: messages.map(m => ({ id: m.id, unreadCount: m.unreadCount }))
    });
  }, [messages]);

  // ---------- 읽지 않은 메시지 계산 및 첫 unread 인덱스 ----------
  const unreadCount = messages.reduce((cnt, msg) => cnt + (msg.readYn === false ? 1 : 0), 0);
  const firstUnreadIdx = unreadCount > 0 ? messages.findIndex(msg => msg.readYn === false) : -1;

  // ---------- 렌더링 ----------
  return (
    <Box className="chat-layout" sx={{
      background: "#fafbfc", minHeight: "100vh",
      display: "flex", flexDirection: "row"
    }}>
      {/* 우측 하단 토스트 알림 */}
      <ToastList rooms={toastRooms} formatTime={formatTime} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} />
      {/* ChatSidebar는 Topbar로 이동됨 */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", background: "#fafbfc" }}>
        <ChatHeader 
          onCreateRoom={() => setCreateOpen(true)}
        />
        <Box sx={{
          flex: 1, display: "flex", flexDirection: "row",
          px: 5, pt: 2, gap: 2, minHeight: 0
        }}>
          <ChatRoomListPane
            tabIdx={tabIdx}
            setTabIdx={setTabIdx}
            roomList={roomList}
            selectedRoomId={selectedRoomId}
            setSelectedRoomId={handleRoomSelect}
            unreadRoomCount={unreadRoomCount}
            formatTime={formatTime}
            highlightedRoomId={highlightedRoomId}
          />
          <ChatDetailPane
            selectedRoom={Array.isArray(roomList)
              ? roomList.find(r => r && r.roomId === selectedRoomId) : null}
            messages={messages}
            unreadCount={unreadCount}
            firstUnreadIdx={firstUnreadIdx}
            formatTime={formatTime}
            inputRef={inputRef}
            onSend={handleSend}
            onFileUpload={handleFileUpload}
            socketConnected={socketConnected}
            onScrollTop={handleLoadMoreMessages}
            isLoadingMore={isLoadingMore}
            hasMoreAbove={hasMore}
            scrollToUnread={scrollToUnread}
            onScrollToUnreadComplete={async () => {
              // 스크롤 완료 후 읽음 처리
              if (selectedRoomId) {
                try {
                  await markRoomMessagesAsRead(selectedRoomId);
                  console.log("[ChatLayout] 스크롤 완료 후 메시지 읽음 처리 완료 - roomId:", selectedRoomId);
                  
                  // 채팅방 목록의 unreadCount를 0으로 업데이트
                  setRoomList((prevRoomList) => {
                    const updated = prevRoomList.map(room => {
                      if (Number(room.roomId) === Number(selectedRoomId)) {
                        return {
                          ...room,
                          unreadCount: 0
                        };
                      }
                      return room;
                    });
                    return sortRoomList(updated);
                  });
                  
                  // 채팅방 목록 새로고침
                  await loadRooms(true, selectedRoomId);
                } catch (error) {
                  console.error("[ChatLayout] 메시지 읽음 처리 실패:", error);
                }
              }
              setScrollToUnread(false);
            }}
            onMarkAllAsRead={async () => {
              if (selectedRoomId) {
                try {
                  await markRoomMessagesAsRead(selectedRoomId);
                  loadRooms();
                  // 메시지 목록도 새로고침하여 읽음 상태 업데이트
                  if (selectedRoomId) {
                    const res = await fetchChatRoomMessages(selectedRoomId, 0, 20);
                    if (res && res.data) {
                      const messageList = Array.isArray(res.data.content) ? res.data.content : [];
                      setMessages(messageList);
                      setCurrentPage(0);
                      setTotalPages(res.data.totalPages || 0);
                      setHasMore(res.data.totalPages > 1);
                    }
                  }
                } catch (error) {
                  console.error("모두 읽음 처리 실패:", error);
                }
              }
            }}
            onLeaveRoom={handleLeaveRoom}
          />
        </Box>
      </Box>
      {/* 채팅방 생성 다이얼로그 */}
      <ChatRoomCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateRoom}
        presetUsers={presetUser}
      />
    </Box>
  );
}