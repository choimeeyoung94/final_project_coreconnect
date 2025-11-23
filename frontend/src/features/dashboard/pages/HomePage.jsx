import React, { useState, useCallback, useRef, useEffect } from "react";
import { Container, Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import AttendanceCard from "../components/AttendanceCard";
import ProfileCard from "../components/ProfileCard";
import MailListCard from "../components/MailListCard";
import QuickMenuCard from "../components/QuickMenuCard";
import RecentBoardsCard from "../components/RecentBoardsCard";
import CalendarCard from "../components/CalendarCard";
import RecentNotificationsCard from "../components/RecentNotificationsCard";
import BirthdayCard from "../components/BirthdayCard";
import UserProfileModal from "../../../components/user/UserProfileModal";

// === 설정 상수 ===
const ROW_HEIGHT = 80;
const MARGIN_Y = 24;
const DRAGGABLE_CANCEL_SELECTOR =
  "button, a, input, textarea, select, .MuiButtonBase-root, .MuiIconButton-root, [data-grid-cancel]";

// 기본 레이아웃 정의 (12열 그리드)
const defaultLayout = [
  { i: "profile",        x: 0, y: 0, w: 4, h: 5, minW: 4, minH: 3 },
  { i: "mail",           x: 4, y: 0, w: 4, h: 5, minW: 4, minH: 3 },
  { i: "attendance",     x: 8, y: 0, w: 4, h: 5, minW: 4, minH: 4 }, // 내용 많아서 기본 조금 여유
  { i: "birthday",       x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 3 },
  { i: "quickMenu",      x: 4, y: 3, w: 4, h: 3, minW: 4, minH: 3 },
  { i: "recentBoards",   x: 8, y: 3, w: 4, h: 6, minW: 4, minH: 4 },
  { i: "calendar",       x: 4, y: 6, w: 4, h: 6, minW: 4, minH: 4 },
  { i: "notifications",  x: 8, y: 6, w: 4, h: 5, minW: 4, minH: 3 },
];

const LAYOUT_STORAGE_KEY = "dashboardLayout";

// react-grid-layout 스타일링
const StyledGridLayout = styled(GridLayout)(({ theme }) => ({
  position: "relative",
  transition: "height 200ms ease",
  "& .react-grid-item": {
    transition: "all 200ms ease",
    transitionProperty: "left, top, width, height",
    overflow: "visible",
    "& > div": {
      height: "100%",  // 셀 전체 채우기
      width: "100%",
      display: "flex",
      flexDirection: "column",
    },
    "&.cssTransforms": {
      transitionProperty: "transform, width, height",
    },
    "&.resizing": {
      transition: "none",
      zIndex: 1,
      willChange: "width, height",
    },
    "&.react-draggable-dragging": {
      transition: "none",
      zIndex: 3,
      willChange: "transform",
    },
    "&.react-grid-placeholder": {
      background:
        theme.palette.mode === "dark"
          ? "rgba(25, 118, 210, 0.3)"
          : "rgba(25, 118, 210, 0.2)",
      opacity: 0.2,
      transitionDuration: "100ms",
      zIndex: 2,
      userSelect: "none",
      borderRadius: 2,
    },
    "& > .react-resizable-handle": {
      position: "absolute",
      width: 20,
      height: 20,
      "&::after": {
        content: '""',
        position: "absolute",
        right: 3,
        bottom: 3,
        width: 5,
        height: 5,
        borderRight: `2px solid ${
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.4)"
            : "rgba(0, 0, 0, 0.4)"
        }`,
        borderBottom: `2px solid ${
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.4)"
            : "rgba(0, 0, 0, 0.4)"
        }`,
      },
      "&:hover::after": {
        borderRight: `2px solid ${theme.palette.primary.main}`,
        borderBottom: `2px solid ${theme.palette.primary.main}`,
      },
    },
  },
  "& .react-resizable-handle": {
    position: "absolute",
    width: 10,
    height: 10,
    "&.react-resizable-handle-se": {
      bottom: 0,
      right: 0,
      cursor: "se-resize",
    },
  },
}));

export default function HomePage() {
  const containerRef = useRef(null);
  const cardRefs = useRef({}); // 각 카드 DOM 저장용

  const [selectedUser, setSelectedUser] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [layout, setLayout] = useState(() => {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout) {
      try {
        return JSON.parse(savedLayout);
      } catch (e) {
        console.error("레이아웃 불러오기 실패:", e);
        return defaultLayout;
      }
    }
    return defaultLayout;
  });

  const [containerWidth, setContainerWidth] = useState(1200);

  // 컨테이너 너비 계산
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 48; // padding 제외
        setContainerWidth(Math.max(width, 800));
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedUser(null);
  };

  // 레이아웃 변경 시 그냥 저장만
  const handleLayoutChange = useCallback((newLayout) => {
    setLayout(newLayout);
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
  }, []);

  // ✅ 카드 실제 높이에 맞게 h만 자동 조정 (y는 건드리지 않음)
  useEffect(() => {
    if (!cardRefs.current) return;

    setLayout((prevLayout) => {
      let changed = false;
      const nextLayout = prevLayout.map((item) => {
        const el = cardRefs.current[item.i];
        if (!el) return item;

        // 카드 컨테이너 높이 측정
        const rect = el.getBoundingClientRect();
        const height = rect.height;

        if (!height || height <= 0) return item;

        // 필요한 h 계산
        const rawH = (height + MARGIN_Y) / (ROW_HEIGHT + MARGIN_Y);
        const newH = Math.max(item.minH || 2, Math.ceil(rawH));

        if (newH !== item.h) {
          changed = true;
          return { ...item, h: newH };
        }
        return item;
      });

      if (!changed) return prevLayout;
      // 여기서 y를 전혀 건드리지 않고, h만 바꿔줌
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
      return nextLayout;
    });
  }, [containerWidth]); // 너비 바뀔 때 한 번 재계산

  return (
    <Container maxWidth={false} sx={{ py: 3, px: 3 }} ref={containerRef}>
      <StyledGridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={ROW_HEIGHT}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        isDraggable={true}
        isResizable={true}
        margin={[24, MARGIN_Y]}
        containerPadding={[0, 0]}
        compactType="vertical"      // 🔥 세로로 자동 컴팩트 → 카드 아래로 밀어냄
        preventCollision={false}    // 기본 충돌 처리에 맡김
        draggableCancel={DRAGGABLE_CANCEL_SELECTOR}
      >
        <Box key="profile" ref={(el) => (cardRefs.current.profile = el)}>
          <ProfileCard />
        </Box>
        <Box key="mail" ref={(el) => (cardRefs.current.mail = el)}>
          <MailListCard />
        </Box>
        <Box
          key="attendance"
          ref={(el) => (cardRefs.current.attendance = el)}
        >
          <AttendanceCard />
        </Box>
        <Box key="birthday" ref={(el) => (cardRefs.current.birthday = el)}>
          <BirthdayCard onUserClick={handleUserClick} />
        </Box>
        <Box
          key="quickMenu"
          ref={(el) => (cardRefs.current.quickMenu = el)}
        >
          <QuickMenuCard />
        </Box>
        <Box
          key="recentBoards"
          ref={(el) => (cardRefs.current.recentBoards = el)}
        >
          <RecentBoardsCard />
        </Box>
        <Box
          key="calendar"
          ref={(el) => (cardRefs.current.calendar = el)}
        >
          <CalendarCard />
        </Box>
        <Box
          key="notifications"
          ref={(el) => (cardRefs.current.notifications = el)}
        >
          <RecentNotificationsCard />
        </Box>
      </StyledGridLayout>

      {/* 프로필 모달 */}
      <UserProfileModal
        open={profileModalOpen}
        onClose={handleCloseProfileModal}
        user={selectedUser}
      />
    </Container>
  );
}
