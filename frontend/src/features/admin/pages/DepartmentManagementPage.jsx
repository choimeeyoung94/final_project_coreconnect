import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import StyledButton from "../../../components/ui/StyledButton";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";
import {
  fetchDepartmentsFlat,
  createDepartment,
  updateDepartment,
  moveDepartment,
  deleteDepartment,
  fetchDepartmentTree,
} from "../api/departmentAPI";

export default function DepartmentManagementPage() {
  const { showSnack } = useSnackbarContext();
  const [departments, setDepartments] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originParent, setOriginParent] = useState(null);
  const [form, setForm] = useState({ name: "", parentId: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const parentMap = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const treeData = await fetchDepartmentTree();
      const safeTree = treeData ?? [];
      setTree(safeTree);

      const flat = [];
      const flatten = (nodes, parentId = null) => {
        nodes.forEach((node) => {
          flat.push({
            id: node.id,
            name: node.name,
            orderNo: node.orderNo,
            parentId,
            userCount: node.userCount,
          });
          if (node.children?.length) {
            flatten(node.children, node.id);
          }
        });
      };
      flatten(safeTree);
      setDepartments(flat);
    } catch (err) {
      console.error("부서 목록 불러오기 실패:", err);
      showSnack("부서 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const resetForm = () => {
    setForm({ name: "", parentId: "" });
    setEditingId(null);
    setOriginParent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showSnack("부서 이름을 입력하세요.", "warning");
      return;
    }

    const payload = {
      name: form.name.trim(),
      orderNo: null, // 백엔드에서 자동 계산
      parentId: form.parentId === "" ? null : Number(form.parentId),
    };

    setSubmitting(true);

    try {
      if (editingId) {
        await updateDepartment(editingId, {
          name: payload.name,
          // orderNo는 화살표 버튼으로만 변경 가능
        });

        if (payload.parentId !== originParent) {
          await moveDepartment(editingId, payload.parentId);
        }

        showSnack("부서가 수정되었습니다.", "success");
      } else {
        await createDepartment(payload);
        showSnack("새 부서가 생성되었습니다.", "success");
      }

      resetForm();
      await loadDepartments();
    } catch (err) {
      console.error("부서 저장 실패:", err);
      const msg = err.response?.data?.message || err.response?.data || "부서를 저장하는 중 오류가 발생했습니다.";
      showSnack(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const applyEdit = (dept) => {
    setEditingId(dept.id);
    setOriginParent(dept.parentId ?? null);
    setForm({
      name: dept.name,
      parentId: dept.parentId ?? "",
    });
  };

  const handleEdit = (dept) => applyEdit(dept);

  const handleDeleteClick = (dept) => {
    setDeleteTarget(dept);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setDeleteConfirmOpen(false);
    setSubmitting(true);
    try {
      await deleteDepartment(deleteTarget.id);
      showSnack("부서가 삭제되었습니다.", "success");
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      await loadDepartments();
    } catch (err) {
      console.error("부서 삭제 실패:", err);
      const msg = err.response?.data?.message || err.response?.data || "부서를 삭제하는 중 오류가 발생했습니다.";
      showSnack(msg, "error");
    } finally {
      setSubmitting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  const availableParents = useMemo(() => {
    if (!editingId) return departments;
    return departments.filter((dept) => dept.id !== editingId);
  }, [departments, editingId]);

  // 같은 상위 부서 내에서 형제 부서들 찾기 (flat 배열 사용)
  const getSiblingDepartments = (parentId) => {
    return departments
      .filter((dept) => {
        const deptParentId = dept.parentId ?? null;
        return deptParentId === parentId;
      })
      .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0));
  };

  // 화살표 버튼 클릭: 위로 이동
  const handleMoveUp = async (nodeId, parentId) => {
    const siblings = getSiblingDepartments(parentId);
    const currentIndex = siblings.findIndex((s) => s.id === nodeId);
    
    if (currentIndex <= 0) return; // 이미 맨 위
    
    const currentNode = siblings[currentIndex];
    const prevNode = siblings[currentIndex - 1];
    const currentOrderNo = currentNode.orderNo ?? 0;
    const prevOrderNo = prevNode.orderNo ?? 0;
    
    setSubmitting(true);
    try {
      // 두 부서의 orderNo 교환
      await updateDepartment(nodeId, { name: null, orderNo: prevOrderNo });
      await updateDepartment(prevNode.id, { name: null, orderNo: currentOrderNo });
      await loadDepartments();
      showSnack("순서가 변경되었습니다.", "success");
    } catch (err) {
      console.error("순서 변경 실패:", err);
      const errorMsg = err.response?.data?.message || err.response?.data || "순서를 변경하는 중 오류가 발생했습니다.";
      showSnack(errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // 화살표 버튼 클릭: 아래로 이동
  const handleMoveDown = async (nodeId, parentId) => {
    const siblings = getSiblingDepartments(parentId);
    const currentIndex = siblings.findIndex((s) => s.id === nodeId);
    
    if (currentIndex < 0 || currentIndex >= siblings.length - 1) return; // 이미 맨 아래
    
    const currentNode = siblings[currentIndex];
    const nextNode = siblings[currentIndex + 1];
    const currentOrderNo = currentNode.orderNo ?? 0;
    const nextOrderNo = nextNode.orderNo ?? 0;
    
    setSubmitting(true);
    try {
      // 두 부서의 orderNo 교환
      await updateDepartment(nodeId, { name: null, orderNo: nextOrderNo });
      await updateDepartment(nextNode.id, { name: null, orderNo: currentOrderNo });
      await loadDepartments();
      showSnack("순서가 변경되었습니다.", "success");
    } catch (err) {
      console.error("순서 변경 실패:", err);
      const errorMsg = err.response?.data?.message || err.response?.data || "순서를 변경하는 중 오류가 발생했습니다.";
      showSnack(errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTree = (nodes, depth = 0, parentId = null) => {
    // 같은 상위 부서 내에서 정렬된 형제 부서들
    const siblings = [...nodes].sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0));
    
    // 형제 부서들 중에서 현재 위치 확인 (flat 배열 기준)
    const flatSiblings = getSiblingDepartments(parentId);
    
    return siblings.map((node) => {
      const currentIndex = flatSiblings.findIndex((s) => s.id === node.id);
      const isFirst = currentIndex === 0;
      const isLast = currentIndex === flatSiblings.length - 1;
      
      return (
        <Box key={node.id} sx={{ pl: depth * 3, py: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {node.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                구성원 {node.userCount ?? 0}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              <IconButton
                size="small"
                disabled={isFirst || submitting}
                onClick={() => handleMoveUp(node.id, parentId)}
                title="위로 이동"
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={isLast || submitting}
                onClick={() => handleMoveDown(node.id, parentId)}
                title="아래로 이동"
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() =>
                  applyEdit({
                    id: node.id,
                    name: node.name,
                    parentId,
                    userCount: node.userCount,
                  })
                }
                title="수정"
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() =>
                  handleDeleteClick({
                    id: node.id,
                    name: node.name,
                  })
                }
                title="삭제"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
          {node.children?.length ? renderTree(node.children, depth + 1, node.id) : null}
        </Box>
      );
    });
  };

  return (
    <Box sx={{ px: 4, py: 3, width: "100%", maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
            부서 관리
          </Typography>
          <Typography variant="body2" color="text.secondary">
            부서를 생성하고 수정하거나 삭제할 수 있습니다.
          </Typography>
        </Box>
        <IconButton onClick={loadDepartments} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
            <CardContent component="form" onSubmit={handleSubmit}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                {editingId ? "부서 수정" : "새 부서 추가"}
              </Typography>
              <Stack spacing={2.2}>
                <TextField
                  label="부서 이름"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 경영지원팀"
                  fullWidth
                />
                <TextField
                  select
                  label="상위 부서"
                  value={form.parentId}
                  onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}
                  helperText="최상위 부서는 비워 두세요"
                >
                  <MenuItem value="">(최상위 부서)</MenuItem>
                  {availableParents.map((dept) => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                <StyledButton
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  disabled={submitting}
                  fullWidth={false}
                  sx={{ color: "primary.main" }}
                >
                  {editingId ? "수정 저장" : "부서 생성"}
                </StyledButton>
                {editingId && (
                  <StyledButton variant="text" onClick={resetForm} disabled={submitting} fullWidth={false}>
                    취소
                  </StyledButton>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 10px 24px rgba(15,23,42,0.05)" }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                부서 트리 ({departments.length}개)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {loading ? (
                <Typography variant="body2" color="text.secondary">
                  부서 정보를 불러오는 중...
                </Typography>
              ) : tree.length > 0 ? (
                <Box>{renderTree(tree)}</Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  등록된 부서가 없습니다.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="부서 삭제 확인"
        message={`부서 "${deleteTarget?.name}" 을(를) 삭제하시겠습니까?\n하위 부서가 있는 경우 삭제할 수 없습니다.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
}
