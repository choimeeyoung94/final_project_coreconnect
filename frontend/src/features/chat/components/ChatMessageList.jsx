import React, { useRef, useEffect, useContext, useState } from "react";
import { Box, Typography, Link, Avatar } from "@mui/material";
import { UserProfileContext } from "../../../App";
import ImageCarouselDialog from "./ImageCarouselDialog";

// 첨부파일 유형 이미지 감지
const isImageFile = (url = "") => {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(cleanUrl);
};

// 시간 포맷 변환 (예: "오후 02:26")
const formatTime = (time) => {
  if (!time) return "";
  
  try {
    let date;
    const dateStr = String(time);
    
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
        date = new Date(Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        ));
        // 한국 시간은 UTC+9이므로 9시간을 빼서 UTC로 변환
        date = new Date(date.getTime() - (9 * 60 * 60 * 1000));
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(time);
    }
    
    if (Number.isNaN(date.getTime())) return time;
    
    // 한국 시간으로 변환하여 포맷팅
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: 'Asia/Seoul' });
  } catch (error) {
    console.error('[ChatMessageList] formatTime 에러:', error, time);
    return "";
  }
};

function ChatMessageList({ messages, roomType = "group", onLoadMore, hasMoreAbove, loadingAbove, onMessagesLoaded, scrollToUnread = false, onScrollToUnreadComplete }) {
  // 👇 로그인 정보 받기!
  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email;
  
  const scrollRef = useRef();
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1);
  const [showUnreadMarker, setShowUnreadMarker] = useState(false);
  const [markerDismissed, setMarkerDismissed] = useState(false); // 마커가 한 번 사라졌는지 추적
  const previousMessagesLengthRef = useRef(messages.length);
  const previousUnreadIndexRef = useRef(-1); // 이전 안읽은 메시지 인덱스 추적
  const scrollPositionRef = useRef({ scrollHeight: 0, scrollTop: 0 });
  const autoHideTimerRef = useRef(null);
  const unreadMarkerRef = useRef(null);

  // 무한 스크롤(위로 올릴 때 loadMore) - 스크롤 위치 유지
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    // 이전 메시지 로드 (무한 스크롤)
    if (onLoadMore && hasMoreAbove && !loadingAbove && el.scrollTop <= 24) {
      // 현재 스크롤 위치와 높이 저장
      scrollPositionRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
      
      // 이전 메시지 로드
      onLoadMore();
    }
    
    // 안읽은 메시지 마커 표시/숨김 처리
    // 스크롤을 끝까지 내리면 마커 영구적으로 숨김
    if (firstUnreadIndex >= 0 && !markerDismissed) {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      const isScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 10;
      
      // 스크롤을 끝까지 내리면 마커 영구적으로 숨김
      if (isScrolledToBottom) {
        setShowUnreadMarker(false);
        setMarkerDismissed(true); // 한 번 사라지면 다시 나타나지 않음
      } else {
        // 스크롤이 끝까지 내려가지 않았으면 마커 표시
        setShowUnreadMarker(true);
      }
    } else if (markerDismissed) {
      // 마커가 이미 사라졌으면 표시하지 않음
      setShowUnreadMarker(false);
    }
  };
  
  // 메시지가 추가되었을 때 스크롤 위치 복원
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loadingAbove) return;
    
    // 이전 메시지가 추가된 경우 (메시지 수가 증가하고 스크롤이 위쪽에 있을 때)
    const messagesIncreased = messages.length > previousMessagesLengthRef.current;
    const isScrolledToTop = el.scrollTop < 100;
    
    if (messagesIncreased && isScrolledToTop && scrollPositionRef.current.scrollHeight > 0) {
      const newScrollHeight = el.scrollHeight;
      const heightDiff = newScrollHeight - scrollPositionRef.current.scrollHeight;
      
      // 스크롤 위치 복원
      setTimeout(() => {
        if (el) {
          el.scrollTop = scrollPositionRef.current.scrollTop + heightDiff;
          scrollPositionRef.current = { scrollHeight: 0, scrollTop: 0 }; // 초기화
        }
      }, 0);
    }
    
    previousMessagesLengthRef.current = messages.length;
  }, [messages.length, loadingAbove]);

  // 첫 번째 안읽은 메시지 인덱스 찾기
  useEffect(() => {
    // readYn이 false인 경우를 안읽은 메시지로 처리
    // null이나 undefined는 읽은 것으로 간주
    const unreadIdx = messages.findIndex((msg) => {
      // readYn이 명시적으로 false인 경우만 안읽은 메시지로 처리
      return msg.readYn === false;
    });
    const hasUnreadMessages = unreadIdx >= 0;
    const previousUnreadIdx = previousUnreadIndexRef.current;
    
    setFirstUnreadIndex(unreadIdx);
    
    // 안읽은 메시지 인덱스가 변경되면 (새로운 안읽은 메시지가 생기거나 채팅방이 변경되면) 마커 리셋
    if (unreadIdx !== previousUnreadIdx) {
      setMarkerDismissed(false);
      previousUnreadIndexRef.current = unreadIdx;
    }
    
    // 안읽은 메시지가 있으면 항상 마커 표시 (markerDismissed가 false일 때만)
    if (hasUnreadMessages && !markerDismissed) {
      setShowUnreadMarker(true);
      console.log("✅ [ChatMessageList] 마커 표시 설정: true", {
        unreadIdx: unreadIdx,
        markerDismissed: markerDismissed,
        hasUnreadMessages: hasUnreadMessages,
        firstUnreadMessage: messages[unreadIdx]
      });
      // 기존 타이머가 있으면 취소
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    } else if (!hasUnreadMessages) {
      // 안읽은 메시지가 없으면 마커 숨김
      setShowUnreadMarker(false);
      console.log("❌ [ChatMessageList] 마커 숨김: 안읽은 메시지 없음");
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    } else if (markerDismissed && hasUnreadMessages) {
      // markerDismissed가 true이면 마커 숨김
      setShowUnreadMarker(false);
      console.log("❌ [ChatMessageList] 마커 숨김: markerDismissed=true");
    }
    
    // 디버깅 로그
    console.log("📌 [ChatMessageList] 안읽은 메시지 상태:", {
      unreadIdx: unreadIdx,
      hasUnreadMessages: hasUnreadMessages,
      showUnreadMarker: showUnreadMarker,
      markerDismissed: markerDismissed,
      messagesLength: messages.length,
      readYnValues: messages.map((m, i) => ({ 
        idx: i,
        id: m.id, 
        readYn: m.readYn, 
        readYnType: typeof m.readYn,
        isUnread: m.readYn === false
      })),
      firstUnreadMessage: unreadIdx >= 0 ? messages[unreadIdx] : null
    });
    
    // cleanup: 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [messages, showUnreadMarker, markerDismissed]);

  // 새 메시지 오면 항상 맨 아래로 스크롤 (안읽은 메시지가 없고 scrollToUnread가 false일 때만)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && messages.length > 0 && !scrollToUnread) {
      // 안읽은 메시지가 없을 때만 자동 스크롤
      if (firstUnreadIndex < 0) {
        // ⭐ 스크롤을 맨 아래로 내리기 (약간의 지연을 두어 DOM 업데이트 완료 후 실행)
        setTimeout(() => {
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        }, 100);
      }
    }
  }, [messages, firstUnreadIndex, scrollToUnread]);
  
  // ⭐ 안읽은 메시지 위치로 스크롤 (채팅방 선택 시)
  useEffect(() => {
    // scrollToUnread가 true이고 안읽은 메시지가 있고 메시지가 로드되었을 때만 실행
    if (!scrollToUnread || messages.length === 0) {
      if (scrollToUnread && firstUnreadIndex < 0 && onScrollToUnreadComplete) {
        // 안읽은 메시지가 없으면 즉시 콜백 호출
        onScrollToUnreadComplete();
      }
      return;
    }

    // firstUnreadIndex가 아직 계산되지 않았으면 대기
    if (firstUnreadIndex < 0) {
      // 안읽은 메시지가 없으면 콜백 호출
      if (onScrollToUnreadComplete) {
        onScrollToUnreadComplete();
      }
      return;
    }

    const el = scrollRef.current;
    if (!el) return;
    
    // 마커가 렌더링될 때까지 기다리는 함수
    const scrollToMarker = (retryCount = 0) => {
      const markerEl = unreadMarkerRef.current;
      
      // 마커가 렌더링되어야 함 (showUnreadMarker 체크 제거 - 마커가 렌더링되면 표시)
      if (el && markerEl) {
        // scrollIntoView를 사용하여 더 정확한 스크롤
        markerEl.scrollIntoView({ 
          behavior: 'auto', 
          block: 'start',
          inline: 'nearest'
        });
        
        // 추가로 약간의 여백을 위해 조정
        setTimeout(() => {
          if (el && markerEl) {
            const markerTop = markerEl.offsetTop;
            el.scrollTop = markerTop - 20; // 마커 위에 약간의 여백
          }
        }, 50);
        
        console.log("✅ [ChatMessageList] 안읽은 메시지 위치로 스크롤 성공:", {
          scrollTop: el.scrollTop,
          markerTop: markerEl.offsetTop,
          firstUnreadIndex: firstUnreadIndex,
          messagesLength: messages.length,
          retryCount: retryCount
        });
        
        // 스크롤 완료 후 콜백 호출
        if (onScrollToUnreadComplete) {
          onScrollToUnreadComplete();
        }
      } else if (el && !markerEl && retryCount < 30) {
        // 마커가 아직 렌더링되지 않았으면 재시도 (최대 30번, 총 3초)
        console.log("⏳ [ChatMessageList] 마커 대기 중...", {
          retryCount: retryCount,
          hasMarkerEl: !!markerEl,
          firstUnreadIndex: firstUnreadIndex,
          messagesLength: messages.length
        });
        setTimeout(() => scrollToMarker(retryCount + 1), 100);
      } else {
        // 재시도 횟수 초과 또는 조건 불만족 시
        console.warn("❌ [ChatMessageList] 안읽은 메시지 위치로 스크롤 실패:", {
          retryCount: retryCount,
          hasMarkerEl: !!markerEl,
          firstUnreadIndex: firstUnreadIndex,
          messagesLength: messages.length
        });
        if (onScrollToUnreadComplete) {
          onScrollToUnreadComplete();
        }
      }
    };
    
    // DOM 업데이트 완료 후 스크롤 (약간의 지연)
    // 메시지가 로드되고 마커가 렌더링될 시간을 줌
    setTimeout(() => scrollToMarker(), 300);
  }, [scrollToUnread, firstUnreadIndex, messages.length, onScrollToUnreadComplete]);

  // ⭐ 채팅방 선택 시 메시지 로드 후 최신 메시지로 스크롤 (안읽은 메시지가 없을 때만)
  // onMessagesLoaded prop이 호출되면 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (onMessagesLoaded && messages.length > 0 && firstUnreadIndex < 0) {
      const el = scrollRef.current;
      if (el) {
        // DOM 업데이트 완료 후 스크롤 (약간의 지연)
        setTimeout(() => {
          if (el) {
            el.scrollTop = el.scrollHeight;
            console.log("📜 [ChatMessageList] 채팅방 선택 시 최신 메시지로 스크롤:", {
              scrollTop: el.scrollTop,
              scrollHeight: el.scrollHeight,
              messagesLength: messages.length
            });
          }
        }, 200);
      }
    }
  }, [messages.length, onMessagesLoaded, firstUnreadIndex]);

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      className="chat-message-list-container"
      sx={{
        // 채팅 영역을 고정 높이로, 내부 스크롤 적용
        height: "55vh",
        maxHeight: 600,
        overflowY: "auto",
        background: "#fafbff",
        px: 3,
        pt: 2,
        pb: 2,
      }}
    >
      {/* 로딩 상태 표시 (무한스크롤용) */}
      {loadingAbove && (
        <Box sx={{ textAlign: "center", py: 1, color: "#889" }}>불러오는 중...</Box>
      )}

      {/* 메시지가 없을 때 안내 */}
      {(!messages || messages.length === 0) ? (
        <Box sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ color: "text.disabled", fontSize: 16, textAlign: "center" }}>
            아직 메시지가 없습니다.<br />
            메시지를 입력해 대화를 시작해보세요.
          </Typography>
        </Box>
      ) : (
        // 메시지 목록 map
        // ⭐ 디버깅: 첫 번째 메시지의 구조 확인 (개발 중 확인용)
        // messages.length > 0 && console.log("📨 [ChatMessageList] 첫 번째 메시지 구조:", {
        //   전체메시지수: messages.length,
        //   첫번째메시지: messages[0],
        //   senderProfileImageUrl: messages[0]?.senderProfileImageUrl,
        //   senderEmail: messages[0]?.senderEmail,
        //   senderName: messages[0]?.senderName
        // }),
        messages.map((msg, idx) => {
          // 안읽은 메시지의 첫 번째 메시지 위에 마커 표시
          // 조건: markerDismissed가 false이고, firstUnreadIndex가 유효하고, 현재 인덱스가 첫 번째 안읽은 메시지 인덱스와 일치
          const shouldShowMarker = !markerDismissed && firstUnreadIndex >= 0 && idx === firstUnreadIndex;
          
          // 디버깅: 모든 메시지에서 readYn 확인
          if (msg.readYn === false) {
            console.log("🔍 [ChatMessageList] 안읽은 메시지 발견:", {
              idx: idx,
              firstUnreadIndex: firstUnreadIndex,
              msgId: msg.id,
              msgReadYn: msg.readYn,
              shouldShowMarker: shouldShowMarker,
              markerDismissed: markerDismissed
            });
          }
          
          // 디버깅: 마커 표시 조건 확인 (첫 번째 안읽은 메시지 위치에서만)
          if (idx === firstUnreadIndex) {
            console.log("🔍 [ChatMessageList] 마커 표시 조건 확인 (첫 번째 안읽은 메시지):", {
              idx: idx,
              firstUnreadIndex: firstUnreadIndex,
              showUnreadMarker: showUnreadMarker,
              markerDismissed: markerDismissed,
              shouldShowMarker: shouldShowMarker,
              msgReadYn: msg.readYn,
              msgId: msg.id,
              msgContent: msg.messageContent
            });
          }
          // ⭐ 내 메시지 판별 로직
          // 1순위: senderEmail로 비교 (가장 정확함) - 백엔드에서 항상 포함하도록 수정됨
          // 2순위: senderEmail이 없을 경우 senderId로 비교 (fallback - 비권장)
          // 대소문자/공백 차이를 방지하기 위해 trim().toLowerCase() 적용
          let isMine = false;
          
          if (msg.senderEmail && userEmail) {
            // ✅ senderEmail이 있으면 이메일로 비교 (가장 정확한 방법)
            // 백엔드에서 모든 메시지에 senderEmail을 명시적으로 설정하도록 수정됨
            isMine = msg.senderEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
          } else if (msg.senderId && userProfile) {
            // ⚠️ Fallback: senderEmail이 없을 경우 senderId로 비교
            // 주의: 이 방법은 덜 정확할 수 있으므로 백엔드에서 senderEmail을 항상 포함하도록 수정 필요
            // userProfile.id 또는 userProfile.userId 등 사용 가능한 필드 확인 필요
            const userId = userProfile.id || userProfile.userId;
            if (userId) {
              isMine = msg.senderId === userId;
              console.warn("⚠️ senderEmail이 없어 senderId로 판별합니다 (fallback):", {
                senderId: msg.senderId,
                userId: userId,
                senderName: msg.senderName,
                senderEmail: msg.senderEmail
              });
            }
          }
          
          // ⚠️ 디버깅용 콘솔 로그 (senderEmail이 없을 때만 출력)
          // 백엔드 수정 후에는 이 로그가 나타나지 않아야 함
          if (!msg.senderEmail) {
            console.error("❌ MSG에 senderEmail이 없습니다! 백엔드 수정 필요:", {
              senderName: msg.senderName,
              senderEmail: msg.senderEmail,
              senderId: msg.senderId,
              userEmail: userEmail,
              userProfile: userProfile,
              isMine: isMine
            });
          }
          
          // ⚠️ 디버깅용 콘솔 로그 (senderProfileImageUrl이 없거나 빈 문자열일 때 출력)
          // 프로필 이미지가 제대로 설정되지 않았을 때 확인용
          // 개발 중에만 활성화 (필요시 주석 해제)
          // if (!msg.senderProfileImageUrl || msg.senderProfileImageUrl.trim() === '') {
          //   console.warn("⚠️ MSG에 senderProfileImageUrl이 없거나 빈 문자열입니다:", {
          //     senderName: msg.senderName,
          //     senderEmail: msg.senderEmail,
          //     senderProfileImageUrl: msg.senderProfileImageUrl,
          //     senderId: msg.senderId,
          //     messageId: msg.id,
          //     전체메시지: msg,
          //     note: "프로필 이미지가 없으면 기본 이니셜이 표시됩니다. DB의 user_profile_image_key를 확인하세요."
          //   });
          // } else {
          //   // 프로필 이미지 URL이 있을 때도 확인 (개발 중)
          //   console.log("✅ 프로필 이미지 URL 있음:", {
          //     senderName: msg.senderName,
          //     senderEmail: msg.senderEmail,
          //     senderProfileImageUrl: msg.senderProfileImageUrl,
          //     url길이: msg.senderProfileImageUrl.length
          //   });
          // }

          // 안읽은 메시지 마커 (첫 번째 안읽은 메시지 위에 표시)
          // ref는 첫 번째 안읽은 메시지에만 설정
          const markerElement = shouldShowMarker ? (
            <Box
              key={`unread-marker-${idx}`}
              ref={idx === firstUnreadIndex ? unreadMarkerRef : null}
              sx={{
                textAlign: "center",
                py: 1.5,
                px: 2,
                mb: 2,
                borderTop: "1px solid #e3e8ef",
                borderBottom: "1px solid #e3e8ef",
                bgcolor: "#fafbff",
                width: "100%",
              }}
            >
              <Typography
                sx={{
                  fontSize: 13,
                  color: "#999",
                  fontWeight: 500,
                }}
              >
                여기서부터 안읽은 메시지입니다
              </Typography>
            </Box>
          ) : null;
          
          // 디버깅: 마커 렌더링 확인
          if (shouldShowMarker) {
            console.log("✅ [ChatMessageList] 마커 렌더링:", {
              idx: idx,
              firstUnreadIndex: firstUnreadIndex,
              markerElement: markerElement !== null
            });
          }

          // ========== 시스템 메시지 (가운데 정렬, 회색) ==========
          // 초대, 입장, 나가기 메시지를 시스템 메시지로 처리
          const isSystemMessage = msg.messageContent && (
            msg.messageContent.includes("님이 초대되었습니다") ||
            msg.messageContent.includes("님이 입장했습니다") ||
            msg.messageContent.includes("님이 채팅방을 나갔습니다")
          );
          
          if (isSystemMessage) {
            return (
              <React.Fragment key={msg.id ?? idx}>
                {markerElement}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    mb: 2,
                    textAlign: "center",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: "#999",
                      fontWeight: 400,
                      px: 2,
                      py: 0.5,
                    }}
                  >
                    {msg.messageContent}
                  </Typography>
                </Box>
              </React.Fragment>
            );
          }

          // ========== 내가 보낸 메시지 (오른쪽, 이름 없음, 파란 테마) ==========
          if (isMine) {
            return (
              <React.Fragment key={msg.id ?? idx}>
                {markerElement}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    mb: 2,
                    textAlign: "right",
                  }}
                >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    width: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  {/* ⭐ 안읽은 사람 수 표시 (메시지 왼쪽) - 파란색으로 표시 */}
                  {msg.unreadCount != null && msg.unreadCount > 0 && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "#1976d2", // 파란색으로 변경
                        fontWeight: 600,
                        alignSelf: "flex-start",
                        mt: 1.2,
                      }}
                    >
                      {msg.unreadCount}
                    </Typography>
                  )}
                  
                  <Box
                    sx={{
                      // 밝은 파란색 배경, 파란색 글씨로 스타일링
                      bgcolor: "#e3f2fd",
                      color: "#1976d2",
                      borderRadius: 2,
                      px: 2,
                      py: 1.2,
                      maxWidth: "70%", // 최대 너비 제한 (긴 메시지용)
                      width: "fit-content", // 텍스트 크기만큼만 차지
                      wordBreak: "break-word",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* 메시지 내용 */}
                    {msg.messageContent && (
                      <Typography sx={{ color: "#1976d2" }}>
                        {msg.messageContent}
                      </Typography>
                    )}

                    {/* 첨부파일(이미지/파일 링크, 색상은 유지) */}
                    {msg.fileYn && (
                      // ⭐ 여러 이미지가 있는 경우 가로로 나열 (상대방 메시지와 동일한 로직)
                      msg.fileUrls && msg.fileUrls.length > 0 ? (
                        // 여러 이미지인 경우
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 1.5,
                            mt: 1.5,
                            p: 1.5,
                            bgcolor: "rgba(25, 118, 210, 0.05)",
                            borderRadius: 2,
                            border: "1px solid rgba(25, 118, 210, 0.15)",
                          }}
                        >
                          {msg.fileUrls.map((fileUrl, idx) => {
                            if (!fileUrl) return null;
                            const isImage = isImageFile(fileUrl);
                            return isImage ? (
                              <Box
                                key={idx}
                                component="img"
                                src={fileUrl}
                                alt={`첨부 이미지 ${idx + 1}`}
                                onError={(e) => {
                                  console.error("❌ [ChatMessageList] 이미지 로드 실패:", {
                                    fileUrl,
                                    messageId: msg.id,
                                    index: idx
                                  });
                                  e.target.style.display = "none";
                                }}
                                onClick={() => {
                                  // 현재 메시지의 모든 이미지 URL 수집
                                  const imageUrls = msg.fileUrls.filter(url => url && isImageFile(url));
                                  const currentIndex = imageUrls.indexOf(fileUrl);
                                  setCarouselImages(imageUrls);
                                  setCarouselStartIndex(currentIndex >= 0 ? currentIndex : 0);
                                  setCarouselOpen(true);
                                }}
                                sx={{
                                  width: msg.fileUrls.length === 1 ? 200 : 150,
                                  height: msg.fileUrls.length === 1 ? 200 : 150,
                                  borderRadius: 1.5,
                                  border: "1px solid rgba(25, 118, 210, 0.2)",
                                  objectFit: "cover",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  "&:hover": {
                                    opacity: 0.85,
                                    transform: "scale(1.02)",
                                    boxShadow: "0 4px 8px rgba(25, 118, 210, 0.2)",
                                  },
                                }}
                              />
                            ) : (
                              <Box
                                key={idx}
                                sx={{
                                  bgcolor: "#fff",
                                  border: "1px solid #90caf9",
                                  borderRadius: 1.5,
                                  px: 2,
                                  py: 1.5,
                                  minWidth: 150,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: "#1976d2" }}>
                                  첨부 파일
                                </Typography>
                                <Link
                                  href={fileUrl}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const link = document.createElement("a");
                                    link.href = fileUrl;
                                    link.download = decodeURIComponent(fileUrl.split("/").pop()?.split("?")[0] || "파일");
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  underline="hover"
                                  sx={{ fontSize: 13, wordBreak: "break-all", color: "#1976d2", cursor: "pointer" }}
                                >
                                  {decodeURIComponent(fileUrl.split("/").pop()?.split("?")[0] || "파일 다운로드")}
                                </Link>
                              </Box>
                            );
                          })}
                        </Box>
                      ) : msg.fileUrl ? (
                        // 단일 파일인 경우 (기존 로직 유지)
                        isImageFile(msg.fileUrl) ? (
                          <Box
                            component="img"
                            src={msg.fileUrl}
                            alt="첨부 이미지"
                            onClick={() => {
                              // 현재 메시지의 이미지들을 포함한 모든 이미지 URL 수집
                              const imageUrls = messages
                                .filter(m => m.fileYn && m.fileUrl && isImageFile(m.fileUrl))
                                .map(m => m.fileUrl);
                              const currentIndex = imageUrls.indexOf(msg.fileUrl);
                              setCarouselImages(imageUrls);
                              setCarouselStartIndex(currentIndex >= 0 ? currentIndex : 0);
                              setCarouselOpen(true);
                            }}
                            sx={{
                              width: "100%",
                              maxWidth: 280,
                              borderRadius: 1.5,
                              border: "1px solid #e1e4eb",
                              objectFit: "cover",
                              mt: 1,
                              cursor: "pointer",
                              "&:hover": {
                                opacity: 0.8,
                              },
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              bgcolor: "#fff",
                              border: "1px solid #90caf9",
                              borderRadius: 1.5,
                              px: 1.5,
                              py: 0.8,
                              mt: 1
                            }}
                          >
                            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: "#1976d2" }}>
                              첨부 파일
                            </Typography>
                            <Link
                              href={msg.fileUrl}
                              onClick={(e) => {
                                e.preventDefault();
                                // 파일 다운로드
                                const link = document.createElement("a");
                                link.href = msg.fileUrl;
                                link.download = decodeURIComponent(msg.fileUrl.split("/").pop()?.split("?")[0] || "파일");
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              underline="hover"
                              sx={{ fontSize: 13, wordBreak: "break-all", color: "#1976d2", cursor: "pointer" }}
                            >
                              {decodeURIComponent(msg.fileUrl.split("/").pop()?.split("?")[0] || "파일 다운로드")}
                            </Link>
                          </Box>
                        )
                      ) : null
                    )}
                  </Box>
                </Box>

                {/* 전송 시간 (하단) */}
                <Typography sx={{ fontSize: 12, color: "#90caf9", mt: 0.5 }}>
                  {formatTime(msg.sendAt)}
                </Typography>
              </Box>
              </React.Fragment>
            );
          }

          // ========== 상대방 메시지 (왼쪽, 이름/프로필/회색 테마) ==========
          return (
            <React.Fragment key={msg.id ?? idx}>
              {markerElement}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  mb: 2,
                }}
              >
              {/* ⭐ 프로필 아바타 - user_profile_image_key에서 가져온 이미지 표시 */}
              {/* 
                프로필 이미지 표시 로직:
                1. msg.senderProfileImageUrl이 유효한 URL이면 이미지 표시
                2. 없거나 빈 문자열이면 기본 이니셜 표시
                3. 이미지 로드 실패 시 자동으로 이니셜 표시
              */}
              {(() => {
                // ⭐ 디버깅: 실제로 Avatar에 전달되는 URL 확인
                const profileImageUrl = msg.senderProfileImageUrl && msg.senderProfileImageUrl.trim() !== '' 
                  ? msg.senderProfileImageUrl 
                  : undefined;
                
                // ⚠️ 디버깅 로그 (개발 중 확인용 - 필요시 주석 해제)
                // console.log("💡 [ChatMessageList] Avatar src 설정:", {
                //   senderName: msg.senderName,
                //   senderEmail: msg.senderEmail,
                //   senderProfileImageUrl: msg.senderProfileImageUrl,
                //   profileImageUrl: profileImageUrl,
                //   url타입: typeof profileImageUrl,
                //   url길이: profileImageUrl?.length || 0,
                //   url시작: profileImageUrl?.substring(0, 20) || "없음",
                //   isCompleteUrl: profileImageUrl?.startsWith("http://") || profileImageUrl?.startsWith("https://"),
                //   messageId: msg.id
                // });
                
                return (
                  <Avatar
                    src={profileImageUrl}
                    sx={{
                      bgcolor: "#bdbdbd",
                      width: 36,
                      height: 36,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#212121",
                    }}
                    imgProps={{
                      onError: (e) => {
                        // ⚠️ 이미지 로드 실패 시 fallback 처리 (이니셜 표시)
                        // 이미지가 로드되지 않으면 Avatar의 children(이니셜)이 자동으로 표시됨
                        e.target.style.display = 'none';
                        console.error("❌ [ChatMessageList] 프로필 이미지 로드 실패:", {
                          senderName: msg.senderName,
                          senderEmail: msg.senderEmail,
                          profileImageUrl: msg.senderProfileImageUrl,
                          실제src값: e.target.src,
                          messageId: msg.id,
                          note: "이미지 URL을 브라우저에서 직접 열어보세요. 403 에러면 S3 권한 문제입니다."
                        });
                      },
                      onLoad: () => {
                        // ✅ 이미지 로드 성공 시 디버깅 로그
                        console.log("✅ [ChatMessageList] 프로필 이미지 로드 성공:", {
                          senderName: msg.senderName,
                          profileImageUrl: msg.senderProfileImageUrl,
                          실제로드된URL: profileImageUrl
                        });
                      }
                    }}
                  >
                    {/* 
                      프로필 이미지가 없거나 빈 문자열일 때 기본 이니셜 표시
                      - senderName의 첫 글자를 대문자로 변환
                      - senderName이 없으면 "?" 표시
                    */}
                    {(!msg.senderProfileImageUrl || msg.senderProfileImageUrl.trim() === '') && 
                      (msg.senderName?.[0]?.toUpperCase() || "?")}
                  </Avatar>
                );
              })()}

              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1 }}>
                {/* 이름 / 직급 / 부서 - 한 줄에 표시 */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#212121", display: "inline-block" }}>
                    {msg.senderName || "이름 없음"}
                  </Typography>
                  {msg.senderJobGrade && (
                    <>
                      <Typography sx={{ fontSize: 13, color: "#666", display: "inline-block" }}>/</Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          bgcolor: "action.selected",
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: 12,
                          display: "inline-block",
                        }}
                      >
                        {(() => {
                          const gradeMap = {
                            INTERN: "인턴",
                            STAFF: "사원",
                            ASSISTANT_MANAGER: "대리",
                            MANAGER: "과장",
                            DEPUTY_GENERAL_MANAGER: "차장",
                            GENERAL_MANAGER: "부장",
                            DIRECTOR: "이사",
                            EXECUTIVE_DIRECTOR: "상무",
                            VICE_PRESIDENT: "전무",
                            PRESIDENT: "대표",
                          };
                          return gradeMap[msg.senderJobGrade] || msg.senderJobGrade;
                        })()}
                      </Typography>
                    </>
                  )}
                  {msg.senderDeptName && (
                    <>
                      <Typography sx={{ fontSize: 13, color: "#666", display: "inline-block" }}>/</Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "primary.main",
                          fontSize: 12,
                          display: "inline-block",
                        }}
                      >
                        {msg.senderDeptName}
                      </Typography>
                    </>
                  )}
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "#f5f5f5",
                      color: "#212121",
                      borderRadius: 2,
                      px: 2,
                      py: 1.2,
                      maxWidth: "70%", // 최대 너비 제한 (긴 메시지용)
                      width: "fit-content", // 텍스트 크기만큼만 차지
                      wordBreak: "break-word",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* 메시지 내용(어두운 회색) */}
                    {msg.messageContent && (
                      <Typography sx={{ color: "#212121" }}>
                        {msg.messageContent}
                      </Typography>
                    )}

                    {/* 첨부파일 (배경색은 유지) */}
                    {msg.fileYn && (
                      // ⚠️ 디버깅: fileUrls 확인
                      (() => {
                        console.log("[ChatMessageList] ⚠️ 파일 렌더링 체크:", {
                          messageId: msg.id,
                          fileYn: msg.fileYn,
                          fileUrl: msg.fileUrl,
                          fileUrls: msg.fileUrls,
                          fileUrls타입: Array.isArray(msg.fileUrls) ? "배열" : typeof msg.fileUrls,
                          fileUrls길이: msg.fileUrls?.length,
                          fileUrls존재여부: msg.fileUrls != null,
                          fileUrls빈배열여부: Array.isArray(msg.fileUrls) && msg.fileUrls.length === 0,
                          조건1: msg.fileUrls && msg.fileUrls.length > 0,
                          조건2: msg.fileUrl && isImageFile(msg.fileUrl)
                        });
                        if (msg.fileUrls && msg.fileUrls.length > 0) {
                          console.log("[ChatMessageList] ✅ 여러 파일 렌더링:", {
                            messageId: msg.id,
                            fileUrls: msg.fileUrls,
                            fileUrlsLength: msg.fileUrls.length,
                            fileUrl: msg.fileUrl
                          });
                        } else if (msg.fileUrl) {
                          console.log("[ChatMessageList] ⚠️ 단일 파일 렌더링 (fileUrls 없음):", {
                            messageId: msg.id,
                            fileUrl: msg.fileUrl,
                            fileUrls: msg.fileUrls,
                            fileUrls타입: typeof msg.fileUrls
                          });
                        } else {
                          console.log("[ChatMessageList] ❌ 파일 없음:", {
                            messageId: msg.id,
                            fileYn: msg.fileYn,
                            fileUrl: msg.fileUrl,
                            fileUrls: msg.fileUrls
                          });
                        }
                        return null;
                      })()
                    )}
                    {msg.fileYn && (
                      // ⭐ 여러 이미지가 있는 경우 가로로 나열 (예쁘게 묶어서 표시)
                      msg.fileUrls && msg.fileUrls.length > 0 ? (
                        // 여러 이미지인 경우
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 1.5,
                            mt: 1.5,
                            p: 1.5,
                            bgcolor: "rgba(0, 0, 0, 0.02)",
                            borderRadius: 2,
                            border: "1px solid rgba(0, 0, 0, 0.08)",
                          }}
                        >
                          {msg.fileUrls.map((fileUrl, idx) => {
                            if (!fileUrl) return null;
                            const isImage = isImageFile(fileUrl);
                            return isImage ? (
                              <Box
                                key={idx}
                                component="img"
                                src={fileUrl}
                                alt={`첨부 이미지 ${idx + 1}`}
                                onError={(e) => {
                                  // 이미지 로드 실패 시 처리
                                  console.error("❌ [ChatMessageList] 이미지 로드 실패:", {
                                    fileUrl,
                                    messageId: msg.id,
                                    index: idx
                                  });
                                  // 이미지 숨기기 (대체 UI 표시 가능)
                                  e.target.style.display = "none";
                                }}
                                onClick={() => {
                                  // 현재 메시지의 모든 이미지 URL 수집
                                  const imageUrls = msg.fileUrls.filter(url => url && isImageFile(url));
                                  const currentIndex = imageUrls.indexOf(fileUrl);
                                  setCarouselImages(imageUrls);
                                  setCarouselStartIndex(currentIndex >= 0 ? currentIndex : 0);
                                  setCarouselOpen(true);
                                }}
                                sx={{
                                  width: msg.fileUrls.length === 1 ? 200 : 150,
                                  height: msg.fileUrls.length === 1 ? 200 : 150,
                                  borderRadius: 1.5,
                                  border: "1px solid rgba(0, 0, 0, 0.12)",
                                  objectFit: "cover",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  "&:hover": {
                                    opacity: 0.85,
                                    transform: "scale(1.02)",
                                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
                                  },
                                }}
                              />
                            ) : (
                              <Box
                                key={idx}
                                sx={{
                                  bgcolor: "#f5f5f5",
                                  border: "1px solid #ddd",
                                  borderRadius: 1.5,
                                  px: 2,
                                  py: 1.5,
                                  minWidth: 150,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: "#212121" }}>
                                  첨부 파일
                                </Typography>
                                <Link
                                  href={fileUrl}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const link = document.createElement("a");
                                    link.href = fileUrl;
                                    link.download = fileUrl.split("/").pop();
                                    link.click();
                                  }}
                                  sx={{ fontSize: 12, color: "#1976d2", textDecoration: "underline", cursor: "pointer" }}
                                >
                                  파일 다운로드
                                </Link>
                              </Box>
                            );
                          })}
                        </Box>
                      ) : msg.fileUrl && isImageFile(msg.fileUrl) ? (
                        // 단일 이미지인 경우 (하위 호환성)
                        <Box
                          component="img"
                          src={msg.fileUrl}
                          alt="첨부 이미지"
                          onError={(e) => {
                            // 이미지 로드 실패 시 처리
                            console.error("❌ [ChatMessageList] 단일 이미지 로드 실패:", {
                              fileUrl: msg.fileUrl,
                              messageId: msg.id
                            });
                            // 이미지 숨기기 (대체 UI 표시 가능)
                            e.target.style.display = "none";
                          }}
                          onClick={() => {
                            // 현재 메시지의 이미지들을 포함한 모든 이미지 URL 수집
                            const imageUrls = messages
                              .filter(m => m.fileYn && m.fileUrl && isImageFile(m.fileUrl))
                              .map(m => m.fileUrl);
                            const currentIndex = imageUrls.indexOf(msg.fileUrl);
                            setCarouselImages(imageUrls);
                            setCarouselStartIndex(currentIndex >= 0 ? currentIndex : 0);
                            setCarouselOpen(true);
                          }}
                          sx={{
                            width: "100%",
                            maxWidth: 280,
                            borderRadius: 1.5,
                            border: "1px solid #bdbdbd",
                            objectFit: "cover",
                            mt: 1,
                            cursor: "pointer",
                            "&:hover": {
                              opacity: 0.8,
                            },
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            bgcolor: "#eeeeee",
                            border: "1px solid #ccc",
                            borderRadius: 1.5,
                            px: 1.5,
                            py: 0.8,
                            mt: 1
                          }}
                        >
                          <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5, color: "#212121" }}>
                            첨부 파일
                          </Typography>
                          <Link
                            href={msg.fileUrl}
                            onClick={(e) => {
                              e.preventDefault();
                              // 파일 다운로드
                              const link = document.createElement("a");
                              link.href = msg.fileUrl;
                              link.download = decodeURIComponent(msg.fileUrl.split("/").pop()?.split("?")[0] || "파일");
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            underline="hover"
                            sx={{ fontSize: 13, wordBreak: "break-all", color: "#1565c0", cursor: "pointer" }}
                          >
                            {decodeURIComponent(msg.fileUrl.split("/").pop()?.split("?")[0] || "파일 다운로드")}
                          </Link>
                        </Box>
                      )
                    )}
                  </Box>
                  
                  {/* ⭐ 안읽은 사람 수 표시 (메시지 오른쪽) */}
                  {msg.unreadCount != null && msg.unreadCount > 0 && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "#1976d2",
                        fontWeight: 600,
                        alignSelf: "flex-start",
                        mt: 1.2,
                      }}
                    >
                      {msg.unreadCount}
                    </Typography>
                  )}
                </Box>

                {/* 전송 시간 (하단) */}
                <Typography sx={{ fontSize: 12, color: "#757575", mt: 0.5 }}>
                  {formatTime(msg.sendAt)}
                </Typography>
              </Box>
            </Box>
            </React.Fragment>
          );
        })
      )}
      
      {/* 이미지 캐러셀 다이얼로그 */}
      <ImageCarouselDialog
        open={carouselOpen}
        onClose={() => setCarouselOpen(false)}
        images={carouselImages}
        currentIndex={carouselStartIndex}
      />
    </Box>
  );
}

export default ChatMessageList;
