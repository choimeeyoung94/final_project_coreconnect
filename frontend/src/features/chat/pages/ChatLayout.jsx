import React, { useState, useEffect, useRef, useContext } from "react";

import { Box } from "@mui/material";
import ChatHeader from "../components/ChatHeader";
import ChatSidebar from "../components/ChatSidebar";
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

// ===================== 시간 및 유저명 유틸 함수 =====================
// 시간 포맷팅 유틸
function formatTime(sendAt) {
  if (!sendAt) return "";
  const d = new Date(sendAt);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } else {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }
}

// 유저이름 얻기 유틸
function getUserName() {
  try {
    const user = useContext(UserProfileContext);
    return user?.name || "";
  } catch {
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

  const userName = getUserName(); // 유저명
  const accessToken = localStorage.getItem("accessToken"); // 엑세스토큰
  const inputRef = useRef(); // 입력창 관리 ref

  const [socketConnected, setSocketConnected] = useState(false); // 소켓 연결 상태
  
  // 페이징 관련 상태
  const [currentPage, setCurrentPage] = useState(0); // 현재 페이지 (0부터 시작)
  const [hasMore, setHasMore] = useState(true); // 더 불러올 메시지가 있는지
  const [isLoadingMore, setIsLoadingMore] = useState(false); // 이전 메시지 로딩 중인지
  const [totalPages, setTotalPages] = useState(0); // 전체 페이지 수
  
  // ⭐ 중복 메시지 방지: 최근 처리한 메시지 ID 추적 (동시 호출 방지)
  const processedMessageIdsRef = useRef(new Set());
  const processingMessageIdsRef = useRef(new Set()); // 현재 처리 중인 메시지 ID
  
  // ⭐ UNREAD_COUNT_UPDATE 대기 큐: 메시지가 아직 로드되지 않은 경우 unreadCount 업데이트 저장
  const pendingUnreadCountUpdatesRef = useRef(new Map()); // chatId -> unreadCount

  // ---------- 읽지 않은 채팅방 개수 계산 ----------
  const unreadRoomCount = Array.isArray(roomList)
    ? roomList.filter((room) => room && room.unreadCount > 0).length
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
      
      setSelectedRoomId(roomId); // 방 생성시에만 바로 진입
      setCreateOpen(false);
      // 목록 새로고침하여 최신 상태 유지 (백엔드에서 받은 데이터로 동기화)
      setTimeout(() => loadRooms(), 500);
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
    if (msg && msg.type === "UNREAD_COUNT_UPDATE") {
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
    if (msg && msg.type === "ROOM_UNREAD_COUNT_UPDATE") {
      console.log("📊 [ChatLayout] ⭐ ROOM_UNREAD_COUNT_UPDATE 조건 만족! 처리 시작");
      const { roomId, chatId } = msg;
      
      const roomIdNum = Number(roomId);
      const isCurrentlySelected = Number(selectedRoomId) === roomIdNum;
      
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
        console.log("📊 [ChatLayout] ROOM_UNREAD_COUNT_UPDATE 수신 (현재 선택된 방):", {
          roomId: roomIdNum,
          chatId: chatId,
          selectedRoomId: selectedRoomId
        });
      }
      
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
        const newMessage = {
          ...msg,
          unreadCount: msg.unreadCount != null ? msg.unreadCount : 0
        };
        
        console.log("🔥 [ChatLayout] 새 메시지 객체 생성:", {
          id: newMessage.id,
          roomId: newMessage.roomId,
          messageContent: newMessage.messageContent,
          unreadCount: newMessage.unreadCount,
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
            전체메시지수: updated.length
          });
          return updated;
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
      const newMessage = {
        ...msg,
        unreadCount: msg.unreadCount != null ? msg.unreadCount : 0
      };
      
      // ⭐ 디버깅: 다른 사람이 보낸 메시지의 unreadCount 확인 (필요시 주석 해제)
      console.log("📨 [ChatLayout] 다른 사람이 보낸 메시지 수신:", {
        messageId: msg.id,
        senderName: msg.senderName,
        senderEmail: msg.senderEmail,
        unreadCount: newMessage.unreadCount,
        messageContent: msg.messageContent,
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
            전체메시지수: updated.length
          });
          return updated;
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
    setRoomList((prevRoomList) => {
      const updated = prevRoomList.map(room => {
        if (Number(room.roomId) === roomIdNum) {
          // ⭐ 현재 선택된 방이 아닌 경우에만 unreadCount 증가
          // (현재 선택된 방이면 이미 메시지를 보고 있으므로 읽음 처리됨)
          const isCurrentlySelected = Number(selectedRoomId) === roomIdNum;
          const currentUnreadCount = room.unreadCount || 0;
          
          // ⭐ 자신이 보낸 메시지가 아니고, 현재 선택된 방이 아닌 경우 unreadCount 증가
          const isMyMessage = msg.senderEmail && userProfile?.email && 
                              msg.senderEmail.trim().toLowerCase() === userProfile.email.trim().toLowerCase();
          
          let newUnreadCount = currentUnreadCount;
          if (!isMyMessage && !isCurrentlySelected) {
            // ⭐ 새로운 메시지가 왔으므로 unreadCount 증가
            // 백엔드에서 받은 unreadCount가 있으면 그것을 사용하고, 없으면 +1
            newUnreadCount = msg.unreadCount != null ? Number(msg.unreadCount) : currentUnreadCount + 1;
            console.log("📨 [ChatLayout] 다른 방의 새 메시지 수신 - unreadCount 증가:", {
              roomId: roomIdNum,
              roomName: room.roomName,
              이전unreadCount: currentUnreadCount,
              새로운unreadCount: newUnreadCount,
              isMyMessage,
              isCurrentlySelected,
              msgUnreadCount: msg.unreadCount
            });
          } else if (msg.unreadCount != null) {
            // ⭐ 백엔드에서 받은 unreadCount가 있으면 그것을 사용 (더 정확함)
            newUnreadCount = Number(msg.unreadCount);
          }
          
          return {
            ...room,
            lastMessageContent: msg.messageContent,
            lasMessageTime: msg.sendAt,
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

  // ---------- 파일 업로드 ----------
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedRoomId) return;
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/v1/chat/${selectedRoomId}/messages/file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData
      });
      if (!res.ok) throw new Error("파일 업로드 실패");
      const result = await res.json();
      const chatMessage = result.data;
      
      // ⭐ 중복 메시지 체크: 이미 같은 ID의 메시지가 있으면 추가하지 않음
      setMessages((prev) => {
        const exists = prev.some(m => {
          const mId = m?.id;
          const newId = chatMessage?.id;
          if (mId == null || newId == null) return false;
          return Number(mId) === Number(newId);
        });
        if (exists) {
          console.log("📨 [ChatLayout] 중복 메시지 무시 (파일 업로드):", {
            messageId: chatMessage.id,
            messageContent: chatMessage.messageContent
          });
          return prev;
        }
        return [...prev, chatMessage];
      });
    } catch (err) {
      alert("파일 업로드에 실패했습니다: " + err.message);
    }
    e.target.value = "";
  };

  // ---------- 다중 파일 업로드 ----------
  const handleMultiFileUpload = async (formData) => {
    if (!selectedRoomId) {
      throw new Error("채팅방이 선택되지 않았습니다.");
    }

    try {
      const res = await fetch(`/api/v1/chat/${selectedRoomId}/messages/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "파일 업로드 실패");
      }

      const result = await res.json();
      const chatMessages = result.data; // Array of ChatResponseDTO

      // Add all uploaded messages to the message list
      setMessages((prev) => {
        const newMessages = chatMessages.filter(newMsg => {
          // Check for duplicates
          const exists = prev.some(m => {
            const mId = m?.id;
            const newId = newMsg?.id;
            if (mId == null || newId == null) return false;
            return Number(mId) === Number(newId);
          });
          return !exists;
        });

        if (newMessages.length > 0) {
          console.log("📨 [ChatLayout] 다중 파일 업로드 성공:", {
            uploadedCount: newMessages.length,
            totalCount: chatMessages.length
          });
        }

        return [...prev, ...newMessages];
      });

      // Update room list with latest message
      if (chatMessages.length > 0) {
        const lastMessage = chatMessages[chatMessages.length - 1];
        setRoomList((prevList) => {
          const updated = prevList.map((room) => {
            if (room && room.roomId === selectedRoomId) {
              return {
                ...room,
                lastMessageContent: lastMessage.messageContent || "이미지",
                lasMessageTime: lastMessage.sendAt,
              };
            }
            return room;
          });
          return sortRoomList(updated);
        });
      }
    } catch (err) {
      console.error("다중 파일 업로드 실패:", err);
      throw err; // Re-throw to let component handle it
    }
  };

  // ---------- 메시지 보내기 ----------
  const handleSend = () => {
    const message = inputRef.current.value;
    if (!message.trim()) {
      return;
    }
    
    if (!socketConnected) {
      alert("채팅 서버와 연결되어 있지 않습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    // ⭐ WebSocket을 통해 메시지 전송 (서버에서 브로드캐스트된 메시지를 수신하여 표시)
    // ⭐ 재연결이 필요한 경우를 대비해 콜백 전달
    sendStompMessage(
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
    ).then((success) => {
      if (success) {
        inputRef.current.value = "";
      } else {
        // ⭐ 연결이 안 되어 있으면 재연결 시도 후 다시 전송 시도
        if (!socketConnected) {
          console.warn('🔥 [ChatLayout] 연결이 끊어져 재연결 시도 중...');
          // 재연결은 connectStomp가 useEffect에서 처리됨
          alert("채팅 서버와 연결되어 있지 않습니다. 잠시 후 다시 시도해 주세요.");
        } else {
          alert("메시지 전송에 실패했습니다. 연결 상태를 확인해주세요.");
        }
      }
    }).catch((error) => {
      console.error('🔥 [ChatLayout] 메시지 전송 중 예외 발생:', error);
      alert("메시지 전송 중 오류가 발생했습니다.");
    });
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
  const loadRooms = async () => {
    const res = await fetchChatRoomsLatest();
    if (res && Array.isArray(res.data)) {
      // 정렬 함수 사용
      const sortedRooms = sortRoomList(res.data);
      setRoomList(sortedRooms);
      setSelectedRoomId(null); // ★ 첫 진입시 아무 방도 자동 선택 안 함
    } else {
      setRoomList([]);
      setSelectedRoomId(null);
    }
  };

  // ---------- 채팅방 목록 최초 로드 ----------
  useEffect(() => {
    loadRooms();
  }, []);

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
            const messagesWithPendingUpdates = sortedMessages.map((m) => {
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
            
          // ⭐ 채팅방 접속 시 안읽은 메시지들을 읽음 처리
          // 이렇게 하면 내가 읽은 메시지들의 unreadCount가 -1씩 감소됨
          try {
            await markRoomMessagesAsRead(selectedRoomId);
            console.log("[ChatLayout] 채팅방 접속 시 메시지 읽음 처리 완료 - roomId:", selectedRoomId);
          } catch (error) {
            console.error("[ChatLayout] 메시지 읽음 처리 실패:", error);
          }
          
          // ⭐ 채팅방 변경 시 처리된 메시지 ID 초기화 (새 방의 메시지 로드)
          processedMessageIdsRef.current.clear();
          processingMessageIdsRef.current.clear();
          pendingUnreadCountUpdatesRef.current.clear(); // ⭐ 대기 중인 unreadCount 업데이트도 초기화
          } else if (Array.isArray(pageData)) {
            // 기존 형식 (배열) 지원
            setMessages(pageData);
            setHasMore(false);
            
            // ⭐ 채팅방 접속 시 안읽은 메시지들을 읽음 처리
            try {
              await markRoomMessagesAsRead(selectedRoomId);
              console.log("[ChatLayout] 채팅방 접속 시 메시지 읽음 처리 완료 - roomId:", selectedRoomId);
            } catch (error) {
              console.error("[ChatLayout] 메시지 읽음 처리 실패:", error);
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
            
            const filteredNewMessages = newMessages.map(msg => {
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
                return { ...msg, unreadCount: pendingUpdate };
              }
              
              // ⭐ 기존 메시지가 있으면 unreadCount를 보존 (UNREAD_COUNT_UPDATE로 patch된 값 우선)
              if (existingIds.has(numId)) {
                const existingUnreadCount = existingUnreadCounts.get(numId);
                // ⭐ 기존에 patch된 unreadCount가 있으면 그것을 사용 (더 최신일 수 있음)
                if (existingUnreadCount != null) {
                  return {
                    ...msg,
                    unreadCount: existingUnreadCount
                  };
                }
              }
              
              // ⭐ 새로운 메시지이거나 기존 unreadCount가 없으면 fetch된 값 사용
              return msg;
            }).filter(msg => msg != null);
            
            // ⭐ 중복 제거: 기존에 없는 메시지만 추가
            const trulyNewMessages = filteredNewMessages.filter(msg => {
              const msgId = msg?.id;
              if (msgId == null) return false;
              return !existingIds.has(Number(msgId));
            });
            
            // ⭐ 기존 메시지와 병합: 기존 메시지는 unreadCount 보존, 새로운 메시지는 추가
            const merged = prev.map(existingMsg => {
              const existingId = existingMsg?.id;
              if (existingId == null) return existingMsg;
              
              // ⭐ fetch된 메시지 중 같은 ID가 있으면 unreadCount를 보존한 채로 병합
              const fetchedMsg = filteredNewMessages.find(m => Number(m.id) === Number(existingId));
              if (fetchedMsg) {
                // ⭐ 기존 unreadCount가 있으면 보존 (UNREAD_COUNT_UPDATE로 patch된 값)
                return {
                  ...fetchedMsg,
                  unreadCount: existingMsg.unreadCount != null ? existingMsg.unreadCount : fetchedMsg.unreadCount
                };
              }
              
              return existingMsg;
            });
            
            if (trulyNewMessages.length < newMessages.length) {
              console.log("📨 [ChatLayout] 중복 메시지 제외 (이전 메시지 로딩, unreadCount 보존):", {
                전체메시지수: newMessages.length,
                중복제외후: trulyNewMessages.length,
                제외된메시지수: newMessages.length - trulyNewMessages.length,
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
      {/* 왼쪽 사이드바 + 방 생성 */}
      <ChatSidebar unreadRoomCount={unreadRoomCount} onCreateRoom={() => setCreateOpen(true)} />
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", background: "#fafbfc" }}>
        <ChatHeader />
        <Box sx={{
          flex: 1, display: "flex", flexDirection: "row",
          px: 5, pt: 2, gap: 2, minHeight: 0
        }}>
          <ChatRoomListPane
            tabIdx={tabIdx}
            setTabIdx={setTabIdx}
            roomList={roomList}
            selectedRoomId={selectedRoomId}
            setSelectedRoomId={setSelectedRoomId}
            unreadRoomCount={unreadRoomCount}
            formatTime={formatTime}
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
            onMultiFileUpload={handleMultiFileUpload}
            socketConnected={socketConnected}
            onScrollTop={handleLoadMoreMessages}
            isLoadingMore={isLoadingMore}
            hasMoreAbove={hasMore}
          />
        </Box>
      </Box>
      {/* 채팅방 생성 다이얼로그 */}
      <ChatRoomCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateRoom} />
    </Box>
  );
}