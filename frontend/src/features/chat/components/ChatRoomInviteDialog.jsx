import React, { useState, useEffect, useMemo } from "react";
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
  ListItemButton,
  Checkbox,
  Avatar,
  Typography,
  Box,
  CircularProgress,
  TextField,
} from "@mui/material";
import http from "../../../api/http";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";

/**
 * 채팅방 참여자 초대 다이얼로그
 * 체크박스로 여러 사용자를 선택하여 초대
 */
function ChatRoomInviteDialog({ open, onClose, roomId, onInviteSuccess }) {
  const { showSnack } = useSnackbarContext();
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // 모든 사용자 목록 조회 (초대 가능한 사용자만)
  useEffect(() => {
    if (open && roomId) {
      setLoading(true);
      console.log("🔍 [ChatRoomInviteDialog] 사용자 목록 조회 시작 - roomId:", roomId);
      console.log("🔍 [ChatRoomInviteDialog] API URL:", `/chat/${roomId}/users/available`);
      
      // 채팅방 초대 가능한 사용자 목록 조회 API 사용
      const apiPromise = http.get(`/chat/${roomId}/users/available`);
      console.log("🔍 [ChatRoomInviteDialog] API Promise 생성됨:", apiPromise);
      
      apiPromise
        .then((res) => {
          console.log("✅ [ChatRoomInviteDialog] API 응답 전체:", res);
          console.log("✅ [ChatRoomInviteDialog] res.status:", res.status);
          console.log("✅ [ChatRoomInviteDialog] res.data:", res.data);
          console.log("✅ [ChatRoomInviteDialog] res.data 타입:", typeof res.data);
          console.log("✅ [ChatRoomInviteDialog] res.data.data:", res.data?.data);
          
          // 응답 처리
          let users = [];
          const responseData = res.data;
          
          // 다양한 응답 구조 처리
          console.log("✅ [ChatRoomInviteDialog] responseData 전체 구조:", JSON.stringify(responseData, null, 2));
          
          if (responseData?.data && Array.isArray(responseData.data)) {
            // ResponseDTO 구조: { status, message, data: List<ChatUserResponseDTO> }
            users = responseData.data;
            console.log("✅ [ChatRoomInviteDialog] ResponseDTO.data에서 사용자 추출:", users.length);
          } else if (Array.isArray(responseData)) {
            // 직접 배열인 경우
            users = responseData;
            console.log("✅ [ChatRoomInviteDialog] 직접 배열에서 사용자 추출:", users.length);
          } else if (responseData?.content && Array.isArray(responseData.content)) {
            // Page 구조: { content: [...], totalElements: ... }
            users = responseData.content;
            console.log("✅ [ChatRoomInviteDialog] Page.content에서 사용자 추출:", users.length);
          } else {
            // 응답 구조를 찾지 못한 경우
            console.warn("⚠️ [ChatRoomInviteDialog] 알 수 없는 응답 구조:", responseData);
            console.warn("⚠️ [ChatRoomInviteDialog] responseData 키:", Object.keys(responseData || {}));
            
            // 모든 가능한 필드 확인
            if (responseData) {
              for (const key in responseData) {
                if (Array.isArray(responseData[key])) {
                  console.log(`⚠️ [ChatRoomInviteDialog] 배열 필드 발견: ${key}, 길이: ${responseData[key].length}`);
                  users = responseData[key];
                  break;
                }
              }
            }
          }
          
          console.log("✅ [ChatRoomInviteDialog] 최종 사용자 수:", users.length);
          console.log("✅ [ChatRoomInviteDialog] 사용자 목록:", users);
          if (users.length > 0) {
            console.log("✅ [ChatRoomInviteDialog] 첫 번째 사용자:", users[0]);
            console.log("✅ [ChatRoomInviteDialog] 첫 번째 사용자 키:", Object.keys(users[0]));
          } else {
            console.warn("⚠️ [ChatRoomInviteDialog] 사용자 목록이 비어있습니다!");
            console.warn("⚠️ [ChatRoomInviteDialog] responseData:", responseData);
          }
          
          setAllUsers(users);
          
          // 참여자 ID는 빈 Set으로 설정 (이미 필터링된 상태)
          setParticipantIds(new Set());
        })
        .catch((err) => {
          console.error("❌ [ChatRoomInviteDialog] 초대 가능한 사용자 목록 조회 실패:", err);
          console.error("❌ [ChatRoomInviteDialog] 에러 상세:", err.response?.data || err.message);
          console.error("❌ [ChatRoomInviteDialog] 에러 응답:", err.response);
          console.error("❌ [ChatRoomInviteDialog] 에러 상태 코드:", err.response?.status);
          
          // Fallback을 즉시 실행
          console.log("🔄 [ChatRoomInviteDialog] Fallback 방식으로 사용자 목록 조회 시도...");
          
          // Fallback: 기존 방식으로 시도
          Promise.all([
            http.get("/admin/users")
              .catch(() => {
                console.log("🔄 [ChatRoomInviteDialog] /admin/users 실패, /user/organization 시도");
                return http.get("/user/organization");
              })
              .catch(() => {
                console.log("🔄 [ChatRoomInviteDialog] /user/organization 실패, /user/list 시도");
                return http.get("/user/list");
              })
              .catch(() => {
                console.log("🔄 [ChatRoomInviteDialog] /user/list 실패, /user 시도");
                return http.get("/user");
              }),
            http.get(`/chat/${roomId}/users`)
          ])
            .then(([usersRes, participantsRes]) => {
              console.log("✅ [ChatRoomInviteDialog] Fallback API 응답 - usersRes:", usersRes);
              console.log("✅ [ChatRoomInviteDialog] Fallback API 응답 - participantsRes:", participantsRes);
              
              let users = [];
              const usersData = usersRes.data;
              
              console.log("✅ [ChatRoomInviteDialog] usersData:", usersData);
              console.log("✅ [ChatRoomInviteDialog] usersData 타입:", typeof usersData);
              console.log("✅ [ChatRoomInviteDialog] usersData가 배열인가?", Array.isArray(usersData));
              
              if (Array.isArray(usersData)) {
                users = usersData;
                console.log("✅ [ChatRoomInviteDialog] 배열에서 사용자 추출:", users.length);
              } else if (usersData?.data && Array.isArray(usersData.data)) {
                users = usersData.data;
                console.log("✅ [ChatRoomInviteDialog] data.data에서 사용자 추출:", users.length);
              } else if (usersData?.content && Array.isArray(usersData.content)) {
                users = usersData.content;
                console.log("✅ [ChatRoomInviteDialog] content에서 사용자 추출:", users.length);
              }
              
              console.log("✅ [ChatRoomInviteDialog] Fallback 사용자 수:", users.length);
              
              const participants = Array.isArray(participantsRes.data?.data) 
                ? participantsRes.data.data 
                : Array.isArray(participantsRes.data) 
                ? participantsRes.data 
                : [];
              const participantIdsSet = new Set(participants.map((p) => p.id));
              
              console.log("✅ [ChatRoomInviteDialog] 참여자 수:", participants.length);
              console.log("✅ [ChatRoomInviteDialog] 참여자 ID 목록:", Array.from(participantIdsSet));
              
              const availableUsers = users.filter((user) => {
                if (!user.id) return false;
                return !participantIdsSet.has(user.id);
              });
              
              console.log("✅ [ChatRoomInviteDialog] Fallback 초대 가능한 사용자 수:", availableUsers.length);
              
              setAllUsers(availableUsers);
              setParticipantIds(participantIdsSet);
            })
            .catch((fallbackErr) => {
              console.error("❌ [ChatRoomInviteDialog] Fallback 사용자 목록 조회도 실패:", fallbackErr);
              console.error("❌ [ChatRoomInviteDialog] Fallback 에러:", fallbackErr.response?.data || fallbackErr.message);
              setAllUsers([]);
              setParticipantIds(new Set());
            });
        })
        .finally(() => {
          console.log("✅ [ChatRoomInviteDialog] API 호출 완료 - allUsers 상태:", allUsers.length);
          setLoading(false);
        });
    } else {
      setSelectedUserIds(new Set());
      setSearchTerm("");
      setAllUsers([]);
      setParticipantIds(new Set());
    }
  }, [open, roomId]);

  // 현재 채팅방 참여자 ID 목록 (위의 useEffect에서 설정됨, 디버깅용)
  // eslint-disable-next-line no-unused-vars
  const [participantIds, setParticipantIds] = useState(new Set());
  
  // 디버깅: allUsers 변경 추적
  useEffect(() => {
    console.log("📊 [ChatRoomInviteDialog] allUsers 상태 변경:", allUsers.length);
    if (allUsers.length > 0) {
      console.log("📊 [ChatRoomInviteDialog] 첫 번째 사용자:", allUsers[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers.length]);

  // 검색 필터링 (이미 참여자 제외된 사용자 목록에서 검색)
  const filteredUsers = useMemo(() => {
    if (searchTerm.trim() === "") {
      console.log("🔍 [ChatRoomInviteDialog] 검색어 없음, 전체 사용자 표시:", allUsers.length);
      return allUsers;
    }
    
    const filtered = allUsers.filter((user) => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = user.name && user.name.toLowerCase().includes(searchLower);
      const emailMatch = user.email && user.email.toLowerCase().includes(searchLower);
      const jobGradeMatch = user.jobGrade && getJobGradeLabel(user.jobGrade).toLowerCase().includes(searchLower);
      const deptNameMatch = (user.deptName || user.departmentName) && 
                            (user.deptName || user.departmentName).toLowerCase().includes(searchLower);
      
      return nameMatch || emailMatch || jobGradeMatch || deptNameMatch;
    });
    
    console.log("🔍 [ChatRoomInviteDialog] 검색어:", searchTerm);
    console.log("🔍 [ChatRoomInviteDialog] 전체 사용자 수:", allUsers.length);
    console.log("🔍 [ChatRoomInviteDialog] 필터링된 사용자 수:", filtered.length);
    if (filtered.length > 0) {
      console.log("🔍 [ChatRoomInviteDialog] 필터링된 첫 번째 사용자:", filtered[0]);
    }
    
    return filtered;
  }, [allUsers, searchTerm]);

  const handleToggleUser = (userId, e) => {
    // 이벤트 전파 방지
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // userId가 없으면 처리하지 않음
    if (!userId) {
      console.warn("⚠️ [ChatRoomInviteDialog] userId가 없습니다:", userId);
      return;
    }
    
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      const wasSelected = newSet.has(userId);
      
      if (wasSelected) {
        newSet.delete(userId);
        console.log("🔘 [ChatRoomInviteDialog] 사용자 선택 해제:", {
          userId,
          이전선택된수: prev.size,
          새로운선택된수: newSet.size
        });
      } else {
        newSet.add(userId);
        console.log("🔘 [ChatRoomInviteDialog] 사용자 선택:", {
          userId,
          이전선택된수: prev.size,
          새로운선택된수: newSet.size
        });
      }
      
      return newSet;
    });
  };

  const handleInvite = () => {
    if (selectedUserIds.size === 0) {
      showSnack("초대할 사용자를 선택해주세요.", "warning");
      return;
    }
    setConfirmDialogOpen(true);
  };

  const handleConfirmInvite = async () => {
    setConfirmDialogOpen(false);
    setInviting(true);
    try {
      const res = await http.post(`/chat/${roomId}/invite`, {
        userIds: Array.from(selectedUserIds),
      });

      if (res.data?.status === 200 || res.status === 200) {
        showSnack("사용자를 초대했습니다.", "success");
        setSelectedUserIds(new Set());
        onInviteSuccess?.();
        onClose();
      } else {
        throw new Error("초대 실패");
      }
    } catch (err) {
      console.error("초대 실패:", err);
      showSnack("초대에 실패했습니다: " + (err.response?.data?.message || err.message), "error");
    } finally {
      setInviting(false);
    }
  };

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
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
          참여자 초대
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          초대할 사용자를 선택하세요
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, minHeight: 300, maxHeight: 500 }}>
        {/* 검색 필드 */}
        <Box sx={{ p: 2, borderBottom: "1px solid #e3e8ef" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="이름 또는 이메일로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Box>

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
        ) : allUsers.length === 0 ? (
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
              초대 가능한 사용자가 없습니다.
            </Typography>
          </Box>
        ) : filteredUsers.length === 0 ? (
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
              검색 결과가 없습니다.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredUsers.map((user) => {
              const userId = user.id || user.userId;
              if (!userId) {
                console.warn("⚠️ [ChatRoomInviteDialog] 사용자 ID가 없습니다:", user);
                return null;
              }
              
              return (
              <ListItem
                key={userId}
                disablePadding
                sx={{
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemButton
                  onClick={(e) => {
                    e.preventDefault();
                    handleToggleUser(userId, e);
                  }}
                  sx={{ py: 1.5, px: 2 }}
                >
                  <Checkbox
                    checked={selectedUserIds.has(userId)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleUser(userId, e);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    sx={{ mr: 1 }}
                  />
                  <ListItemAvatar>
                    <Avatar
                      src={user.profileImageUrl || user.profileImageKey}
                      sx={{
                        bgcolor: "primary.main",
                        width: 40,
                        height: 40,
                      }}
                      imgProps={{
                        onError: (e) => {
                          e.target.style.display = "none";
                        }
                      }}
                    >
                      {user.name?.[0]?.toUpperCase() || "?"}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {user.name || "이름 없음"}
                        </Typography>
                        {(user.jobGrade || user.jobGradeName) && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              bgcolor: "action.selected",
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontSize: 12,
                            }}
                          >
                            {getJobGradeLabel(user.jobGrade || user.jobGradeName)}
                          </Typography>
                        )}
                        {(user.deptName || user.departmentName) && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "primary.main",
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontSize: 12,
                            }}
                          >
                            {user.deptName || user.departmentName}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        {user.email || "이메일 없음"}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose}>취소</Button>
        <Button
          onClick={handleInvite}
          variant="contained"
          color="primary"
          disabled={selectedUserIds.size === 0 || inviting}
        >
          {inviting ? "초대 중..." : `초대 (${selectedUserIds.size}명)`}
        </Button>
      </DialogActions>
      
      <ConfirmDialog
        open={confirmDialogOpen}
        title="참여자 초대"
        message={`${selectedUserIds.size}명의 사용자를 초대하시겠습니까?`}
        onConfirm={handleConfirmInvite}
        onCancel={() => setConfirmDialogOpen(false)}
      />
    </Dialog>
  );
}

export default ChatRoomInviteDialog;

