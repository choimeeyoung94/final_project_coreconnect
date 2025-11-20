import React, { useEffect, useState, useContext } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Checkbox, Chip, Pagination, CircularProgress
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { UserProfileContext } from "../../../App";

const MailFavoritePage = () => {
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);
  const [mails, setMails] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const { userProfile } = useContext(UserProfileContext) || {};
  const navigate = useNavigate();

  useEffect(() => {
    loadFavoriteMails();
  }, [page, size]);

  const loadFavoriteMails = async () => {
    setLoading(true);
    try {
      // TODO: API 연동 필요
      // const response = await fetchFavoriteMails(page - 1, size);
      setMails([]);
      setTotal(0);
    } catch (error) {
      console.error("중요 메일 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(new Set(mails.map(m => m.emailId)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectOne = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  const handleRowClick = (mailId) => {
    navigate(`/email/${mailId}`);
  };

  const totalPages = Math.ceil(total / size);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/email/inbox")}>
          받은메일함
        </Button>
        <Typography variant="h5" sx={{ ml: 2 }}>
          <StarIcon sx={{ color: "#ffc107", mr: 1, verticalAlign: "middle" }} />
          중요 메일
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : mails.length === 0 ? (
          <Typography sx={{ textAlign: "center", py: 4, color: "#999" }}>
            중요 표시된 메일이 없습니다.
          </Typography>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.size === mails.length && mails.length > 0}
                      indeterminate={selected.size > 0 && selected.size < mails.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>보낸사람</TableCell>
                  <TableCell>제목</TableCell>
                  <TableCell>받은날짜</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mails.map((mail) => (
                  <TableRow
                    key={mail.emailId}
                    hover
                    onClick={() => handleRowClick(mail.emailId)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(mail.emailId)}
                        onChange={() => handleSelectOne(mail.emailId)}
                      />
                    </TableCell>
                    <TableCell>{mail.senderEmail}</TableCell>
                    <TableCell>{mail.emailTitle}</TableCell>
                    <TableCell>{mail.emailSendDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, v) => setPage(v)}
                color="primary"
              />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default MailFavoritePage;
