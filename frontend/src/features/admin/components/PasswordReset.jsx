import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import StyledButton from "../../../components/ui/StyledButton";

import {
  getPasswordResetRequests,
  approvePasswordResetRequest,
  rejectPasswordResetRequest
} from "../api/adminAPI";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";

export default function PasswordReset() {
  const { showSnack } = useSnackbarContext();
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING"); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null); // 진행 중인 행 ID
  
  // 승인 확인 Dialog
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveDialogId, setApproveDialogId] = useState(null);
  const [approveProcessing, setApproveProcessing] = useState(false);
  
  // 거절 사유 입력 Dialog
  const [rejectReasonDialogOpen, setRejectReasonDialogOpen] = useState(false);
  const [rejectReasonDialogId, setRejectReasonDialogId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  
  // 거절 확인 Dialog
  const [rejectConfirmDialogOpen, setRejectConfirmDialogOpen] = useState(false);
  const [rejectConfirmId, setRejectConfirmId] = useState(null);
  const [rejectConfirmReason, setRejectConfirmReason] = useState("");
  const [rejectProcessing, setRejectProcessing] = useState(false);


  const loadRequests = async (status) => {
    setLoading(true);
    setError("");
    try {
      const data = await getPasswordResetRequests(status);
      setRequests(data);
    } catch (e) {
      console.error("비밀번호 초기화 요청 목록 불러오기 실패:", e);
      setError("요청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests(statusFilter);
  }, [statusFilter]);

  const handleApproveClick = (id) => {
    setApproveDialogId(id);
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    const id = approveDialogId;
    setApproveProcessing(true);
    
    try {
      setActioningId(id);
      const response = await approvePasswordResetRequest(id);
      setApproveDialogOpen(false);
      const externalEmail = response?.externalEmail || response?.data?.externalEmail;
      showSnack(`승인되었습니다. 임시 비밀번호가 외부 이메일(${externalEmail})로 발송되었습니다.`, "success");
      loadRequests(statusFilter); // 현재 필터 기준으로 목록 새로 불러오기
    } catch (e) {
      console.error("승인 실패:", e);
      // 백엔드에서 보낸 에러 메시지 표시
      const errorMessage = e.response?.data?.message || 
                          e.response?.data || 
                          e.message || 
                          "승인 처리 중 오류가 발생했습니다.";
      showSnack(errorMessage, "error");
    } finally {
      setApproveProcessing(false);
      setActioningId(null);
      setApproveDialogId(null);
    }
  };

  const handleRejectClick = (id) => {
    setRejectReasonDialogId(id);
    setRejectReason("");
    setRejectReasonDialogOpen(true);
  };

  const handleRejectReasonSubmit = () => {
    if (!rejectReason.trim()) {
      showSnack("거절 사유를 입력해야 합니다.", "warning");
      return;
    }
    setRejectConfirmId(rejectReasonDialogId);
    setRejectConfirmReason(rejectReason.trim());
    setRejectReasonDialogOpen(false);
    setRejectConfirmDialogOpen(true);
  };

  const handleReject = async () => {
    const id = rejectConfirmId;
    const reason = rejectConfirmReason;
    setRejectProcessing(true);

    try {
      setActioningId(id);
      await rejectPasswordResetRequest(id, reason);
      setRejectConfirmDialogOpen(false);
      showSnack("요청이 거절되었습니다.", "success");
      loadRequests(statusFilter); 
    } catch (e) {
      console.error("거절 실패:", e);
      showSnack("거절 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setRejectProcessing(false);
      setActioningId(null);
      setRejectConfirmId(null);
      setRejectConfirmReason("");
    }
  };

  const renderStatusChip = (status) => {
    switch (status) {
      case "PENDING":
        return <Chip label="대기" color="warning" size="small" />;
      case "APPROVED":
        return <Chip label="승인" color="success" size="small" />;
      case "REJECTED":
        return <Chip label="거절" color="error" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        width: "100%",
        maxWidth: 1400,
        mx: "auto",
      }}
    >
      {/* 헤더 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LockResetIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h5" fontWeight={700}>
            비밀번호 초기화 요청 관리
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          사용자가 요청한 비밀번호 초기화 내역을 조회하고 승인/거절할 수 있습니다.
        </Typography>
      </Box>

      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          {/* 필터 + 상태 */}
          <Box
            sx={{
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={1}>
              <StyledButton
                size="small"
                variant={statusFilter === "PENDING" ? "contained" : "outlined"}
                onClick={() => setStatusFilter("PENDING")}
                fullWidth={false}
              >
                대기
              </StyledButton>
              <StyledButton
                size="small"
                variant={statusFilter === "APPROVED" ? "contained" : "outlined"}
                onClick={() => setStatusFilter("APPROVED")}
                fullWidth={false}
              >
                승인
              </StyledButton>
              <StyledButton
                size="small"
                variant={statusFilter === "REJECTED" ? "contained" : "outlined"}
                onClick={() => setStatusFilter("REJECTED")}
                fullWidth={false}
              >
                거절
              </StyledButton>
              <StyledButton
                size="small"
                variant={statusFilter === "ALL" ? "contained" : "outlined"}
                onClick={() => setStatusFilter("ALL")}
                fullWidth={false}
              >
                전체
              </StyledButton>
            </Stack>

            {loading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  불러오는 중...
                </Typography>
              </Stack>
            )}
          </Box>

          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 1.5 }}>
              {error}
            </Typography>
          )}

          {/* 테이블 */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">ID</TableCell>
                <TableCell>사용자</TableCell>
                <TableCell>사유</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell>요청일시</TableCell>
                <TableCell>처리일시</TableCell>
                <TableCell>거절 사유</TableCell>
                <TableCell align="center">액션</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      표시할 비밀번호 초기화 요청이 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {requests.map((req) => (
                <TableRow key={req.id} hover>
                  <TableCell align="center">{req.id}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                      <Typography variant="body2">{req.userName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {req.userEmail}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={req.reason || ""}
                    >
                      {req.reason || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{renderStatusChip(req.status)}</TableCell>
                  <TableCell>
                    {req.createdAt
                      ? req.createdAt.replace("T", " ").slice(0, 16)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {req.processedAt
                      ? req.processedAt.replace("T", " ").slice(0, 16)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: req.status === "REJECTED" ? "error.main" : "text.primary",
                      }}
                      title={req.rejectReason || ""}
                    >
                      {req.rejectReason || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {req.status === "PENDING" ? (
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <StyledButton
                        size="small"
                        variant="outlined"
                        color="success"
                        disabled={actioningId === req.id}
                        onClick={() => handleApproveClick(req.id)}
                        fullWidth={false}
                      >
                        승인
                      </StyledButton>
                      <StyledButton
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={actioningId === req.id}
                        onClick={() => handleRejectClick(req.id)}
                        fullWidth={false}
                      >
                        거절
                      </StyledButton>
                    </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        처리완료
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 승인 확인 Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={approveProcessing ? undefined : () => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>비밀번호 초기화 요청 승인</DialogTitle>
        <DialogContent>
          {approveProcessing ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 3 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                승인 처리 중입니다...
              </Typography>
            </Box>
          ) : (
            <>
              <Typography>
                이 비밀번호 초기화 요청을 승인하시겠습니까?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                임시 비밀번호가 해당 사용자 이메일로 발송됩니다.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setApproveDialogOpen(false)} 
            disabled={approveProcessing}
          >
            취소
          </Button>
          <Button 
            onClick={handleApprove} 
            variant="contained" 
            color="success"
            disabled={approveProcessing}
            startIcon={approveProcessing ? <CircularProgress size={16} /> : null}
          >
            승인
          </Button>
        </DialogActions>
      </Dialog>

      {/* 거절 사유 입력 Dialog */}
      <Dialog
        open={rejectReasonDialogOpen}
        onClose={() => setRejectReasonDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>거절 사유 입력</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="거절 사유"
            fullWidth
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="거절 사유를 입력해주세요"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectReasonDialogOpen(false)}>취소</Button>
          <Button onClick={handleRejectReasonSubmit} variant="contained" color="error">
            다음
          </Button>
        </DialogActions>
      </Dialog>

      {/* 거절 확인 Dialog */}
      <Dialog
        open={rejectConfirmDialogOpen}
        onClose={rejectProcessing ? undefined : () => setRejectConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>거절 확인</DialogTitle>
        <DialogContent>
          {rejectProcessing ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 3 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                거절 처리 중입니다...
              </Typography>
            </Box>
          ) : (
            <>
              <Typography>
                정말 이 비밀번호 초기화 요청을 거절하시겠습니까?
              </Typography>
              {rejectConfirmReason && (
                <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    거절 사유:
                  </Typography>
                  <Typography variant="body2">
                    {rejectConfirmReason}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRejectConfirmDialogOpen(false)} 
            disabled={rejectProcessing}
          >
            취소
          </Button>
          <Button 
            onClick={handleReject} 
            variant="contained" 
            color="error"
            disabled={rejectProcessing}
            startIcon={rejectProcessing ? <CircularProgress size={16} /> : null}
          >
            거절
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
