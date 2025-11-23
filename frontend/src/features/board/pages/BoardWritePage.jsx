import { useEffect, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Checkbox,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Modal,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Paper,
  Divider,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { createBoard, getBoardDetail, updateBoard } from "../api/boardAPI";
import {
  uploadFiles,
  getFilesByBoard,
  deleteFilesBulk,
} from "../api/boardFileAPI";
import { getAllCategories } from "../api/boardCategoryAPI";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";

const BoardWritePage = () => {
  const { boardId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSnack } = useSnackbarContext();
  const [form, setForm] = useState({
    title: "",
    content: "",
    categoryId: "",
    noticeYn: false,
    privateYn: false,
    pinned: false,
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const fromCategoryId = location.state?.fromCategoryId || "";
  const fromAllBoard = location.state?.fromAllBoard || false;

  //  파일 관련 상태
  const [files, setFiles] = useState([]);
  const [deletedExistingFiles, setDeletedExistingFiles] = useState([]); // 기존 파일 삭제목록
  const [previewFile, setPreviewFile] = useState(null); // 모달용
  const [openModal, setOpenModal] = useState(false); // 모달 열기/닫기

  // 파일 확장자 체크 → 이미지인지 비이미지인지 구분용
  const isImage = (name) => {
    return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
  };

  // 신규 작성 시 카테고리 조회
  useEffect(() => {
    if (!boardId) {
      (async () => {
        try {
          const res = await getAllCategories();
          const list = res.data.data || [];
          setCategories(list);

          const defaultCat = searchParams.get("categoryId");
          if (defaultCat) {
            setForm((f) => ({ ...f, categoryId: defaultCat }));
          }
        } catch {
          showSnack("카테고리를 불러오지 못했습니다.", "error");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [boardId]);

  // 수정 모드 → 기존 정보 불러오기
  useEffect(() => {
    if (!boardId) return;

    (async () => {
      try {
        // 게시글 정보
        const res = await getBoardDetail(boardId);
        const data = res.data.data;

        setForm({
          title: data.title,
          content: data.content,
          categoryId: data.categoryId,
          noticeYn: data.noticeYn,
          privateYn: data.privateYn,
          pinned: data.pinned,
        });

        // 기존 파일 목록 조회 추가
        const fileRes = await getFilesByBoard(boardId);
        const rawFiles = fileRes.data.data || [];

        // 기존 파일은 백엔드 DTO 구조(fileName, fileSize, fileUrl 등)를
        // 프론트에서 사용하는 통합 구조(name, size, url, type 등)로 변환
        const existingFiles = rawFiles.map((f) => ({
          ...f, // 필요시 다른 필드도 같이 보존
          type: "existing", // 기존 파일 표시용 플래그
          name: f.fileName, // 렌더링에서 공통으로 사용할 필드
          size: f.fileSize,
          url: f.fileUrl, // presigned URL
        }));

        setFiles(existingFiles); // 변환된 구조로 세팅
      } catch (err) {
        showSnack("게시글 정보를 불러오지 못했습니다.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [boardId]);

  // 로딩 화면
  if (loading) {
    return (
      <Box
        sx={{
          height: "70vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>게시글 정보를 불러오는 중...</Typography>
      </Box>
    );
  }

  // 입력 핸들러
  const handleChange = (e) => {
    const { name, checked, value, type } = e.target;

    // 상단 고정 선택 시 → 공지 자동 ON / 비공개 자동 OFF
    if (name === "pinned") {
      if (checked) {
        setForm((f) => ({
          ...f,
          pinned: true,
          noticeYn: true, // 공지 자동 활성화
          privateYn: false, // 비공개 불가
        }));
      } else {
        setForm((f) => ({ ...f, pinned: false }));
      }
      return;
    }

    // 공지글 선택 시 → 비공개 자동 OFF
    if (name === "noticeYn") {
      if (checked) {
        setForm((f) => ({
          ...f,
          noticeYn: true,
          privateYn: false, // 비공개 불가
        }));
      } else {
        setForm((f) => ({ ...f, noticeYn: false }));
      }
      return;
    }

    // 비공개 선택 시 → 공지/상단고정 자동 OFF
    if (name === "privateYn") {
      if (checked) {
        setForm((f) => ({
          ...f,
          privateYn: true,
          noticeYn: false, // 공지 OFF
          pinned: false, // 상단고정 OFF
        }));
      } else {
        setForm((f) => ({ ...f, privateYn: false }));
      }
      return;
    }

    // 기본 필드 처리
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // 파일 선택 (append 방식)
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);

    // 파일명 최대 길이 설정
    const MAX_NAME_LENGTH = 50;

    for (const file of selectedFiles) {
      if (file.name.length > MAX_NAME_LENGTH) {
        showSnack(`파일명은 ${MAX_NAME_LENGTH}자를 넘을 수 없습니다.`, "error");
        return; // 해당 파일 업로드 취소
      }
    }

    const newFiles = selectedFiles.map((file) => ({
      type: "new",
      file,
      name: file.name,
      size: file.size,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  // 개별 파일 취소
  const removeFile = (idx) => {
    setFiles((prev) => {
      const target = prev[idx];

      // 기존 파일 삭제 → 목록 추가
      if (target.type === "existing") {
        setDeletedExistingFiles((list) => [...list, target.id]);
      }

      return prev.filter((_, i) => i !== idx);
    });
  };

  // 등록/수정 처리
  const handleSubmit = async () => {
    if (!boardId && !form.categoryId) {
      showSnack("카테고리를 선택해주세요.", "error");
      return;
    }

    if (!form.title.trim()) {
      showSnack("제목을 입력해주세요.", "error");
      return;
    }

    try {
      // 수정 모드
      if (boardId) {
        await updateBoard(boardId, form);

        if (deletedExistingFiles.length > 0) {
          await deleteFilesBulk(deletedExistingFiles);
        }

        const uploadList = files
          .filter((f) => f.type === "new" && f.file)
          .map((f) => f.file);

        if (uploadList.length > 0) {
          await uploadFiles(boardId, uploadList);
        }

        showSnack("수정 완료!", "success");

        // 추가된 분기 로직
        if (fromAllBoard) {
          navigate("/board");
        } else if (fromCategoryId) {
          navigate(`/board/${fromCategoryId}`);
        } else {
          navigate("/board");
        }

        return;
      }

      // 신규 작성 모드
      // categoryId를 숫자로 변환 (빈 문자열이면 null로 처리)
      const boardData = {
        ...form,
        categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
      };
      const res = await createBoard(boardData);
      const newId = res.data.data.id;

      // 새 파일만 추출해서 업로드
      const uploadList = files
        .filter((f) => f.type === "new")
        .map((f) => f.file);

      if (uploadList.length > 0) await uploadFiles(newId, uploadList);

      showSnack("등록 완료!", "success");

      navigate(`/board/${form.categoryId}`);
    } catch (err) {
      if (err?.response?.status === 403 && form.noticeYn) {
       showSnack("공지글 작성 권한이 없습니다.", "error");
     } else {
       showSnack("저장 중 오류가 발생했습니다.", "error");
     }

    }
  };

  // 모달 열기
  const openPreview = (file) => {
    setPreviewFile(file); // file 객체 그대로 저장 (type/new,existing 포함)
    setOpenModal(true);
  };

  // 모달 닫기
  const closePreview = () => {
    setOpenModal(false);
    setPreviewFile(null);
  };

  return (
    <Box
      sx={{
        bgcolor: "#f5f7fa",
        py: 4,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: "90%",
          maxWidth: 1200,
          bgcolor: "white",
          p: 4,
          borderRadius: 3,
          boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
        }}
      >
        {/* 제목 영역 */}
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {boardId ? "게시글 수정" : "새 게시글 작성"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          게시글 정보를 입력하고, 필요한 경우 파일을 첨부해주세요.
        </Typography>

        {/* 기본 정보 */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 2 }}>기본 정보</Typography>
          <Divider sx={{ mb: 2 }} />

          {/* 카테고리 선택 */}
          {!boardId ? (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>카테고리 선택</InputLabel>
              <Select
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                label="카테고리 선택"
              >
                <MenuItem value="">선택</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Typography sx={{ mb: 2, fontWeight: 600 }}>
              {form.categoryName}
            </Typography>
          )}

          <TextField
            label="제목"
            name="title"
            fullWidth
            sx={{ mb: 1 }}
            value={form.title}
            onChange={handleChange}
            inputProps={{ maxLength: 50 }}
          />

          <Box
            sx={{
              textAlign: "right",
              fontSize: "0.8rem",
              color: form.title.length >= 50 ? "red" : "gray",
              mb: 2,
            }}
          >
            {form.title.length}/50
          </Box>

          <TextField
            label="내용"
            name="content"
            multiline
            rows={8}
            fullWidth
            sx={{
              mb: 1,
              "& textarea": {
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                overflowWrap: "break-word",
              },
            }}
            value={form.content}
            onChange={handleChange}
          />
        </Paper>

        {/* 옵션 */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 2 }}>게시글 옵션</Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: "flex", gap: 4 }}>
            {/* 공지글 */}
            <FormControlLabel
              control={
                <Checkbox
                  name="noticeYn"
                  checked={form.noticeYn}
                  onChange={handleChange}
                  disabled={form.privateYn}
                />
              }
              label={
                <Typography
                  sx={{
                    color: form.noticeYn ? "primary.main" : "text.secondary",
                    fontWeight: form.noticeYn ? "bold" : "normal",
                  }}
                >
                  공지글
                </Typography>
              }
            />

            {/* 상단 고정 */}
            <FormControlLabel
              control={
                <Checkbox
                  name="pinned"
                  checked={form.pinned}
                  onChange={handleChange}
                  disabled={form.privateYn}
                />
              }
              label={
                <Typography
                  sx={{
                    color: form.pinned ? "primary.dark" : "text.secondary",
                    fontWeight: form.pinned ? "bold" : "normal",
                  }}
                >
                  상단 고정
                </Typography>
              }
            />

            {/* 비공개 */}
            <FormControlLabel
              control={
                <Checkbox
                  name="privateYn"
                  checked={form.privateYn}
                  onChange={handleChange}
                  disabled={form.noticeYn || form.pinned}
                />
              }
              label={
                <Typography
                  sx={{
                    color: form.privateYn ? "error.main" : "text.secondary",
                    fontWeight: form.privateYn ? "bold" : "normal",
                  }}
                >
                  비공개
                </Typography>
              }
            />
          </Box>

          {/* 비공개 시 안내 메시지 */}
          {form.privateYn && (
            <Typography
              variant="caption"
              sx={{ color: "error.main", mt: 1, ml: 0.5, display: "block" }}
            >
              비공개 게시글은 공지/상단 고정 옵션을 사용할 수 없습니다.
            </Typography>
          )}

          {/* 공지 or 상단고정 선택 시 안내 메시지 */}
          {(form.noticeYn || form.pinned) && (
            <Typography
              variant="caption"
              sx={{ color: "primary.main", mt: 1, ml: 0.5, display: "block" }}
            >
              공지/상단 고정 게시글은 비공개로 설정할 수 없습니다.
            </Typography>
          )}
        </Paper>

        {/* 파일 첨부 */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 2 }}>파일 첨부</Typography>
          <Divider sx={{ mb: 2 }} />

          {/* 업로드 제한 안내 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              • 파일명은 최대 50자까지 가능합니다.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • 단일 파일 최대 50MB / 전체 최대 100MB 업로드 가능
            </Typography>
          </Box>

          <Button variant="outlined" component="label">
            파일 선택
            <input type="file" multiple hidden onChange={handleFileSelect} />
          </Button>

          <Typography sx={{ ml: 2, display: "inline-block" }}>
            ({files.length}개)
          </Typography>

          {/* 파일 카드 리스트 */}
          <Box sx={{ mt: 3, display: "flex", flexWrap: "wrap", gap: 2 }}>
            {files.map((file, idx) => (
              <Card
                key={idx}
                sx={{
                  width: 150,
                  height: 160,
                  borderRadius: 2,
                  boxShadow: "0px 1px 5px rgba(0,0,0,0.15)",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => openPreview(file)}
              >
                {/* 삭제 버튼 */}
                <IconButton
                  size="small"
                  sx={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    bgcolor: "white",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>

                {isImage(file.name) ? (
                  <CardMedia
                    component="img"
                    height="100"
                    image={
                      file.type === "existing"
                        ? file.url
                        : URL.createObjectURL(file.file)
                    }
                  />
                ) : (
                  <Box
                    sx={{
                      height: 100,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#f3f3f3",
                    }}
                  >
                    <DescriptionIcon sx={{ fontSize: 70, color: "#9e9e9e" }} />
                  </Box>
                )}

                <CardContent sx={{ p: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024).toFixed(1)} KB
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Paper>

        {/* 등록 버튼 */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button variant="contained" size="large" onClick={handleSubmit}>
            {boardId ? "수정 완료" : "등록"}
          </Button>
        </Box>

        {/* 미리보기 모달 */}
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
            <Typography variant="h6" sx={{ mb: 2 }}>
              {previewFile?.name || "파일 미리보기"}
            </Typography>

            {previewFile && isImage(previewFile.name) ? (
              <img
                src={
                  previewFile.type === "existing"
                    ? previewFile.url
                    : URL.createObjectURL(previewFile.file)
                }
                alt="preview"
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

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  if (!previewFile) return;
                  const link = document.createElement("a");
                  link.href =
                    previewFile.type === "existing"
                      ? previewFile.url
                      : URL.createObjectURL(previewFile.file);
                  link.download = previewFile.name;
                  link.click();
                }}
              >
                다운로드
              </Button>
            </Box>
          </Box>
        </Modal>
      </Box>
    </Box>
  );
};

export default BoardWritePage;
