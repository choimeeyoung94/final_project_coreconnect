import React, { useEffect, useMemo, useState, useRef, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Modal,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Avatar,
  CircularProgress,
} from "@mui/material";
import ReplyIcon from "@mui/icons-material/Reply";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { getBoardDetail, deleteBoard } from "../api/boardAPI";
import {
  getFilesByBoard,
  getFile,
  downloadZipFiles,
} from "../api/boardFileAPI";
import {
  getRepliesByBoard,
  createReply,
  updateReply,
  deleteReply,
} from "../api/boardReplyAPI";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import { UserProfileContext } from "../../../App";
import { getJobGradeLabel } from "../../../utils/labelUtils";

// 파일이 이미지인지 판단하는 헬퍼 함수 (확장자 기준)
const isImage = (name) => {
  if (!name) return false;
  return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
};

// 게시글 상세 페이지 컴포넌트
const BoardDetailPage = () => {
  const { boardId } = useParams(); // URL 경로에서 /board/:boardId 의 boardId 값을 문자열로 가져옴
  const navigate = useNavigate(); // 다른 페이지로 이동(뒤로가기, 특정 경로 이동 등)에 사용하는 함수
  const location = useLocation();
  const fromAllBoard = location.state?.fromAllBoard ?? false;
  const { showSnack } = useSnackbarContext(); // 스낵바 훅 사용

  // 로그인 사용자 정보 로드
  const { userProfile } = useContext(UserProfileContext) || {};
  const loginName = userProfile?.name || "익명"; // 로그인 이름 (user.name 이 없거나 undefined면 "익명"으로 대체)
  const loginRole = userProfile?.role; // 사용자 역할(권한). 예: "ADMIN", "USER" 등

  // 상태 정의
  const [board, setBoard] = useState(null); // 게시글 상세 데이터 상태 (초기값 null → 아직 로딩 전이라는 의미)
  const [files, setFiles] = useState([]); // 첨부파일 목록 상태
  const [replies, setReplies] = useState([]); // 댓글 전체 목록 상태 (부모 댓글 + 자식 댓글 포함)
  const [loading, setLoading] = useState(true); // 로딩 상태

  // 첨부파일 미리보기 모달용 상태
  const [previewFile, setPreviewFile] = useState(null); // 현재 모달에서 보고 있는 파일 정보
  const [openModal, setOpenModal] = useState(false); // 모달 열림 여부

  // 댓글 입력/수정 상태
  const [replyText, setReplyText] = useState(""); // 일반 댓글 입력창의 내용
  const [childReplyText, setChildReplyText] = useState(""); // 대댓글(답글) 입력창의 내용
  const [replyParentId, setReplyParentId] = useState(null); // 대댓글 작성 시, 어떤 부모 댓글에 달리는지 그 부모 댓글 ID
  const [editReplyId, setEditReplyId] = useState(null); // 현재 "수정 모드"로 보고 있는 댓글의 ID (null이면 수정 중인 댓글 없음)
  const [editReplyText, setEditReplyText] = useState(""); // 수정 모드에서 사용하는 댓글 내용 입력값

  // 확인창 상태
  const [confirmOpen, setConfirmOpen] = useState(false); // 다이얼로그 열림 여부
  const [confirmType, setConfirmType] = useState(null); // 'post' 또는 'reply'
  const [targetId, setTargetId] = useState(null); // 삭제 대상 ID 저장
  const alertShownRef = useRef(false); // 알럿 중복 방지용 ref
  // useRef는 값이 변해도 리렌더링을 유발하지 않음.
  // 이 ref를 통해 한번 에러로 인해 alert를 띄웠으면 그 뒤에는 같은 렌더 사이클에서 또 띄우지 않도록 제어.

  // 날짜 포맷 변환 함수
  const formatDateTime = (str) => {
    if (!str) return ""; // 값이 없으면 빈 문자열 반환 (표시 안 함)
    
    try {
      let d;
      const dateString = String(str);
      
      // ISO 8601 형식인 경우 (서버에서 "2025-11-25T00:42:00" 형식으로 보냄)
      if (dateString.includes('T')) {
        // 타임존 정보가 없으면 한국 시간(UTC+9)으로 간주하여 파싱
        if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.match(/-\d{2}:\d{2}$/)) {
          // "2025-11-25T00:42:00" 형식을 한국 시간으로 파싱
          const [datePart, timePart] = dateString.split('T');
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
          d = new Date(dateString);
        }
      } else {
        d = new Date(str);
      }
      
      // 한국 시간으로 변환하여 포맷팅
      const koreaTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
      const koreaTime = new Date(koreaTimeStr);
      const pad = (n) => String(n).padStart(2, "0"); // 숫자를 항상 2자리 문자열로 만들기 위해 0을 앞에 채움
      
      // "YYYY-MM-DD HH:mm:ss" 형식으로 문자열 반환
      return `${koreaTime.getFullYear()}-${pad(koreaTime.getMonth() + 1)}-${pad(
        koreaTime.getDate()
      )} ${pad(koreaTime.getHours())}:${pad(koreaTime.getMinutes())}:${pad(koreaTime.getSeconds())}`;
    } catch (error) {
      console.error('[BoardDetailPage] formatDateTime 에러:', error, str);
      return "";
    }
  };

  // 게시글, 댓글, 파일 데이터 전체 로드
  const loadAll = async () => {
    setLoading(true);
    try {
      const detailRes = await getBoardDetail(boardId); // 게시글 상세조회 API 호출
      setBoard(detailRes.data.data); // 응답에서 실제 데이터 부분을 꺼내 board 상태에 저장

      const replyRes = await getRepliesByBoard(boardId); // 댓글 목록 조회 API 호출
      setReplies(replyRes.data.data || []); // 데이터가 없으면 null 방지를 위해 빈 배열로 대체

      const fileRes = await getFilesByBoard(boardId); // 첨부파일 목록 조회 API 호출
      setFiles(fileRes.data.data || []); // 마찬가지로 없으면 빈 배열로 처리
    } catch (err) {
      if (alertShownRef.current) return; // 이미 알럿 띄웠으면 더 이상 실행 안 함
      alertShownRef.current = true; // 첫 에러 시 한 번만 true로 설정

      // 비공개글 접근 차단 처리
      if (err.response?.status === 403) {
        showSnack("비공개 게시글입니다. 접근할 수 없습니다.", "error");
        navigate(-1); // 바로 이전 페이지로 돌아감 (브라우저 history 한 단계 뒤로)
        return;
      }
      // 존재하지 않거나 삭제된 게시글
      if (err.response?.status === 404) {
        showSnack("존재하지 않거나 삭제된 게시글입니다.", "error");
        navigate(-1);
        return;
      }
      // 기타 예외
      showSnack("게시글을 불러오는 중 오류가 발생했습니다.", "error"); // 위 두 케이스 외 나머지 서버/네트워크 에러
    } finally {
      setLoading(false);
    }
  };

  // 페이지 로드 시 게시글/댓글 불러오기
  useEffect(() => {
    // 컴포넌트가 처음 마운트되거나, URL의 boardId가 바뀔 때마다 실행
    loadAll(); // 게시글 상세, 댓글, 파일 정보를 한 번에 모두 가져옴
  }, [boardId]); // boardId가 변경되면 해당 게시글 기준으로 다시 조회

  // 작성자 or 관리자만 수정/삭제 가능
  const canEditOrDeletePost = useMemo(() => {
    // board가 아직 로드 안 됐으면 false
    if (!board) return false;
    // ADMIN 이거나, 게시글의 작성자 이름과 현재 로그인 이름이 같으면 수정/삭제 가능
    return loginRole === "ADMIN" || board.writerName === loginName;
  }, [board, loginName, loginRole]); // 게시글 정보/로그인 이름/역할이 바뀔 때마다 다시 계산

  // 부모 댓글과 자식 댓글 분리
  const rootReplies = useMemo(
    () => (replies || []).filter((r) => !r.parentReplyId), // parentReplyId가 없는 댓글 = 부모 댓글
    [replies]
  );
  const childReplies = (parentId) =>
    (replies || []).filter((r) => r.parentReplyId === parentId); // 인자로 들어온 parentId를 가진 댓글들만 필터링 → 해당 부모의 대댓글 목록

  // 상세 헤더용 "표시할 댓글 수" (삭제된 댓글 제외)
  const visibleReplyCount = useMemo(
    () => (replies || []).filter((r) => !r.deletedYn).length, // deletedYn이 false인 댓글 수만 카운트
    [replies]
  );

  // 게시글 삭제
  const handleDeletePost = async () => {
    showSnack("게시글 삭제 중입니다...", "info");
    try {
      await deleteBoard(boardId);
      showSnack("게시글이 삭제되었습니다.", "success");
      // 전체 게시판에서 온 경우
      if (fromAllBoard) {
        navigate("/board");
      }
      // 특정 카테고리에서 온 경우
      else {
        navigate(`/board/${board.categoryId}`);
      }
    } catch (err) {
      showSnack("게시글 삭제 중 오류가 발생했습니다.", "error");
    }
  };

  // 게시글 삭제 요청 전 다이얼로그 실행
  const handleOpenPostConfirm = () => {
    setConfirmType("post");
    setConfirmOpen(true);
  };

  // 댓글 등록 (일반 댓글 전용)
  const handleReplySubmit = async () => {
    if (!replyText.trim()) return; // 공백만 있는 경우 등록하지 않음
    try {
      await createReply({
        boardId: Number(boardId), // URL 파라미터는 문자열이라 Number로 형변환
        content: replyText, // 현재 입력창에 작성된 내용
      });
      setReplyText(""); // 입력 초기화
      await loadAll(); // 새로고침해서 최신 댓글 목록 반영
      showSnack("댓글이 등록되었습니다.", "success");
    } catch (err) {
      showSnack("댓글 등록 중 오류가 발생했습니다.", "error");
    }
  };

  // 대댓글 등록
  const handleChildReplySubmit = async () => {
    if (!childReplyText.trim()) return; // 내용이 비어 있으면 등록 안 함
    try {
      await createReply({
        boardId: Number(boardId), // 어떤 게시글에 대한 댓글인지
        content: childReplyText, // 대댓글 내용
        parentReplyId: replyParentId, // 어떤 부모 댓글에 대한 대댓글인지
      });
      setChildReplyText(""); // 대댓글 입력값 초기화
      setReplyParentId(null); // 입력창 닫기 (현재 선택된 부모 댓글 해제)
      await loadAll(); // 새로고침
      showSnack("답글이 등록되었습니다.", "success");
    } catch (err) {
      showSnack("답글 등록 중 오류가 발생했습니다.", "error");
    }
  };

  // 댓글 수정
  const handleReplyUpdate = async (replyId) => {
    if (!editReplyText.trim()) {
      showSnack("내용을 입력하세요.", "error"); // 수정 내용이 비어 있으면 경고
      return;
    }
    try {
      await updateReply(replyId, { content: editReplyText }); // 해당 댓글 ID 기준으로 내용 업데이트
      setEditReplyId(null); // 수정 모드 종료
      setEditReplyText(""); // 수정용 입력값 초기화
      await loadAll(); // 댓글 목록 다시 조회하여 변경된 내용 반영
      showSnack("댓글이 수정되었습니다.", "success");
    } catch (err) {
      showSnack("댓글 수정 중 오류가 발생했습니다.", "error");
    }
  };

  // 댓글 삭제
  const handleReplyDelete = async (replyId) => {
    showSnack("댓글 삭제 중입니다...", "info");
    try {
      await deleteReply(replyId); // 댓글 삭제 API 호출
      await loadAll(); // 삭제 후 댓글 목록 재조회
      showSnack("댓글이 삭제되었습니다.", "success");
    } catch (err) {
      showSnack("댓글 삭제 중 오류가 발생했습니다.", "error");
    }
  };

  // 댓글 삭제 요청 전 다이얼로그 실행
  const handleOpenReplyConfirm = (id) => {
    setConfirmType("reply");
    setTargetId(id);
    setConfirmOpen(true);
  };

  // 실제 삭제 실행
  const handleConfirm = async () => {
    setConfirmOpen(false);
    if (confirmType === "post") {
      await handleDeletePost();
    } else if (confirmType === "reply" && targetId) {
      await handleReplyDelete(targetId);
    }
    setTargetId(null);
    setConfirmType(null);
  };

  // 확인창 닫기
  const handleCancel = () => {
    setConfirmOpen(false);
    setTargetId(null);
    setConfirmType(null);
  };

  // 단일 파일 Blob 다운로드 방식으로 완전 교체
  const handleSingleDownload = async (file) => {
    const res = await getFile(file.id);
    const data = res.data.data;

    const link = document.createElement("a");
    link.href = data.fileUrl; // presigned URL 직접 사용
    link.download = data.fileName; // 다운로드 이름
    link.target = "_self";
    link.click();
  };

  // ZIP 다운로드는 fileNames만 전달
  const handleDownloadAll = async () => {
    try {
      const res = await downloadZipFiles(boardId);
      const blob = new Blob([res.data], { type: "application/zip" });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `attachments_${boardId}.zip`;
      link.click();
    } catch (err) {
      showSnack("ZIP 다운로드 실패", "error");
    }
  };

  // 미리보기 모달 열기
  const openPreview = (file) => {
    setPreviewFile(file);
    setOpenModal(true);
  };

  // 미리보기 모달 닫기
  const closePreview = () => {
    setOpenModal(false);
    setPreviewFile(null);
  };

  // 로딩 화면
  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>게시글을 불러오는 중...</Typography>
      </Box>
    );
  }

  if (!board) return <Typography>알 수 없는 페이지</Typography>;

  return (
    <Box sx={{ px: "5%", pt: 2 }}>
      {/* 페이지 전체를 감싸는 최상위 컨테이너 Box
          - px: 좌우 패딩 5%
          - pt: 상단 패딩 2 (theme spacing 단위) */}
      <Typography variant="h5" sx={{ mb: 1 }}>
        {board.title} {/* 게시글 제목 */}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {/* 프로필 이미지 */}
        <Avatar
          src={board.writerProfileImageUrl || undefined}
          sx={{ width: 24, height: 24 }}
        />

        {/* 이름 + 직급 + 날짜 + 조회수 */}
        <Typography variant="body2" color="text.secondary">
          {board.writerName}
          {board.writerJobGrade
            ? ` ${getJobGradeLabel(board.writerJobGrade)}`
            : ""}
          {" / "}
          {formatDateTime(board.createdAt)}
          {" / 조회 "}
          {board.viewCount}
        </Typography>
      </Stack>

      {/* 게시글 작성자 or 관리자만 수정/삭제 버튼 표시 */}
      {canEditOrDeletePost && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {/* 수정/삭제 버튼을 가로로 배치하는 Stack 컨테이너 */}
          <Button
            variant="outlined"
            size="small"
            sx={{ fontSize: "0.8rem", py: 0.5, px: 1.5 }}
            startIcon={<EditIcon />} // 수정 아이콘
            onClick={() =>
              navigate(`/board/edit/${board.id}`, {
                state: {
                  fromCategoryId: location.state?.fromAllBoard
                    ? ""
                    : board.categoryId,
                  fromAllBoard: location.state?.fromAllBoard ?? false,
                },
              })
            }
          >
            수정
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            sx={{ fontSize: "0.8rem", py: 0.5, px: 1.5 }}
            startIcon={<DeleteIcon />} // 삭제 아이콘
            onClick={handleOpenPostConfirm} // 게시글 삭제 실행
          >
            삭제
          </Button>
        </Stack>
      )}

      {/* 게시글 본문 */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          bgcolor: "#fff",
          width: "80%",
        }}
      >
        {/* 게시글 내용 영역 */}
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            minHeight: "330px",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowWrap: "break-word",
            minWidth: 0,
          }}
        >
          {board.content?.trim() ? board.content : "등록된 내용이 없습니다."}
          {/* content가 공백만 있는 경우 "등록된 내용이 없습니다." 표시 */}
        </Typography>
      </Paper>

      {/* 첨부파일 섹션 (내용 아래 / 댓글 위) */}
      {files.length > 0 && (
        <Box sx={{ width: "80%", mb: 4 }}>
          {/* 상단 타이틀 + 전체 다운로드 버튼 */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="h6">
              첨부파일{" "}
              <Typography component="span" variant="h6" color="primary">
                ({files.length}개)
              </Typography>
            </Typography>

            {/* 1개 이상이면 항상 전체 다운로드 버튼 표시 */}
            <Button
              variant="text"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadAll}
            >
              전체 다운로드
            </Button>
          </Stack>

          {/* 카드 리스트 (작성 페이지와 동일 스타일) */}
          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            {files.map((file) => (
              <Card
                key={file.id}
                sx={{
                  width: 150, // 작성 페이지와
                  height: 160,
                  borderRadius: 2,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => openPreview(file)} // 카드 클릭 → 미리보기 모달
              >
                {/* 썸네일 */}
                {isImage(file.fileName) ? (
                  <CardMedia
                    component="img"
                    height="100"
                    image={file.fileUrl} // S3에 저장된 이미지 URL
                    alt={file.fileName}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 100,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#f5f5f5",
                    }}
                  >
                    <DescriptionIcon sx={{ fontSize: 80, color: "#9e9e9e" }} />
                  </Box>
                )}

                {/* 파일명 / 용량 */}
                <CardContent sx={{ p: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(file.fileSize / 1024).toFixed(1)} KB
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* 첨부파일 미리보기 모달 */}
      <Modal open={openModal} onClose={closePreview}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "white",
            p: 3,
            borderRadius: 2,
            width: 400,
            textAlign: "center",
          }}
        >
          {/* 모달 상단 X 버튼 */}
          <IconButton
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
            }}
            onClick={closePreview}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Typography variant="h6" sx={{ mb: 2 }}>
            {previewFile?.fileName || "파일 미리보기"}
          </Typography>

          {previewFile && isImage(previewFile.fileName) ? (
            <img
              src={previewFile.fileUrl}
              alt={previewFile.fileName}
              style={{
                width: "100%",
                maxHeight: 300,
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          ) : (
            <DescriptionIcon sx={{ fontSize: 80, color: "#777" }} />
          )}

          {/* 모달에서 다운로드 클릭 */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => {
                handleSingleDownload(previewFile);
              }}
            >
              다운로드
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 댓글 섹션 제목 */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h6">댓글</Typography>
        <Typography variant="h6" color="primary">
          ({visibleReplyCount}) {/* 삭제된 댓글 제외 카운트 */}
        </Typography>
      </Stack>

      {/* 댓글이 없을 경우 안내문 */}
      {rootReplies.length === 0 && (
        <Typography
          color="text.secondary"
          sx={{ ml: 0.5, mb: 2, width: "80%" }}
        >
          아직 댓글이 없습니다.
        </Typography>
      )}

      {/* 댓글 목록 렌더링 */}
      <Box sx={{ width: "80%" }}>
        {rootReplies.map((r) => {
          const children = childReplies(r.id); // 대댓글 목록 필터링

          // 삭제된 부모 + 자식 댓글 없음 → 표시하지 않음
          if (r.deletedYn && children.length === 0) {
            return null;
          }

          return (
            <React.Fragment key={r.id}>
              <Box sx={{ mb: children.length ? 0 : 2 }}>
                {/* 부모 댓글 카드 */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: "#fff",
                    opacity: r.deletedYn ? 0.6 : 1,
                  }}
                >
                  {/* 댓글 상단 영역 */}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar
                        src={r.writerProfileImageUrl || undefined}
                        sx={{ width: 24, height: 24 }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {r.writerName || "익명"}
                        {r.writerJobGrade
                          ? ` ${getJobGradeLabel(r.writerJobGrade)}`
                          : ""}
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          (
                          {r.updatedAt
                            ? `${formatDateTime(r.updatedAt)} · 수정됨`
                            : formatDateTime(r.createdAt)}
                          )
                        </Typography>
                      </Typography>
                    </Stack>

                    {/* 댓글 수정/삭제 */}
                    {!r.deletedYn &&
                      (loginRole === "ADMIN" || r.writerName === loginName) && (
                        <Stack direction="row" spacing={1}>
                          {editReplyId !== r.id ? (
                            <>
                              {/* 수정 모드가 아닐 때: 수정 / 삭제 텍스트 버튼 */}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => {
                                  setEditReplyId(r.id); // 이 댓글을 수정 모드로 설정
                                  setEditReplyText(r.content); // 기존 내용을 수정 입력값에 채워넣음
                                }}
                              >
                                수정
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => handleOpenReplyConfirm(r.id)}
                              >
                                삭제
                              </Typography>
                            </>
                          ) : (
                            <>
                              {/* 수정 모드일 때: 저장 / 취소 버튼 */}
                              <Typography
                                variant="caption"
                                color="primary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => handleReplyUpdate(r.id)}
                              >
                                저장
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => setEditReplyId(null)}
                              >
                                취소
                              </Typography>
                            </>
                          )}
                        </Stack>
                      )}
                  </Stack>

                  {/* 댓글 내용 */}
                  {r.deletedYn ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, fontStyle: "italic" }}
                    >
                      삭제된 댓글입니다.
                    </Typography>
                  ) : editReplyId === r.id ? (
                    // 이 댓글이 현재 수정 모드일 때: 입력창으로 표시
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      value={editReplyText}
                      onChange={(e) => setEditReplyText(e.target.value)}
                      sx={{ mt: 1 }}
                    />
                  ) : (
                    // 일반 모드일 때: 텍스트로 내용 표시
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        overflowWrap: "break-word",
                      }}
                    >
                      {r.content?.trim() ? r.content : "내용 없음"}
                    </Typography>
                  )}

                  {/* 답글 버튼 */}
                  {!r.deletedYn && (
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{
                        cursor: "pointer",
                        mt: 1,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                      onClick={
                        () =>
                          setReplyParentId(replyParentId === r.id ? null : r.id)
                        // 이미 같은 부모에 대한 답글 입력창이 열려 있으면 닫고, 아니면 해당 댓글에 대한 입력창 열기
                      }
                    >
                      <ReplyIcon fontSize="small" sx={{ mr: 0.3 }} />
                      답글
                    </Typography>
                  )}

                  {/* 답글 입력창 (childReplyText 사용) */}
                  {replyParentId === r.id && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mt: 1,
                        ml: 3,
                        p: 1,
                        border: "1px solid #ddd",
                        borderRadius: 2,
                        bgcolor: "#fafafa",
                        width: "80%",
                      }}
                    >
                      {/* 대댓글 내용 입력 TextField */}
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={5}
                        placeholder="답글을 입력하세요"
                        value={childReplyText}
                        onChange={(e) => setChildReplyText(e.target.value)}
                        variant="outlined"
                      />
                      <Button
                        sx={{ ml: 1, minWidth: "70px" }}
                        variant="contained"
                        onClick={handleChildReplySubmit}
                      >
                        등록
                      </Button>
                    </Box>
                  )}
                </Paper>
              </Box>

              {/* 대댓글 렌더링 */}
              {children
                .filter((child) => !child.deletedYn) // 자식 댓글 중 삭제되지 않은 것만 표시
                .map((child, idx) => (
                  <Paper
                    key={child.id}
                    variant="outlined"
                    sx={{
                      ml: 4,
                      mt: idx === 0 ? "2px" : "4px", // 첫 대댓글은 완전 붙이기
                      mb: idx === children.length - 1 ? "16px" : "2px", // 마지막만 띄움
                      p: 1.5,
                      bgcolor: "#fcfcfc",
                    }}
                  >
                    {/* 대댓글 상단: 작성자, 작성일, 수정/삭제 */}
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar
                          src={child.writerProfileImageUrl || undefined}
                          sx={{ width: 24, height: 24 }}
                        />
                        <Typography variant="subtitle2">
                          ↳ {child.writerName}
                          {child.writerJobGrade
                            ? ` ${getJobGradeLabel(child.writerJobGrade)}`
                            : ""}
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            (
                            {child.updatedAt
                              ? `${formatDateTime(child.updatedAt)} · 수정됨`
                              : formatDateTime(child.createdAt)}
                            )
                          </Typography>
                        </Typography>
                      </Stack>

                      {(loginRole === "ADMIN" ||
                        child.writerName === loginName) && (
                        <Stack direction="row" spacing={1}>
                          {editReplyId !== child.id ? (
                            <>
                              {/* 대댓글이 수정 모드가 아닐 때: 수정 / 삭제 */}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => {
                                  setEditReplyId(child.id); // 이 대댓글을 수정 대상으로 설정
                                  setEditReplyText(child.content); // 기존 내용 채우기
                                }}
                              >
                                수정
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => handleOpenReplyConfirm(child.id)}
                              >
                                삭제
                              </Typography>
                            </>
                          ) : (
                            <>
                              {/* 대댓글이 수정 모드일 때: 저장 / 취소 */}
                              <Typography
                                variant="caption"
                                color="primary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => handleReplyUpdate(child.id)}
                              >
                                저장
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ cursor: "pointer" }}
                                onClick={() => setEditReplyId(null)}
                              >
                                취소
                              </Typography>
                            </>
                          )}
                        </Stack>
                      )}
                    </Stack>

                    {/* 대댓글 내용 */}
                    {editReplyId === child.id ? (
                      // 수정 모드일 때 입력창
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={editReplyText}
                        onChange={(e) => setEditReplyText(e.target.value)}
                        sx={{ mt: 1 }}
                      />
                    ) : (
                      // 일반 모드일 때 텍스트 출력
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.5,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          overflowWrap: "break-word",
                        }}
                      >
                        {child.content?.trim() ? child.content : "내용 없음"}
                      </Typography>
                    )}
                  </Paper>
                ))}
            </React.Fragment>
          );
        })}
      </Box>

      {/* 댓글 입력창 (새 댓글 작성용) */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          width: "80%",
          border: "1px solid #ddd",
          borderRadius: 2,
          p: 1.5,
          bgcolor: "#fafafa",
          mt: 3,
        }}
      >
        {/* 로그인한 사용자의 이름 라벨 */}
        <Typography
          variant="body2"
          sx={{
            mr: 2,
            color: "text.secondary",
            whiteSpace: "nowrap",
            minWidth: 70,
          }}
        >
          {loginName}
        </Typography>

        {/* 새 댓글 입력 TextField */}
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          placeholder="댓글을 입력하세요"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)} // 입력 시 상태 갱신
          variant="outlined"
        />
        <Button
          sx={{ ml: 1, minWidth: "80px" }}
          variant="contained"
          onClick={handleReplySubmit} // 등록 버튼 클릭 시 실행
        >
          등록
        </Button>
      </Box>
      {/* 삭제 확인창 다이얼로그 */}
      <ConfirmDialog
        open={confirmOpen}
        title="삭제 확인"
        message={
          confirmType === "post"
            ? "이 게시글을 삭제하시겠습니까?"
            : "이 댓글을 삭제하시겠습니까?"
        }
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default BoardDetailPage;
