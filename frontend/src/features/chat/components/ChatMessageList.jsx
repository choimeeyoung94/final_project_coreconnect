import React, { useRef, useContext } from "react";
import { Box, Typography, Avatar, IconButton } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { UserProfileContext } from "../../../App";

// ChatMessageList는 스크롤 관리에 관여하지 않도록 합니다.
// (위로 150px 이내면 onLoadMore 호출만 수행, 자동 스크롤 로직은 전부 제거)

function ChatMessageList({
  messages,
  roomType = "group",
  onLoadMore,
  hasMoreAbove,
  loadingAbove,
}) {
  const { userProfile } = useContext(UserProfileContext) || {};
  const scrollRef = useRef();

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    // 스크롤이 상단 150px 이내면 onLoadMore 호출
    const isNearTop = el.scrollTop <= 150;
    if (onLoadMore && hasMoreAbove && !loadingAbove && isNearTop) {
      console.log("🔄 [ChatMessageList] onLoadMore 호출 - 위치:", el.scrollTop);
      onLoadMore(); // 위치 저장/복원은 ChatLayout에서 처리
    }
  };

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      className="chat-message-list-container"
      sx={{
        height: "55vh",
        maxHeight: 600,
        overflowY: "auto",
        overflowAnchor: "none",
        background: "#fafbff",
        px: 3,
        pt: 2,
        pb: 2,
      }}
    >
      {loadingAbove && (
        <Box sx={{ textAlign: "center", py: 1, color: "#889" }}>
          불러오는 중...
        </Box>
      )}

      {!messages || messages.length === 0 ? (
        <Box
          sx={{
            minHeight: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            sx={{
              color: "text.disabled",
              fontSize: 16,
              textAlign: "center",
            }}
          >
            아직 메시지가 없습니다.
            <br />
            메시지를 입력해 대화를 시작해보세요.
          </Typography>
        </Box>
      ) : (
        messages.map((msg) => {
          const isMyMessage =
            msg.senderEmail === userProfile?.email ||
            msg.senderId === userProfile?.id;

          // 시스템 메시지 (입장/초대)
          if (
            msg.messageContent?.includes("님이 입장했습니다") ||
            msg.messageContent?.includes("님이 초대되었습니다") ||
            msg.messageContent?.includes("님이 나갔습니다")
          ) {
            return (
              <Box
                key={msg.id}
                sx={{
                  textAlign: "center",
                  my: 2,
                  color: "#888",
                  fontSize: 13,
                }}
              >
                {msg.messageContent}
              </Box>
            );
          }

          // 일반 메시지
          return (
            <Box
              key={msg.id}
              sx={{
                display: "flex",
                flexDirection: isMyMessage ? "row-reverse" : "row",
                alignItems: "flex-start",
                mb: 2,
              }}
            >
              {/* 프로필 사진 (내 메시지는 제외) */}
              {!isMyMessage && roomType === "group" && (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    mr: 1,
                    bgcolor: "#4a90e2",
                    fontSize: 14,
                  }}
                >
                  {msg.senderName?.charAt(0) || "U"}
                </Avatar>
              )}

              <Box
                sx={{
                  maxWidth: "70%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMyMessage ? "flex-end" : "flex-start",
                }}
              >
                {/* 발신자 이름 (내 메시지는 제외) */}
                {!isMyMessage && roomType === "group" && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: "#666",
                      mb: 0.5,
                      ml: 0.5,
                    }}
                  >
                    {msg.senderName || "알 수 없음"}
                  </Typography>
                )}

                {/* 메시지 내용 */}
                <Box
                  sx={{
                    bgcolor: isMyMessage ? "#4a90e2" : "#fff",
                    color: isMyMessage ? "#fff" : "#333",
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    wordBreak: "break-word",
                  }}
                >
                  <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>
                    {msg.messageContent}
                  </Typography>

                  {/* 파일 첨부 */}
                  {msg.fileYn === true && msg.fileUrls && msg.fileUrls.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {msg.fileUrls.map((fileUrl, idx) => {
                        const fileName = fileUrl.split("/").pop();
                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              mt: 0.5,
                            }}
                          >
                            <IconButton
                              size="small"
                              href={fileUrl}
                              download
                              sx={{ color: isMyMessage ? "#fff" : "#4a90e2" }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: isMyMessage ? "#fff" : "#4a90e2",
                                ml: 0.5,
                              }}
                            >
                              {fileName}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>

                {/* 시간 & 안읽은 수 */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mt: 0.5,
                    gap: 0.5,
                  }}
                >
                  {msg.unreadCount != null && msg.unreadCount > 0 && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "#f44336",
                        fontWeight: 600,
                      }}
                    >
                      {msg.unreadCount}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 11, color: "#999" }}>
                    {msg.sendAt
                      ? new Date(msg.sendAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}

export default ChatMessageList;
