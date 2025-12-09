import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  TextField,
  Button,
  Paper,
  Tooltip,
  Divider,
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../api/boardCategoryAPI";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";

const AdminCategoryPage = () => {
  const { showSnack } = useSnackbarContext(); // 스낵바 훅 사용

  // 상태 관리
  const [categories, setCategories] = useState([]); // 전체 카테고리 목록을 저장하는 상태
  const [editingId, setEditingId] = useState(null); // 현재 수정 중인 카테고리의 id (수정 모드 판별용)
  const [editedData, setEditedData] = useState({ name: "", orderNo: "" }); // 수정 중 입력값 저장
  const [newCategory, setNewCategory] = useState({ name: "", orderNo: "" }); // 신규 등록용 입력값 저장
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const confirmMessage = "이 카테고리를 삭제하시겠습니까?";
  const [loading, setLoading] = useState(true); // 로딩 상태

  // 전체 카테고리 불러오기 (비동기 함수)
  const loadCategories = async () => {
    try {
      setLoading(true); // 로딩 시작
      const res = await getAllCategories(); // 백엔드 API로 전체 카테고리 목록 요청
      // 받아온 목록을 orderNo(정렬순서) 기준으로 오름차순 정렬
      const sorted = [...(res.data.data || [])].sort(
        (a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0)
      );
      setCategories(sorted); // 정렬된 목록을 상태에 반영
    } catch (err) {
      showSnack("카테고리 목록을 불러오는 중 오류가 발생했습니다.", "error");
    } finally {
      setLoading(false); // 로딩 종료
    }
  };

  // 컴포넌트 최초 마운트 시 전체 카테고리 목록 불러오기
  useEffect(() => {
    loadCategories(); // 페이지 로딩 시 1회 실행
  }, []);

  // 수정 버튼 클릭 시 동작
  const handleEdit = (cat) => {
    setEditingId(cat.id); // 수정 모드로 전환 (해당 행만 수정 가능)
    setEditedData({ name: cat.name, orderNo: cat.orderNo }); // 기존 데이터 입력창에 채워넣기
  };

  // 저장 버튼 클릭 시 동작 → 수정 내용 백엔드 반영
  const handleSave = async (id) => {
    try {
      await updateCategory(id, editedData); // 수정 API 요청
      showSnack("카테고리가 수정되었습니다.", "success");
      localStorage.setItem("categoryRefresh", Date.now());
      setEditingId(null); // 수정 모드 종료
      loadCategories(); // 목록 새로 불러오기
    } catch (err) {
      showSnack("카테고리 수정 중 오류가 발생했습니다.", "error");
    }
  };

  // 삭제 버튼 클릭 시 → 확인창 오픈
  const handleOpenDeleteConfirm = (id) => {
    setTargetId(id);
    setConfirmOpen(true);
  };

  // 확인창에서 "확인" 클릭 시
  const handleConfirm = async () => {
    setConfirmOpen(false);
    if (targetId) {
      await handleDelete(targetId);
    }
    setTargetId(null);
  };

  // 확인창에서 "취소"
  const handleCancel = () => {
    setConfirmOpen(false);
    setTargetId(null);
  };

  // 삭제 버튼 클릭 시 동작
  const handleDelete = async (id) => {
    showSnack("카테고리를 삭제 중입니다...", "info"); // 사용자 확인창 표시
    try {
      await deleteCategory(id); // 삭제 API 요청
      showSnack("카테고리가 삭제되었습니다.", "success");
      localStorage.setItem("categoryRefresh", Date.now());
      loadCategories(); // 목록 새로 불러오기
    } catch (err) {
      showSnack("카테고리 삭제 중 오류가 발생했습니다.", "error");
    }
  };

  // 등록 버튼 클릭 시 동작 → 신규 카테고리 생성
  const handleCreate = async () => {
    if (!newCategory.name.trim()) {
      showSnack("카테고리명을 입력해주세요.", "error");
      return;
    }

    try {
      await createCategory(newCategory); // 등록 API 요청
      showSnack("새 카테고리가 등록되었습니다.", "success");
      localStorage.setItem("categoryRefresh", Date.now());
      setNewCategory({ name: "", orderNo: "" }); // 입력창 초기화
      loadCategories(); // 목록 새로고침
    } catch (err) {
      showSnack("카테고리 순서번호가 이미 존재합니다.", "error");
    }
  };

  // 로딩 중 화면
  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>카테고리를 불러오는 중...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        bgcolor: "#f4f6fb",
        minHeight: "100vh",
      }}
    >
      <Paper
        elevation={2}
        sx={{
          width: "90%",
          maxWidth: 1200,
          mx: "auto",
          p: 3,
          borderRadius: 2,
          bgcolor: "#ffffff",
        }}
      >
        {/* 페이지 제목 영역 */}
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          카테고리 관리 (관리자 전용)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          게시판 카테고리명과 노출 순서를 한눈에 관리할 수 있는 페이지입니다.
        </Typography>

        {/* 신규 카테고리 등록 영역 */}
        <Paper
          variant="outlined"
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: "#fafafa", // 입력 영역을 박스로 분리
          }}
        >
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            새 카테고리 등록
          </Typography>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {/* 카테고리명 입력 필드 */}
            <TextField
              label="카테고리명"
              size="small"
              value={newCategory.name}
              inputProps={{ maxLength: 20 }}
              onChange={(e) => {
                let val = e.target.value;
                if (val.length > 20) val = val.slice(0, 20); // 20자 초과 자동 자름
                setNewCategory((prev) => ({
                  ...prev,
                  name: val,
                }));
              }}
              sx={{ minWidth: 220 }}
            />

            <Box
              sx={{
                fontSize: "0.75rem",
                color: newCategory.name.length >= 20 ? "red" : "gray",
                ml: 1,
              }}
            >
              {newCategory.name.length}/20
            </Box>
            {/* 순서번호 입력 필드 */}
            <TextField
              label="순서번호"
              size="small"
              type="number"
              inputProps={{ min: 0 }}
              value={newCategory.orderNo}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, orderNo: e.target.value }))
              }
              sx={{ width: 120 }}
            />
            {/* 등록 버튼 */}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              등록
            </Button>
          </Box>
        </Paper>

        <Divider sx={{ mb: 2 }} />

        {/* 카테고리 목록 테이블 */}
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: "hidden", // 둥근 모서리에 맞게 테이블 잘림
          }}
        >
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: "#f0f4ff", // 헤더 배경색
                }}
              >
                <TableCell sx={{ fontWeight: 700 }}>카테고리명</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>순서번호</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">
                  수정 / 삭제
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map((cat) => (
                <TableRow
                  key={cat.id}
                  sx={{
                    "&:hover": {
                      bgcolor: "#fafafa", // 행 hover 효과
                    },
                  }}
                >
                  <TableCell>
                    {editingId === cat.id ? (
                      <TextField
                        size="small"
                        value={editedData.name}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        sx={{ maxWidth: 260 }}
                      />
                    ) : (
                      cat.name
                    )}
                  </TableCell>

                  <TableCell>
                    {editingId === cat.id ? (
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={editedData.orderNo}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            orderNo: e.target.value,
                          }))
                        }
                        sx={{ width: 120 }}
                      />
                    ) : (
                      cat.orderNo
                    )}
                  </TableCell>

                  {/* 액션 버튼 (수정 / 저장 / 삭제) */}
                  <TableCell align="center">
                    {editingId === cat.id ? (
                      <Tooltip title="저장">
                        <IconButton
                          color="primary"
                          onClick={() => handleSave(cat.id)}
                          sx={{
                            "&:hover": { transform: "scale(1.05)" }, // 호버 시 살짝 확대
                          }}
                        >
                          <SaveIcon />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="수정">
                        <IconButton
                          color="secondary"
                          onClick={() => handleEdit(cat)}
                          sx={{
                            "&:hover": { transform: "scale(1.05)" },
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    )}

                    <Tooltip title="삭제">
                      <IconButton
                        color="error"
                        onClick={() => handleOpenDeleteConfirm(cat.id)}
                        sx={{
                          "&:hover": {
                            transform: "scale(1.05)",
                          },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* 삭제 확인창 */}
        <ConfirmDialog
          open={confirmOpen}
          title="삭제 확인"
          message={confirmMessage}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </Paper>
    </Box>
  );
};

export default AdminCategoryPage;
