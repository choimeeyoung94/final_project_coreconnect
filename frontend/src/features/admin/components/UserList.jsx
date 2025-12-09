import React, { useEffect, useState } from "react";
import { getAdminUsers } from "../../user/api/userAPI";
import { updateUser } from "../api/adminAPI";
import { fetchDepartmentsFlat } from "../api/departmentAPI";
import { getJobGradeLabel, getStatusLabel, getRoleLabel } from "../../../utils/labelUtils";
import http from "../../../api/http";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Typography,
  Chip,
  CircularProgress,
  Stack,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";

export default function UserList() {
  const { showSnack } = useSnackbarContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [jobGrades, setJobGrades] = useState([]);
  const [saving, setSaving] = useState(false);

  // 사용자 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminUsers();
        setUsers(data);
      } catch (e) {
        console.error("사용자 목록 조회 실패:", e);
        showSnack("사용자 목록을 불러오지 못했습니다.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 부서 목록 로드
  useEffect(() => {
    fetchDepartmentsFlat()
      .then((data) => setDepartments(data))
      .catch(() => {
        showSnack("부서 목록을 불러오지 못했습니다.", "warning");
      });
  }, [showSnack]);

  // Role 목록 로드
  useEffect(() => {
    http
      .get("/admin/users/roles")
      .then(({ data }) => setRoles(data))
      .catch(() => {
        showSnack("권한 목록을 불러오지 못했습니다.", "warning");
      });
  }, [showSnack]);

  // JobGrade 목록 로드
  useEffect(() => {
    http
      .get("/admin/users/job-grades")
      .then(({ data }) => setJobGrades(data))
      .catch(() => {
        showSnack("직급 목록을 불러오지 못했습니다.", "warning");
      });
  }, [showSnack]);

  // 수정 모드 시작
  const handleEdit = (user) => {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      deptId: user.deptId || "",
      role: user.role || "",
      status: user.status || "",
      jobGrade: user.jobGrade || "",
    });
  };

  // 수정 취소
  const handleCancel = () => {
    setEditingUserId(null);
    setEditForm({});
  };

  // 폼 필드 변경
  const handleFormChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  // 저장
  const handleSave = async (userId) => {
    setSaving(true);
    try {
      const updatedUser = await updateUser(userId, editForm);
      // 사용자 목록 업데이트
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? updatedUser : u))
      );
      setEditingUserId(null);
      setEditForm({});
      showSnack("사용자 정보가 수정되었습니다.", "success");
    } catch (e) {
      console.error("사용자 정보 수정 실패:", e);
      showSnack("사용자 정보 수정에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  // 역할별 색상
  const roleColor = (role) => {
    switch (role) {
      case "ADMIN":
        return "secondary";
      case "MANAGER":
        return "primary";
      default:
        return "default";
    }
  };

  // 상태별 색상
  const statusColor = (status) => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "INACTIVE":
        return "error";
      default:
        return "default";
    }
  };

  // 전화번호 포맷팅 함수 (숫자만 받아서 하이픈 추가 - UI 표시용)
  const formatPhoneNumber = (phone) => {
    if (!phone) return "-";
    // 숫자만 추출
    const numbers = phone.replace(/\D/g, "");
    
    if (numbers.length === 0) return "-";
    
    // 길이에 따라 하이픈 추가
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      // 010-1234
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 10) {
      // 02-1234-5678 또는 031-123-4567
      if (numbers.startsWith("02")) {
        return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
      } else {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
      }
    } else {
      // 010-1234-5678 (11자리)
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", mx: "auto", mt: 4, px: 2 }}>
      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardHeader
          title={
            <Typography variant="h5" fontWeight={600}>
              사용자 목록
            </Typography>
          }
          subheader="등록된 사용자 정보를 확인하고 수정합니다."
        />
        <Divider />

        <CardContent sx={{ pt: 3, pb: 3 }}>
          <Stack spacing={2.5}>
            {loading ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  py: 6,
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer
                sx={{
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  width: "100%",
                }}
              >
                <Table stickyHeader size="medium" sx={{ width: "100%" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>이름</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>이메일</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>전화번호</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>역할(권한)</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>상태</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>직급</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>부서</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            등록된 사용자가 없습니다.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => (
                        <React.Fragment key={u.id}>
                          {/* 원본 행 */}
                          <TableRow
                            hover
                            sx={{
                              cursor: "pointer",
                              backgroundColor:
                                editingUserId === u.id
                                  ? "action.selected"
                                  : "transparent",
                              "&:last-child td, &:last-child th": {
                                borderBottom: 0,
                              },
                            }}
                            onClick={() => {
                              if (editingUserId === u.id) {
                                // 이미 편집 중이면 취소
                                handleCancel();
                              } else {
                                // 편집 모드 시작
                                handleEdit(u);
                              }
                            }}
                          >
                            <TableCell sx={{ py: 1.5 }}>{u.id}</TableCell>
                            <TableCell sx={{ py: 1.5, whiteSpace: "nowrap" }}>{u.name}</TableCell>
                            <TableCell sx={{ py: 1.5 }}>{u.email}</TableCell>
                            <TableCell sx={{ py: 1.5, whiteSpace: "nowrap" }}>
                              {formatPhoneNumber(u.phone)}
                            </TableCell>
                            {/* 역할 */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip
                                label={getRoleLabel(u.role)}
                                size="small"
                                color={roleColor(u.role)}
                                sx={{
                                  fontWeight: 600,
                                  color:
                                    u.role === "USER"
                                      ? "text.primary"
                                      : "white",
                                }}
                              />
                            </TableCell>
                            {/* 상태 */}
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip
                                label={getStatusLabel(u.status)}
                                size="small"
                                color={statusColor(u.status)}
                                sx={{
                                  fontWeight: 600,
                                  color: "white",
                                }}
                              />
                            </TableCell>
                            {/* 직급 - 한글 변환 */}
                            <TableCell sx={{ py: 1.5, whiteSpace: "nowrap" }}>
                              {u.jobGrade ? getJobGradeLabel(u.jobGrade) : "-"}
                            </TableCell>
                            {/* 부서 */}
                            <TableCell sx={{ py: 1.5, whiteSpace: "nowrap" }}>{u.deptName}</TableCell>
                          </TableRow>

                          {/* 수정 폼 행 */}
                          {editingUserId === u.id && (
                            <TableRow
                              sx={{
                                backgroundColor: "action.hover",
                                "& td": {
                                  borderTop: "2px solid",
                                  borderColor: "primary.main",
                                },
                              }}
                            >
                              <TableCell colSpan={8} sx={{ py: 3 }}>
                                <Box
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 2,
                                    px: 2,
                                  }}
                                >
                                  {/* 이름 */}
                                  <TextField
                                    label="이름"
                                    value={editForm.name || ""}
                                    onChange={(e) =>
                                      handleFormChange("name", e.target.value)
                                    }
                                    size="small"
                                    fullWidth
                                  />

                                  {/* 이메일 */}
                                  <TextField
                                    label="이메일"
                                    type="email"
                                    value={editForm.email || ""}
                                    onChange={(e) =>
                                      handleFormChange("email", e.target.value)
                                    }
                                    size="small"
                                    fullWidth
                                  />

                                  {/* 전화번호 */}
                                  <TextField
                                    label="전화번호"
                                    value={editForm.phone || ""}
                                    onChange={(e) =>
                                      handleFormChange("phone", e.target.value)
                                    }
                                    size="small"
                                    fullWidth
                                  />

                                  {/* 역할 */}
                                  <FormControl size="small" fullWidth>
                                    <InputLabel>역할</InputLabel>
                                    <Select
                                      value={editForm.role || ""}
                                      label="역할"
                                      onChange={(e) =>
                                        handleFormChange("role", e.target.value)
                                      }
                                    >
                                      {roles.map((role) => (
                                        <MenuItem key={role} value={role}>
                                          {getRoleLabel(role)}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>

                                  {/* 상태 */}
                                  <FormControl size="small" fullWidth>
                                    <InputLabel>상태</InputLabel>
                                    <Select
                                      value={editForm.status || ""}
                                      label="상태"
                                      onChange={(e) =>
                                        handleFormChange("status", e.target.value)
                                      }
                                    >
                                      <MenuItem value="ACTIVE">{getStatusLabel("ACTIVE")}</MenuItem>
                                      <MenuItem value="INACTIVE">
                                        {getStatusLabel("INACTIVE")}
                                      </MenuItem>
                                    </Select>
                                  </FormControl>

                                  {/* 직급 */}
                                  <FormControl size="small" fullWidth>
                                    <InputLabel>직급</InputLabel>
                                    <Select
                                      value={editForm.jobGrade || ""}
                                      label="직급"
                                      onChange={(e) =>
                                        handleFormChange(
                                          "jobGrade",
                                          e.target.value
                                        )
                                      }
                                    >
                                      {jobGrades.map((jg) => (
                                        <MenuItem
                                          key={jg.value}
                                          value={jg.value}
                                        >
                                          {getJobGradeLabel(jg.value)}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>

                                  {/* 부서 */}
                                  <FormControl size="small" fullWidth>
                                    <InputLabel>부서</InputLabel>
                                    <Select
                                      value={editForm.deptId || ""}
                                      label="부서"
                                      onChange={(e) =>
                                        handleFormChange("deptId", e.target.value)
                                      }
                                    >
                                      <MenuItem value="">부서 없음</MenuItem>
                                      {departments.map((dept) => (
                                        <MenuItem key={dept.id} value={dept.id}>
                                          {dept.name}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Box>
                                {/* 저장/취소 버튼 */}
                                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2, px: 2 }}>
                                  <Button
                                    variant="outlined"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSave(u.id);
                                    }}
                                    disabled={saving}
                                    sx={{
                                      border: "1px solid",
                                      borderColor: "divider",
                                      color: "text.primary",
                                      "&:hover": {
                                        borderColor: "text.primary",
                                        backgroundColor: "transparent",
                                      },
                                    }}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancel();
                                    }}
                                    disabled={saving}
                                    sx={{
                                      border: "1px solid",
                                      borderColor: "divider",
                                      color: "text.primary",
                                      "&:hover": {
                                        borderColor: "text.primary",
                                        backgroundColor: "transparent",
                                      },
                                    }}
                                  >
                                    취소
                                  </Button>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
