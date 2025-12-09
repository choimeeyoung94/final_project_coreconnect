import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import { fetchChatRoomUsers } from "../api/ChatRoomApi";

/**
 * 채팅방 참여자 목록 다이얼로그
 * 참여자의 이름, 직급, 이메일, 프로필 이미지를 표시
 */
function ChatRoomParticipantsDialog({ open, onClose, roomId }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 직급 한글 라벨 변환
  const getJobGradeLabel = (jobGrade) => {
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
    return jobGrade ? gradeMap[jobGrade] || jobGrade : "";
  };

  // 참여자 목록 조회
  useEffect(() => {
    if (open && roomId) {
      setLoading(true);
      setError(null);
      
      fetchChatRoomUsers(roomId)
        .then((userList) => {
          // ⚠️ 디버깅: 원본 응답 확인
          console.log("🔍 [ChatRoomParticipantsDialog] 원본 응답:", userList);
          console.log("🔍 [ChatRoomParticipantsDialog] 원본 응답 타입:", typeof userList);
          console.log("🔍 [ChatRoomParticipantsDialog] 원본 응답이 배열인가?", Array.isArray(userList));
          
          // fetchChatRoomUsers에서 이미 ResponseDTO.data를 추출하여 반환
          // userList는 List<ChatUserResponseDTO> 또는 빈 배열
          const participantsList = Array.isArray(userList) ? userList : [];
          
          // ⚠️ 디버깅: 각 참여자 객체 상세 확인
          participantsList.forEach((u, index) => {
            console.log(`🔍 [ChatRoomParticipantsDialog] 참여자 ${index + 1}:`, {
              전체객체: u,
              객체키목록: Object.keys(u || {}),
              id: u?.id,
              name: u?.name,
              email: u?.email,
              jobGrade: u?.jobGrade,
              deptName: u?.deptName,
              profileImageUrl: u?.profileImageUrl,
              profileImageUrl타입: typeof u?.profileImageUrl,
              profileImageUrl값: u?.profileImageUrl,
              profileImageUrl길이: u?.profileImageUrl?.length || 0,
              isCompleteUrl: u?.profileImageUrl?.startsWith("http://") || u?.profileImageUrl?.startsWith("https://"),
            });
          });
          
          // 디버깅: 참여자 목록과 프로필 이미지 URL 확인
          console.log("📋 [ChatRoomParticipantsDialog] 참여자 목록 조회 완료:", {
            참여자수: participantsList.length,
            원본응답: userList,
            참여자목록: participantsList.map(u => ({
              id: u.id,
              name: u.name,
              email: u.email,
              jobGrade: u.jobGrade,
              deptName: u.deptName,
              profileImageUrl: u.profileImageUrl,
              profileImageUrl타입: typeof u.profileImageUrl,
              profileImageUrl값: u.profileImageUrl,
              profileImageUrl길이: u.profileImageUrl?.length || 0,
              isCompleteUrl: u.profileImageUrl?.startsWith("http://") || u.profileImageUrl?.startsWith("https://"),
              전체객체: u // 전체 객체 확인용
            }))
          });
          
          setParticipants(participantsList);
        })
        .catch((err) => {
          console.error("채팅방 참여자 조회 실패:", err);
          setError("참여자 목록을 불러오는데 실패했습니다.");
          setParticipants([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setParticipants([]);
    }
  }, [open, roomId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      {/* ⭐ HTML 중첩 오류 해결: DialogTitle은 기본적으로 h2로 렌더링되므로 component를 div로 변경 */}
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
          채팅방 참여자
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          {participants.length}명
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, minHeight: 300, maxHeight: 500 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 200,
            }}
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 200,
              p: 3,
            }}
          >
            <Typography color="error">{error}</Typography>
          </Box>
        ) : participants.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 200,
              p: 3,
            }}
          >
            <Typography color="text.secondary">
              참여자가 없습니다.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {participants.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  py: 1.5,
                  px: 2,
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemAvatar>
                  {/* ⭐ 프로필 아바타 - user_profile_image_key에서 가져온 이미지 표시 */}
                  {(() => {
                    // 프로필 이미지 URL 확인 및 설정
                    const profileImageUrl = user.profileImageUrl && user.profileImageUrl.trim() !== "" 
                      ? user.profileImageUrl 
                      : undefined;
                    
                    // ⚠️ 디버깅 로그 (개발 중 확인용 - 필요시 주석 해제)
                    // console.log("💡 [ChatRoomParticipantsDialog] Avatar src 설정:", {
                    //   name: user.name,
                    //   email: user.email,
                    //   profileImageUrl: user.profileImageUrl,
                    //   실제사용URL: profileImageUrl,
                    //   url타입: typeof profileImageUrl,
                    //   url길이: profileImageUrl?.length || 0,
                    //   isCompleteUrl: profileImageUrl?.startsWith("http://") || profileImageUrl?.startsWith("https://")
                    // });
                    
                    return (
                      <Avatar
                        src={profileImageUrl}
                        sx={{
                          bgcolor: "primary.main",
                          width: 48,
                          height: 48,
                          fontSize: 18,
                          fontWeight: 700,
                        }}
                        imgProps={{
                          onError: (e) => {
                            // ⚠️ 이미지 로드 실패 시 fallback 처리 (이니셜 표시)
                            e.target.style.display = "none";
                            console.error("❌ [ChatRoomParticipantsDialog] 프로필 이미지 로드 실패:", {
                              name: user.name,
                              email: user.email,
                              profileImageUrl: user.profileImageUrl,
                              실제src값: e.target.src,
                              note: "이미지 URL을 브라우저에서 직접 열어보세요. 403 에러면 S3 권한 문제입니다."
                            });
                          },
                          onLoad: () => {
                            // ✅ 이미지 로드 성공 시 디버깅 로그
                            console.log("✅ [ChatRoomParticipantsDialog] 프로필 이미지 로드 성공:", {
                              name: user.name,
                              profileImageUrl: user.profileImageUrl
                            });
                          }
                        }}
                      >
                        {/* 프로필 이미지가 없거나 빈 문자열일 때 기본 이니셜 표시 */}
                        {!user.profileImageUrl || user.profileImageUrl.trim() === ""
                          ? user.name?.[0]?.toUpperCase() || "?"
                          : null}
                      </Avatar>
                    );
                  })()}
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, color: "text.primary" }}
                      >
                        {user.name || "이름 없음"}
                      </Typography>
                      {user.jobGrade && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            bgcolor: "action.selected",
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: 12,
                          }}
                        >
                          {getJobGradeLabel(user.jobGrade)}
                        </Typography>
                      )}
                      {user.deptName && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "primary.main",
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: 12,
                          }}
                        >
                          {user.deptName}
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", mt: 0.5 }}
                    >
                      {user.email || "이메일 없음"}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChatRoomParticipantsDialog;

