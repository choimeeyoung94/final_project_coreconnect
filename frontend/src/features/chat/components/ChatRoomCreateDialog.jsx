import React, { useState, useEffect, useMemo, useContext } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Radio, RadioGroup, FormControlLabel,
  Chip, List, ListItem, ListItemButton, ListItemAvatar, ListItemText,
  Checkbox, Avatar, CircularProgress
} from "@mui/material";
import http from "../../../api/http";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import { UserProfileContext } from "../../../App";

// open: 다이얼로그 show/hide
// onClose: 다이얼로그 닫기 콜백
// onCreate: 생성 버튼 눌렀을 때 콜백. 인자로 { roomName, roomType: boolean, userIds: number[] }를 넘겨줌
function ChatRoomCreateDialog({ open, onClose, onCreate, presetUsers }) {
  const { showSnack } = useSnackbarContext();
  const { userProfile } = useContext(UserProfileContext) || {};
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("group"); // "group" or "alone"
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // 검색어
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // 현재 로그인된 사용자 ID 가져오기
  const currentUserId = userProfile?.id || userProfile?.userId;

  // 다이얼로그가 열릴 때 현재 로그인된 사용자를 자동으로 선택
  useEffect(() => {
    if (open && currentUserId && userProfile) {
      setSelectedUsers((prev) => {
        // 이미 선택되어 있는지 확인
        const isAlreadySelected = prev.some(u => (u.userId || u.id) === currentUserId);
        if (isAlreadySelected) {
          return prev;
        }

        // allUsers에서 현재 사용자 찾기
        if (allUsers.length > 0) {
          const currentUser = allUsers.find(u => (u.userId || u.id) === currentUserId);
          if (currentUser) {
            // 현재 사용자를 맨 앞에 추가
            return [currentUser, ...prev];
          }
        }

        // allUsers에 없으면 userProfile에서 직접 생성
        // userProfile의 구조를 allUsers 형식에 맞게 변환
        const currentUserFromProfile = {
          userId: userProfile.id || userProfile.userId,
          id: userProfile.id || userProfile.userId,
          name: userProfile.name,
          email: userProfile.email,
          profileImageUrl: userProfile.profileImageUrl,
          jobGrade: userProfile.jobGrade,
          positionName: userProfile.positionName,
          deptName: userProfile.deptName,
          departmentName: userProfile.departmentName
        };
        
        return [currentUserFromProfile, ...prev];
      });
    }
  }, [open, allUsers, currentUserId, userProfile]);

  // 조직도에서 넘어온 presetUsers 적용 (현재 사용자 제외)
  useEffect(() => {
    if (open && presetUsers && Array.isArray(presetUsers) && currentUserId) {
      // presetUsers에서 현재 사용자 제외하고 추가
      const presetUsersWithoutMe = presetUsers.filter(u => (u.userId || u.id) !== currentUserId);
      setSelectedUsers((prev) => {
        // 현재 사용자가 이미 선택되어 있는지 확인
        const hasCurrentUser = prev.some(u => (u.userId || u.id) === currentUserId);
        const currentUser = allUsers.find(u => (u.userId || u.id) === currentUserId);
        
        // 현재 사용자가 없으면 추가
        let newSelected = hasCurrentUser ? prev : (currentUser ? [currentUser, ...prev] : prev);
        
        // presetUsers 추가 (중복 제거)
        presetUsersWithoutMe.forEach(presetUser => {
          const presetUserId = presetUser.userId || presetUser.id;
          if (!newSelected.some(u => (u.userId || u.id) === presetUserId)) {
            newSelected = [...newSelected, presetUser];
          }
        });
        
        return newSelected;
      });
    }
  }, [open, presetUsers, currentUserId, allUsers]);

  // 사용자 목록 DB에서 가져오기
  useEffect(() => {
    if (open) {
      setLoadingUsers(true);
      setError(""); // 에러 초기화

      // 여러 API를 시도하는 fallback 로직
      const fetchUsers = async () => {
        try {
          // 1순위: /user/organization (조직도 API - 부서 정보 포함)
          let res = await http.get("/user/organization");
          let users = [];

          if (Array.isArray(res.data)) {
            users = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            users = res.data.data;
          }

          if (users.length > 0) {
            console.log("✅ [ChatRoomCreateDialog] /user/organization에서 사용자 조회 성공:", users.length);
            // 프로필 이미지 URL 확인을 위한 디버깅
            if (users.length > 0) {
              // 모든 사용자의 profileImageUrl 상태 확인
              const usersWithImage = users.filter(u => u.profileImageUrl && u.profileImageUrl.trim() !== '' && u.profileImageUrl.startsWith('http'));
              const usersWithoutImage = users.filter(u => !u.profileImageUrl || u.profileImageUrl.trim() === '' || !u.profileImageUrl.startsWith('http'));

              console.log("🔍 [ChatRoomCreateDialog] /user/organization 프로필 이미지 통계:", {
                전체사용자수: users.length,
                이미지있는사용자수: usersWithImage.length,
                이미지없는사용자수: usersWithoutImage.length
              });

              // 첫 번째 사용자 상세 정보
              console.log("🔍 [ChatRoomCreateDialog] /user/organization 첫 번째 사용자 샘플:", {
                userId: users[0].userId,
                name: users[0].name,
                profileImageUrl: users[0].profileImageUrl,
                profileImageUrlType: typeof users[0].profileImageUrl,
                profileImageUrlLength: users[0].profileImageUrl?.length,
                isValidUrl: users[0].profileImageUrl?.startsWith('http'),
                email: users[0].email,
                전체객체: users[0], // 전체 객체 확인
                모든키: Object.keys(users[0]) // 객체의 모든 키 확인
              });

              // 실제로 이미지 URL이 있는 사용자 찾기
              if (usersWithImage.length > 0) {
                console.log("✅ [ChatRoomCreateDialog] 프로필 이미지가 있는 사용자 발견:", usersWithImage.map(u => ({
                  name: u.name,
                  profileImageUrl: u.profileImageUrl
                })));
              } else {
                console.warn("⚠️ [ChatRoomCreateDialog] 프로필 이미지가 있는 사용자가 없습니다.");
                // 이미지가 없는 사용자들의 profileImageUrl 값 확인
                console.log("🔍 [ChatRoomCreateDialog] 이미지가 없는 사용자들의 profileImageUrl 값:",
                  usersWithoutImage.slice(0, 3).map(u => ({
                    name: u.name,
                    profileImageUrl: u.profileImageUrl,
                    profileImageUrlType: typeof u.profileImageUrl
                  }))
                );
              }
            }
            setAllUsers(users);
            setLoadingUsers(false);
            return;
          }
        } catch (err) {
          console.log("⚠️ [ChatRoomCreateDialog] /user/organization 실패, 다음 API 시도:", err.message);
        }

        try {
          // 2순위: /admin/users (관리자 API)
          let res = await http.get("/admin/users");
          let users = [];

          if (Array.isArray(res.data)) {
            users = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            users = res.data.data;
          }

          if (users.length > 0) {
            console.log("✅ [ChatRoomCreateDialog] /admin/users에서 사용자 조회 성공:", users.length);
            // 프로필 이미지 URL 확인을 위한 디버깅
            if (users.length > 0) {
              console.log("🔍 [ChatRoomCreateDialog] /admin/users 첫 번째 사용자 샘플:", {
                id: users[0].id,
                name: users[0].name,
                profileImageUrl: users[0].profileImageUrl,
                profileImageUrlType: typeof users[0].profileImageUrl,
                profileImageUrlLength: users[0].profileImageUrl?.length,
                isValidUrl: users[0].profileImageUrl?.startsWith('http'),
                profileImageKey: users[0].profileImageKey,
                email: users[0].email
              });
              // 실제로 이미지 URL이 있는 사용자 찾기
              const userWithImage = users.find(u => u.profileImageUrl && u.profileImageUrl.startsWith('http'));
              if (userWithImage) {
                console.log("✅ [ChatRoomCreateDialog] 프로필 이미지가 있는 사용자 발견:", {
                  name: userWithImage.name,
                  profileImageUrl: userWithImage.profileImageUrl
                });
              } else {
                console.warn("⚠️ [ChatRoomCreateDialog] 프로필 이미지가 있는 사용자가 없습니다.");
              }
            }
            setAllUsers(users);
            setLoadingUsers(false);
            return;
          }
        } catch (err) {
          console.log("⚠️ [ChatRoomCreateDialog] /admin/users 실패, 다음 API 시도:", err.message);
        }

        try {
          // 3순위: /user/list
          let res = await http.get("/user/list");
          let users = [];

          if (Array.isArray(res.data)) {
            users = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            users = res.data.data;
          }

          if (users.length > 0) {
            console.log("✅ [ChatRoomCreateDialog] /user/list에서 사용자 조회 성공:", users.length);
            // 프로필 이미지 URL 확인을 위한 디버깅
            if (users.length > 0) {
              console.log("🔍 [ChatRoomCreateDialog] /user/list 첫 번째 사용자 샘플:", {
                id: users[0].id,
                name: users[0].name,
                profileImageUrl: users[0].profileImageUrl,
                profileImageUrlType: typeof users[0].profileImageUrl,
                profileImageUrlLength: users[0].profileImageUrl?.length,
                isValidUrl: users[0].profileImageUrl?.startsWith('http'),
                profileImageKey: users[0].profileImageKey,
                email: users[0].email
              });
              // 실제로 이미지 URL이 있는 사용자 찾기
              const userWithImage = users.find(u => u.profileImageUrl && u.profileImageUrl.startsWith('http'));
              if (userWithImage) {
                console.log("✅ [ChatRoomCreateDialog] 프로필 이미지가 있는 사용자 발견:", {
                  name: userWithImage.name,
                  profileImageUrl: userWithImage.profileImageUrl
                });
              } else {
                console.warn("⚠️ [ChatRoomCreateDialog] 프로필 이미지가 있는 사용자가 없습니다.");
              }
            }
            setAllUsers(users);
            setLoadingUsers(false);
            return;
          }
        } catch (err) {
          console.log("⚠️ [ChatRoomCreateDialog] /user/list 실패, 다음 API 시도:", err.message);
        }

        try {
          // 4순위: /user (기본 API)
          let res = await http.get("/user");
          let users = [];

          if (Array.isArray(res.data)) {
            users = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            users = res.data.data;
          }

          if (users.length > 0) {
            console.log("✅ [ChatRoomCreateDialog] /user에서 사용자 조회 성공:", users.length);
            setAllUsers(users);
            setLoadingUsers(false);
            return;
          }
        } catch (err) {
          console.log("⚠️ [ChatRoomCreateDialog] /user 실패:", err.message);
        }

        // 모든 API 실패
        console.error("❌ [ChatRoomCreateDialog] 모든 사용자 목록 API 실패");
        setAllUsers([]);
        showSnack("사용자 목록을 불러오는데 실패했습니다.", "error");
        setLoadingUsers(false);
      };

      fetchUsers();
    } else {
      // 다이얼로그 닫을 때 초기화
      setRoomName("");
      setSelectedUsers([]);
      setError("");
      setSearchTerm("");
      setRoomType("group");
      setAllUsers([]);
    }
  }, [open, showSnack]);

  // 직급 라벨 변환 함수 (filteredUsers useMemo에서 사용되므로 먼저 정의)
  const getJobGradeLabel = (jobGrade) => {
    if (!jobGrade) return "";
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
    return gradeMap[jobGrade] || jobGrade;
  };

  // 검색 필터링
  const filteredUsers = useMemo(() => {
    if (searchTerm.trim() === "") {
      return allUsers;
    }

    const searchLower = searchTerm.toLowerCase();
    return allUsers.filter((user) => {
      const nameMatch = user.name && user.name.toLowerCase().includes(searchLower);
      const emailMatch = user.email && user.email.toLowerCase().includes(searchLower);
      // jobGrade (UserDTO) 또는 positionName (OrganizationUserResponseDTO) 지원
      const jobGradeMatch = (user.jobGrade && getJobGradeLabel(user.jobGrade).toLowerCase().includes(searchLower)) ||
        (user.positionName && user.positionName.toLowerCase().includes(searchLower));
      // deptName 또는 departmentName 지원
      const deptMatch = (user.deptName || user.departmentName) &&
        (user.deptName || user.departmentName).toLowerCase().includes(searchLower);
      return nameMatch || emailMatch || jobGradeMatch || deptMatch;
    });
  }, [allUsers, searchTerm]);

  // 사용자 선택/해제 핸들러
  const handleToggleUser = (user) => {
    // userId 또는 id 필드 사용 (OrganizationUserResponseDTO는 userId, UserDTO는 id)
    const userId = user.userId || user.id;
    if (!userId) {
      console.error("사용자 ID가 없습니다:", user);
      return;
    }

    // 현재 로그인된 사용자는 선택 해제 불가
    if (userId === currentUserId) {
      showSnack("본인은 선택 해제할 수 없습니다.", "warning");
      return;
    }

    setSelectedUsers((prev) => {
      const isSelected = prev.some(u => (u.userId || u.id) === userId);

      if (isSelected) {
        // 이미 선택된 경우 제거 (현재 사용자 제외)
        return prev.filter(u => (u.userId || u.id) !== userId);
      } else {
        // 1:1 채팅방인 경우 본인 포함 3명 이상 체크
        if (roomType === "alone" && prev.length >= 2) {
          showSnack("세 명 이상 선택할 수 없습니다 (본인 포함 2명만 선택하세요)", "warning");
          return prev;
        }
        return [...prev, user];
      }
    });

    // 에러 초기화는 콜백 밖에서 처리
    if (error) {
      setError("");
    }
  };

  // 선택된 사용자 제거 (Chip X 버튼)
  const handleRemoveUser = (userToRemove) => {
    const userId = userToRemove.userId || userToRemove.id;
    
    // 현재 로그인된 사용자는 제거 불가
    if (userId === currentUserId) {
      showSnack("본인은 선택 해제할 수 없습니다.", "warning");
      return;
    }
    
    setSelectedUsers((prev) => prev.filter((user) => (user.userId || user.id) !== userId));
    setError(""); // 에러 초기화
  };

  // 1:1 채팅방에서 본인 포함 3명 이상 선택 시 에러 메시지 표시 (본인 포함 2명까지 가능)
  useEffect(() => {
    if (roomType === "alone" && selectedUsers.length > 2) {
      setError("세 명 이상 선택할 수 없습니다 (본인 포함 2명만 선택하세요)");
    } else if (roomType === "alone" && selectedUsers.length <= 2 && error === "세 명 이상 선택할 수 없습니다 (본인 포함 2명만 선택하세요)") {
      setError(""); // 에러 메시지 초기화
    }
  }, [roomType, selectedUsers.length, error]);

  // 사용자가 선택되었는지 확인
  const isUserSelected = (user) => {
    const userId = user.userId || user.id;
    return selectedUsers.some(u => (u.userId || u.id) === userId);
  };

  // 생성 버튼 누를 때 유효성 체크 및 전달
  const handleCreate = async () => {
    if (!roomName.trim()) {
      showSnack("채팅방 이름을 입력하세요.", "warning");
      return;
    }
    if (selectedUsers.length === 0) {
      showSnack("참여할 사용자를 한 명 이상 선택하세요.", "warning");
      return;
    }
    // 1:1 채팅방인 경우 본인 포함 3명 이상 선택 체크 (본인 포함 2명까지 가능)
    if (roomType === "alone" && selectedUsers.length > 2) {
      showSnack("세 명 이상 선택할 수 없습니다 (본인 포함 2명만 선택하세요)", "warning");
      return;
    }
    if (roomType === "alone" && selectedUsers.length === 0) {
      showSnack("1:1 채팅은 본인 포함 2명을 선택해야 합니다.", "warning");
      return;
    }
    if (roomType === "group" && selectedUsers.length < 2) {
      showSnack("그룹 채팅은 2명 이상을 선택해야 합니다.", "warning");
      return;
    }

    // 모든 사용자가 id를 가지고 있는지 확인
    const usersWithIds = selectedUsers.filter(u => u.userId || u.id);
    if (usersWithIds.length !== selectedUsers.length) {
      showSnack("일부 사용자의 정보가 올바르지 않습니다. 다시 선택해주세요.", "error");
      return;
    }

    // 실제 생성 콜백 호출 (백엔드 DTO 구조에 맞게)
    onCreate({
      roomName,
      roomType: roomType === "group", // group: true, alone: false
      userIds: selectedUsers.map(u => u.userId || u.id).filter(id => id != null)
    });
    // 입력값 리셋
    setRoomName("");
    setSelectedUsers([]);
    setRoomType("group");
    setError("");
    setSearchTerm("");
  };

  // 팝업 닫힐 때 폼 리셋
  const handleClose = () => {
    onClose();
    setError("");
    setRoomName("");
    setSelectedUsers([]);
    setRoomType("group");
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>채팅방 생성</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2 }}>
          {/* 방 이름 */}
          <TextField
            label="채팅방 이름"
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
            autoFocus
            fullWidth
            margin="normal"
          />
          {/* 1:1 / 그룹 라디오 */}
          <Box mt={2}>
            <Typography variant="subtitle2" fontWeight="bold">채팅방 유형</Typography>
            <RadioGroup
              row
              value={roomType}
              onChange={e => {
                setRoomType(e.target.value);
                // 1:1로 변경 시 선택된 사용자가 2명 초과면 초기화
                if (e.target.value === "alone" && selectedUsers.length > 2) {
                  setSelectedUsers([]);
                  setError("");
                }
              }}
            >
              <FormControlLabel value="group" control={<Radio />} label="그룹" />
              <FormControlLabel value="alone" control={<Radio />} label="1:1" />
            </RadioGroup>
          </Box>

          {/* 선택된 사용자 표시 */}
          {selectedUsers.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                선택된 참여자 ({selectedUsers.length}명)
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {selectedUsers.map((user) => {
                  const userId = user.userId || user.id;
                  const isCurrentUser = userId === currentUserId;
                  return (
                    <Chip
                      key={userId}
                      avatar={
                        <Avatar
                          src={
                            user.profileImageUrl &&
                              user.profileImageUrl.trim() !== '' &&
                              user.profileImageUrl.startsWith('http')
                              ? user.profileImageUrl
                              : undefined
                          }
                          sx={{ bgcolor: "primary.main", width: 24, height: 24 }}
                          imgProps={{
                            onError: (e) => {
                              // 이미지 로드 실패 시 숨기고 이니셜 표시
                              console.warn("프로필 이미지 로드 실패 (Chip):", user.profileImageUrl, "사용자:", user.name);
                              e.target.style.display = "none";
                            },
                            onLoad: () => {
                              console.log("프로필 이미지 로드 성공 (Chip):", user.profileImageUrl, "사용자:", user.name);
                            }
                          }}
                        >
                          {(!user.profileImageUrl ||
                            user.profileImageUrl.trim() === '' ||
                            !user.profileImageUrl.startsWith('http')) &&
                            (user.name?.[0]?.toUpperCase() || "?")}
                        </Avatar>
                      }
                      label={`${user.name} (${user.email})${isCurrentUser ? ' (나)' : ''}`}
                      onDelete={isCurrentUser ? undefined : () => handleRemoveUser(user)} // 현재 사용자는 삭제 불가
                      color="primary"
                      variant="outlined"
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        {/* 참여자 선택 (체크박스 리스트) */}
        <Box sx={{ borderTop: "1px solid #e3e8ef" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid #e3e8ef" }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              참여자 선택
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="이름 또는 이메일로 검색"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (error && error !== "세 명 이상 선택할 수 없습니다 (본인 포함 2명만 선택하세요)") {
                  setError("");
                }
              }}
            />
          </Box>

          {loadingUsers ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, p: 3 }}>
              <Typography color="text.secondary">
                {searchTerm ? "검색 결과가 없습니다." : "사용자가 없습니다."}
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0, maxHeight: 300, overflowY: "auto" }}>
              {filteredUsers.map((user) => {
                // userId 또는 id 필드 사용 (OrganizationUserResponseDTO는 userId, UserDTO는 id)
                const userId = user.userId || user.id;
                const isCurrentUser = userId === currentUserId;
                const isSelected = isUserSelected(user);
                
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
                        // 현재 사용자는 클릭해도 토글하지 않음
                        if (isCurrentUser) {
                          return;
                        }
                        // 체크박스가 아닌 영역 클릭 시에만 토글
                        if (e.target.type !== 'checkbox' && !e.target.closest('input[type="checkbox"]')) {
                          handleToggleUser(user);
                        }
                      }}
                      sx={{ py: 1.5, px: 2 }}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isCurrentUser} // 현재 사용자는 disabled
                        onChange={(e) => {
                          e.stopPropagation();
                          if (!isCurrentUser) {
                            handleToggleUser(user);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        sx={{ mr: 1, pointerEvents: isCurrentUser ? 'none' : 'auto' }}
                      />
                      <ListItemAvatar>
                        <Avatar
                          src={
                            user.profileImageUrl &&
                              user.profileImageUrl.trim() !== '' &&
                              user.profileImageUrl.startsWith('http')
                              ? user.profileImageUrl
                              : undefined
                          }
                          sx={{ bgcolor: "primary.main", width: 40, height: 40 }}
                          imgProps={{
                            onError: (e) => {
                              // 이미지 로드 실패 시 숨기고 이니셜 표시
                              console.warn("프로필 이미지 로드 실패:", user.profileImageUrl, "사용자:", user.name);
                              e.target.style.display = "none";
                            },
                            onLoad: () => {
                              console.log("프로필 이미지 로드 성공:", user.profileImageUrl, "사용자:", user.name);
                            }
                          }}
                        >
                          {(!user.profileImageUrl ||
                            user.profileImageUrl.trim() === '' ||
                            !user.profileImageUrl.startsWith('http')) &&
                            (user.name?.[0]?.toUpperCase() || "?")}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {user.name || "이름 없음"}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              {[
                                user.jobGrade ? getJobGradeLabel(user.jobGrade) : user.positionName,
                                user.deptName || user.departmentName
                              ].filter(Boolean).join(" / ") || "직급 / 부서 정보 없음"}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                              {user.email || "이메일 없음"}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
        {/* 에러 메시지 */}
        {error && (
          <Box sx={{ p: 2, bgcolor: "error.light", color: "error.contrastText" }}>
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            * 채팅방 이름, 유형, 참여자를 모두 입력해 주세요. (X 버튼으로 선택 취소 가능)
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button onClick={handleCreate} variant="contained" color="primary">생성</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChatRoomCreateDialog;