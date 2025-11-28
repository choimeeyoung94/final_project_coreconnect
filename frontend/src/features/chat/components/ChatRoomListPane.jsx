import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, List, ListItem, ListItemButton, ListItemText, Badge, Typography, Chip } from "@mui/material";
import http from "../../../api/http"; // axios 인스턴스 불러오기

// 채팅방 목록(좌측) & 탭
function ChatRoomListPane({
  tabIdx, setTabIdx, roomList, selectedRoomId, setSelectedRoomId, formatTime, highlightedRoomId
}) {
  // 정렬 상태: 기본값은 최신 메시지부터 (내림차순)
  const sortOrder = 'desc';
  // 참여자 수 정보를 저장할 state: { [roomId]: 참여자수 }
  const [roomMemberCounts, setRoomMemberCounts] = useState({});

  // roomList가 바뀔 때마다 각 방의 참여자 수 API 호출
  useEffect(() => {
    async function fetchAllMemberCounts() {
      const countObj = {};
      await Promise.all(
        roomList.map(async (room) => {
          try {
            // GET /chat/{roomId}/users → 응답 data.data에 사용자 배열
            const res = await http.get(`/chat/${room.roomId}/users`);
            const users = Array.isArray(res.data.data) ? res.data.data : [];
            countObj[room.roomId] = users.length;
          } catch {
            countObj[room.roomId] = 0;
          }
        })
      );
      setRoomMemberCounts(countObj);
    }
    if (Array.isArray(roomList) && roomList.length > 0) {
      fetchAllMemberCounts();
    }
  }, [roomList]);

  // "전체"(0) 또는 "안읽음"(1) 탭 필터링
  const filteredRooms = tabIdx === 0 ? roomList : roomList.filter(r => r.unreadCount > 0);

  // 마지막 메시지 시간 기준 정렬 함수
  const sortRoomsByLastMessage = (rooms) => {
    return [...rooms].sort((a, b) => {
      const timeA = a.lasMessageTime ? new Date(a.lasMessageTime).getTime() : 0;
      const timeB = b.lasMessageTime ? new Date(b.lasMessageTime).getTime() : 0;
      
      if (sortOrder === 'asc') {
        // 오름차순: 오래된 메시지부터 (시간이 작은 것부터)
        return timeA - timeB;
      } else {
        // 내림차순: 최신 메시지부터 (시간이 큰 것부터)
        return timeB - timeA;
      }
    });
  };

  // 정렬된 채팅방 목록
  const sortedRooms = sortRoomsByLastMessage(filteredRooms);

  // 참여자 수 기준 채팅방 유형 뱃지(1:1, 단체 채팅) 반환용
  function TypeBadge({ count }) {
    if (!count) return null; // 참여자 데이터 없음
    if (count === 2)
      return <Chip label="1:1" size="small" color="primary" sx={{ fontWeight: 700, ml: 0.5, flexShrink: 0 }} />;
    if (count > 2)
      return <Chip label="단체 채팅" size="small" color="primary" sx={{ fontWeight: 700, ml: 0.5, flexShrink: 0 }} />;
    return null;
  }

  return (
    <Box sx={{
      flex: "0 0 420px", minWidth: 350, maxWidth: 470,
      height: "calc(100vh - 56px - 32px)", background: "#fff",
      borderRight: "1px solid #e3e8ef", borderRadius: 0,
      display: "flex", flexDirection: "column", p: 0,
    }}>
      {/* 탭 영역 */}
      <Box sx={{ px: 0, pt: 0, pb: 1, position: 'relative' }}>
        <Tabs
          value={tabIdx}
          onChange={(_, v) => setTabIdx(v)}
          variant="fullWidth"
          sx={{
            borderBottom: "1px solid #e3e8ef",
            background: "#f9fafb",
            mb: 0,
            minHeight: 44
          }}
        >
          <Tab label="전체" sx={{ fontWeight: 700, fontSize: 17, minHeight: 44 }} />
          <Tab label="안읽음" sx={{ fontWeight: 700, fontSize: 17, minHeight: 44 }} />
        </Tabs>
      </Box>
      {/* 방 목록 */}
      <List
        sx={{
          overflowY: "auto",
          flex: 1,
          px: 2,
          bgcolor: "#fff",
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-thumb": {
            background: "#e4eaf3",
            borderRadius: "7px"
          },
          "&::-webkit-scrollbar-track": { background: "#fff" }
        }}
      >
        {filteredRooms.length === 0 ? (
          <ListItem>
            <ListItemText
              primary={
                <Box sx={{ width: "100%", textAlign: "center", color: 'text.disabled', fontSize: 15 }}>
                  {tabIdx === 1 ? "안읽은 메시지가 있는 채팅방이 없습니다." : "채팅방을 생성해서 대화를 시작해보세요"}
                </Box>
              }
            />
          </ListItem>
        ) : (
          sortedRooms.map(room => (
            <ListItem
              key={room.roomId}
              disablePadding
              sx={{
                mb: 1,
                borderBottom: "1px solid #e9eaeb"
              }}
            >
              <ListItemButton
                selected={selectedRoomId === room.roomId}
                onClick={() => setSelectedRoomId(room.roomId)}
                alignItems="flex-start"
                sx={{
                  borderRadius: 0,
                  background: selectedRoomId === room.roomId ? "#f3f6fa" : "#fff",
                  py: 2.4,
                  px: 1.2,
                  minHeight: "64px",
                  cursor: "pointer",
                  // 새로 생성된 방 하이라이팅
                  ...(highlightedRoomId === room.roomId && {
                    background: "#e3f2fd",
                    borderLeft: "4px solid #1976d2",
                    animation: "highlightPulse 2s ease-in-out",
                    "@keyframes highlightPulse": {
                      "0%": { background: "#e3f2fd" },
                      "50%": { background: "#bbdefb" },
                      "100%": { background: "#e3f2fd" }
                    }
                  })
                }}
              >
                <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", flexWrap: "nowrap", width: "100%" }}>
                    <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1, minWidth: 0, gap: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {room.roomName}
                      </Typography>
                      {/* 참여자수에 따라 1:1 또는 단체 채팅 뱃지 표시 - 채팅방 이름 바로 옆에 붙임 */}
                      {roomMemberCounts[room.roomId] && (
                        <TypeBadge count={roomMemberCounts[room.roomId]} />
                      )}
                    </Box>
                    {/* 안읽은 메시지 숫자 - 오른쪽으로 더 이동 */}
                    {room.unreadCount > 0 && (
                      <Box sx={{ flexShrink: 0, ml: 2 }}>
                        <Badge
                          badgeContent={room.unreadCount}
                          sx={{
                            "& .MuiBadge-badge": {
                              background: "#f44336",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "13px",
                              borderRadius: "10px",
                              py: 1, 
                              px: 1.2,
                              minWidth: "20px",
                            }
                          }}
                        >
                          <Box sx={{ width: 0, height: 0 }} />
                        </Badge>
                      </Box>
                    )}
                  </Box>
                }
                secondary={
                  <Box component="span" sx={{ display: "block" }}>
                    {/* 초대된 채팅방 표시 */}
                    {room.invited && (
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 12,
                          color: "#1976d2",
                          fontWeight: 600,
                          display: "block",
                          mb: 0.5
                        }}
                      >
                        내가 초대된 채팅방입니다
                      </Typography>
                    )}
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 14,
                        color: "#555",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "block"
                      }}
                    >
                      {room.lastMessageFileYn ? "이미지 업로드" : (room.lastMessageContent ? room.lastMessageContent : "")}
                    </Typography>
                    <Box component="span" sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 13,
                          color: "#9495a0",
                          mr: 2
                        }}
                      >
                        {room.lasMessageTime ? formatTime(room.lasMessageTime) : ""}
                      </Typography>
                      {room.lastSenderName && (
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 13,
                            color: "#9495a0"
                          }}
                        >
                          {room.lastSenderName}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                }
              />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
    </Box>
  );
}

export default ChatRoomListPane;