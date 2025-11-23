import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  ListItemButton,
  Stack,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Avatar,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  getBoardsByCategory,
  getBoardsOrdered,
  searchBoards,
} from "../api/boardAPI";
import CommentIcon from "@mui/icons-material/Comment";
import RecentViewedBoards from "./RecentViewedBoards";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { getJobGradeLabel } from "../../../utils/labelUtils";

const BoardListPage = () => {
  const { categoryId } = useParams(); // URL의 /board/:categoryId 값 추출 (없으면 undefined)
  const [searchParams] = useSearchParams(); // URL 쿼리스트링 (?page=, ?sortType= 등) 제어용
  const navigate = useNavigate(); // 페이지 이동 훅 (ex. navigate("/board/new"))
  const { showSnack } = useSnackbarContext(); // 스낵바 훅 사용
  const currentPage = Number(searchParams.get("page")) || 0; // 현재 페이지 번호 (기본 0)
  const urlType = searchParams.get("type") || ""; // 검색 유형 (title, content, author 등)
  const urlKeyword = (searchParams.get("keyword") || "").trim(); // 검색 키워드
  const urlSortType = searchParams.get("sortType") || "latest"; // 정렬 기준 (기본값: 최신순)
  const isSearchPage = urlType && urlKeyword !== ""; // 검색 페이지 여부 판단
  const [boards, setBoards] = useState([]); // 게시글 목록 배열
  const [pageInfo, setPageInfo] = useState({ number: 0, totalPages: 1 }); // 페이지 정보 객체
  const [searchType, setSearchType] = useState(urlType || "title"); // 검색 구분 (제목/내용/작성자)
  const [keyword, setKeyword] = useState(urlKeyword || ""); // 검색어 입력값
  const [sortType, setSortType] = useState(urlSortType); // 정렬 상태 (최신순/조회순)
  const [loading, setLoading] = useState(true); // 로딩 상태

  // URL 변경 시 검색 폼 상태를 동기화
  useEffect(() => {
    setSearchType(urlType || "title"); // URL 쿼리(type)과 동기화
    setKeyword(urlKeyword || ""); // URL 쿼리(keyword)와 동기화
  }, [urlType, urlKeyword]); // 의존성 추가

  // 게시글 목록 불러오기
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let res; // API 응답 결과 저장용 변수
        if (isSearchPage) {
          // 검색 페이지인 경우
          res = await searchBoards(urlType, urlKeyword, currentPage);
        } else {
          // 일반 목록 페이지인 경우
          if (categoryId) {
            // 카테고리별 게시판
            res = await getBoardsByCategory(categoryId, sortType, currentPage);
          } else {
            // 전체 게시판 (정렬 기준 적용)
            res = await getBoardsOrdered(sortType, currentPage);
          }
        }

        // 응답에서 content(게시글 목록)과 페이징 데이터 추출
        setBoards(res.data.data.content);
        setPageInfo(res.data.data);
      } catch (err) {
        showSnack("게시글 목록을 불러오는 중 오류가 발생했습니다.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId, currentPage, isSearchPage, urlType, urlKeyword, sortType]); // 의존성 배열: 이 중 하나라도 바뀌면 다시 실행

  //  날짜 포맷 함수
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr); // 'MM-DD HH:mm' 형식으로 변환
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  // 페이지 이동 함수
  const handlePageChange = (e, v) => {
    const newPage = v - 1; // MUI는 1부터 시작하지만 API는 0부터 시작하므로 보정
    const queryBase = categoryId ? `/board/${categoryId}` : "/board";
    const sortQuery = `sortType=${sortType}`;

    if (isSearchPage) {
      // 검색 중인 경우: 검색 상태 유지한 채 페이지 이동
      navigate(
        `/board/search?type=${urlType}&keyword=${encodeURIComponent(
          urlKeyword
        )}&page=${newPage}`
      );
      return;
    }

    navigate(`${queryBase}?${sortQuery}&page=${newPage}`); // 일반 목록: 정렬 기준과 페이지 정보 포함 이동
  };

  // 검색 기능
  const handleSearch = () => {
    const trimmed = keyword.trim(); // 공백 제거
    if (!trimmed) {
      // 검색어 없을 시 → 기본 목록으로 이동
      if (categoryId)
        navigate(`/board/${categoryId}?sortType=${sortType}&page=0`);
      else navigate(`/board?sortType=${sortType}&page=0`);
      return;
    }

    // 검색어 있을 경우: type, keyword, page 포함해 이동
    navigate(
      `/board/search?type=${searchType}&keyword=${encodeURIComponent(
        trimmed
      )}&page=0`
    );
  };

  const handleKeyPress = (e) => {
    // Enter 키로 검색 실행
    if (e.key === "Enter") handleSearch();
  };

  // 정렬 변경 기능
  const handleSortChange = (e) => {
    const newSort = e.target.value; // 선택된 정렬값 (latest/views)
    setSortType(newSort); // 상태 업데이트
    // 정렬 변경 시 페이지를 0으로 초기화하여 다시 요청
    if (categoryId) navigate(`/board/${categoryId}?sortType=${newSort}&page=0`);
    else navigate(`/board?sortType=${newSort}&page=0`);
  };

  // 로딩 화면
  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "70vh",
        }}
      >
        <Stack alignItems="center">
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>게시글을 불러오는 중...</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 3 }}>
      <Box sx={{ flex: 3 }}>
        {/* 상단 정렬 및 검색 영역 */}
        <Stack
          direction="row"
          spacing={2}
          justifyContent="space-between"
          alignItems="center"
          sx={{
            mb: 2,
            width: "80%",
            mx: "auto",
          }}
        >
          {/* 정렬 선택박스 */}
          <FormControl size="small" sx={{ width: 130 }}>
            <InputLabel id="sort-label">정렬</InputLabel>
            <Select
              labelId="sort-label"
              value={sortType}
              label="정렬"
              onChange={handleSortChange}
            >
              <MenuItem value="latest">최신순</MenuItem>
              <MenuItem value="views">조회순</MenuItem>
            </Select>
          </FormControl>

          {/* 검색 영역 */}
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ width: 100 }}>
              <InputLabel>검색구분</InputLabel>
              <Select
                value={searchType}
                label="검색구분"
                onChange={(e) => setSearchType(e.target.value)}
              >
                {/* 검색 조건 선택 */}
                <MenuItem value="title">제목</MenuItem>
                <MenuItem value="content">내용</MenuItem>
                <MenuItem value="author">작성자</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              placeholder="검색어를 입력하세요"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyPress}
              sx={{ width: 250 }}
            />

            <Button
              variant="contained"
              size="small"
              onClick={handleSearch}
              sx={{
                fontWeight: 700,
                borderRadius: 2,
                px: 2.5,
                py: 1,
              }}
            >
              검색
            </Button>
          </Stack>
        </Stack>

        {/* 게시글 목록 영역 */}
        {boards.map((b, idx) => (
          <Box key={b.id}>
            {/* 카드 사이 구분선 추가 */}
            {idx > 0 && (
              <Divider
                sx={{
                  width: "80%",
                  mx: "auto",
                  borderColor: "#e0e0e0",
                }}
              />
            )}

            <ListItemButton
              onClick={() =>
                navigate(`/board/detail/${b.id}`, {
                  state: { fromAllBoard: !categoryId },
                })
              }
              sx={{
                // 카드 사이 간격 제거
                mb: 0,

                // 리스트처럼 붙지만 섹션 전체는 둥글게 유지
                borderRadius:
                  idx === 0
                    ? "12px 12px 0 0"
                    : idx === boards.length - 1
                    ? "0 0 12px 12px"
                    : 0,

                bgcolor: b.pinned
                  ? "#FFF5D6" // 상단고정만 색 유지
                  : "white",

                border: "1px solid #e5e5e5",
                py: 2,
                px: 2,
                width: "80%",
                mx: "auto",
                boxShadow: "0 2px 4px rgba(0,0,0,0.03)",

                "&:hover": {
                  backgroundColor: "#f7f7f7",
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                  transition: "0.15s ease",
                },

                transition: "0.15s ease",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ display: "flex", width: "100%", minWidth: 0 }}>
                <Box sx={{ flex: 4, pr: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {b.categoryName || "전체 게시판"}
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <CommentIcon sx={{ fontSize: 20, color: "#1976d2" }} />
                      <Typography variant="caption" color="text.secondary">
                        {b.replyCount ?? 0}
                      </Typography>

                      {b.fileCount > 0 && (
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.3}
                          sx={{ ml: 1 }}
                        >
                          <AttachFileIcon
                            sx={{ fontSize: 20, color: "#e78018ff" }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {b.fileCount}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={1}>
                    {b.pinned && (
                      <Typography sx={{ fontSize: 20 }}>📢</Typography>
                    )}
                    {!b.pinned && b.noticeYn && (
                      <Typography sx={{ fontSize: 20 }}>📢</Typography>
                    )}
                    {b.privateYn && (
                      <Typography sx={{ fontSize: 19 }}>🔒</Typography>
                    )}

                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        fontSize: 17,
                        flexGrow: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {b.title}
                    </Typography>
                  </Stack>

                  {b.content && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.5,
                        mb: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-word", // 영어 단어 줄바꿈 핵심
                        overflowWrap: "break-word", // 길게 이어진 텍스트 박스 밖으로 못 나가게
                        minWidth: 0, // flex 아이템 관련(“필요하면 너 마음대로 줄바꿈 해도 된다.”)
                      }}
                    >
                      {b.content}
                    </Typography>
                  )}

                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar
                      src={b.writerProfileImageUrl || undefined}
                      sx={{ width: 24, height: 24, mr: 0.5 }}
                    />

                    <Typography variant="caption" color="text.secondary">
                      {b.writerName}
                      {b.writerJobGrade
                        ? ` ${getJobGradeLabel(b.writerJobGrade)}`
                        : ""}
                      {" / "}
                      {formatDate(b.createdAt)}
                      {" / 조회수 "}
                      {b.viewCount ?? 0}
                    </Typography>
                  </Stack>
                </Box>

                {b.files &&
                  b.files.length > 0 &&
                  b.files[0].fileUrl &&
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(b.files[0].fileName) && (
                    <Box
                      sx={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                      }}
                    >
                      <Box
                        component="img"
                        src={b.files[0].fileUrl}
                        alt={b.files[0].fileName}
                        sx={{
                          width: "100%",
                          height: 112,
                          objectFit: "cover",
                          borderRadius: "10px",
                        }}
                      />
                    </Box>
                  )}
              </Box>
            </ListItemButton>
          </Box>
        ))}

        {/* 페이지네이션 영역 */}
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 5 }}>
          {(() => {
            const totalPages = pageInfo.totalPages || 1;
            const page = currentPage + 1;

            const blockSize = 10;
            const currentBlock = Math.floor((page - 1) / blockSize);
            const blockStart = currentBlock * blockSize + 1;
            const blockEnd = Math.min(blockStart + blockSize - 1, totalPages);

            const goPage = (p) => handlePageChange(null, p);

            // 얇은 기본 버튼 스타일
            const baseStyle = {
              minWidth: 30,
              height: 32,
              mx: 0.3,
              borderRadius: "8px",
              fontSize: "0.83rem",
              fontWeight: 500,
              color: "#3a8ea0",
              backgroundColor: "transparent",
              border: "1px solid #d6e7ea",
              transition: "0.18s ease",
              "&:hover": {
                backgroundColor: "#eefbfd",
                borderColor: "#9ad3dd",
              },
            };

            // 활성 페이지는 좀 더 강조된 pill 스타일
            const activeStyle = {
              ...baseStyle,
              backgroundColor: "#0aa2b4",
              color: "white",
              borderColor: "#0aa2b4",
              fontWeight: 700,
              "&:hover": {
                backgroundColor: "#0895a5",
                borderColor: "#0895a5",
              },
            };

            // 비활성(클릭 불가) 스타일 – 흐릿+호버 무시
            const disabledStyle = {
              ...baseStyle,
              color: "#c5c5c5",
              borderColor: "#e3e3e3",
              cursor: "default",
              "&:hover": {
                backgroundColor: "transparent",
                borderColor: "#e3e3e3",
              },
            };

            return (
              <Stack direction="row" spacing={0.5} alignItems="center">
                {/* << 처음 */}
                <Button
                  sx={blockStart === 1 ? disabledStyle : baseStyle}
                  disabled={blockStart === 1}
                  onClick={() => goPage(1)}
                >
                  {"<<"}
                </Button>

                {/* < 이전 */}
                <Button
                  sx={blockStart === 1 ? disabledStyle : baseStyle}
                  disabled={blockStart === 1}
                  onClick={() => goPage(blockStart - blockSize)}
                >
                  {"<"}
                </Button>

                {/* 페이지 번호 */}
                {[...Array(Math.max(0, blockEnd - blockStart + 1))].map(
                  (_, idx) => {
                    const pageNumber = blockStart + idx;
                    return (
                      <Button
                        key={pageNumber}
                        sx={pageNumber === page ? activeStyle : baseStyle}
                        onClick={() => goPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    );
                  }
                )}

                {/* > 다음 */}
                <Button
                  sx={blockEnd === totalPages ? disabledStyle : baseStyle}
                  disabled={blockEnd === totalPages}
                  onClick={() => goPage(blockEnd + 1)}
                >
                  {">"}
                </Button>

                {/* >> 마지막 */}
                <Button
                  sx={blockEnd === totalPages ? disabledStyle : baseStyle}
                  disabled={blockEnd === totalPages}
                  onClick={() => goPage(totalPages)}
                >
                  {">>"}
                </Button>
              </Stack>
            );
          })()}
        </Box>
      </Box>

      {/* 오른쪽 사이드 영역: 최근 본 게시글 */}
      <Box
        sx={{
          width: 340, // 가로 고정
          flexShrink: 0, // 공간 부족해도 줄어들지 않음
          ml: 3, // 왼쪽 영역과 간격
        }}
      >
        <RecentViewedBoards />
      </Box>
    </Box>
  );
};

export default BoardListPage;
