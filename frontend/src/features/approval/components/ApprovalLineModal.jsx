import React, { useState, useEffect } from "react";
import { getOrganizationChart } from "../../user/api/userAPI";
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Modal,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { getJobGradeDisplay } from "../../../utils/labelUtils";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90%",
  maxWidth: 1200,
  height: "85vh",
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
  display: "flex",
  flexDirection: "column",
  borderRadius: 2,
};

function ApprovalLineModal({
  open,
  handleClose,
  currentLine,
  handleSubmitLine,
}) {
  const [organizationUsers, setOrganizationUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [groupedUsers, setGroupedUsers] = useState({});
  
  // 3개의 독립된 State로 관리
  const [approvers, setApprovers] = useState([]); // 결재자
  const [agreers, setAgreers] = useState([]);     // 합의자
  const [referrers, setReferrers] = useState([]); // 참조자

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDepartments, setOpenDepartments] = useState({});

  const { showSnack } = useSnackbarContext();

  useEffect(() => {
    if (open) {
      const fetchOrgUsers = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await getOrganizationChart();
          setOrganizationUsers(res.data);
          setFilteredUsers(res.data);

          const groupedData = res.data.reduce((acc, user) => {
            const dept = user.deptName || "소속 없음";
            if (!acc[dept]) {
              acc[dept] = [];
            }
            acc[dept].push(user);
            return acc;
          }, {});
          setGroupedUsers(groupedData);

          // 부서 전체 펼치기
          const initialOpenState = Object.keys(groupedData).reduce((acc, dept) => {
            acc[dept] = true;
            return acc;
          }, {});
          setOpenDepartments(initialOpenState);
        } catch (error) {
          console.error("Error fetching organization chart:", error);
          setError("조직도 데이터를 불러오는 데 실패했습니다.");
        } finally {
          setLoading(false);
        }
      };
      fetchOrgUsers();
      setSearchTerm("");
      
      // [초기화] 기존 currentLine을 받아서 3개로 분리
      if (currentLine && currentLine.length > 0) {
        setApprovers(currentLine.filter(l => l.type === 'APPROVE'));
        setAgreers(currentLine.filter(l => l.type === 'AGREE'));
        setReferrers(currentLine.filter(l => l.type === 'REFER'));
      } else {
        setApprovers([]);
        setAgreers([]);
        setReferrers([]);
      }
      
    }
  }, [open, currentLine]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = organizationUsers.filter((user) => {
      const nameMatch =
        user.name && user.name.toLowerCase().includes(lowerSearchTerm);
      const deptMatch =
        user.deptName && user.deptName.toLowerCase().includes(lowerSearchTerm);
      return nameMatch || deptMatch;
    });
    setFilteredUsers(filtered);
  }, [searchTerm, organizationUsers]);

  const handleToggleDepartment = (deptName) => {
    setOpenDepartments((prevOpen) => ({
      ...prevOpen,
      [deptName]: !prevOpen[deptName],
    }));
  };

  // 통합 체크: 이미 어딘가에 포함되어 있는지 확인
  const isAlreadySelected = (userId) => {
    return (
      approvers.some(u => u.userId === userId) ||
      agreers.some(u => u.userId === userId) ||
      referrers.some(u => u.userId === userId)
    );
  };

  const handleAddUser = (user, type) => {
    if (isAlreadySelected(user.userId)) {
      showSnack("이미 결재선에 포함된 사용자입니다.");
      return;
    }
    
    const newUser = {
      userId: user.userId,
      name: user.name,
      deptName: user.deptName,
      positionName: user.positionName,
      type: type,
    };

    if (type === 'APPROVE') setApprovers([...approvers, newUser]);
    else if (type === 'AGREE') setAgreers([...agreers, newUser]);
    else if (type === 'REFER') setReferrers([...referrers, newUser]);
  };

  // [공통 함수] 리스트에서 삭제
  const handleRemove = (type, index) => {
    if (type === 'APPROVE') {
      const newArr = [...approvers];
      newArr.splice(index, 1);
      setApprovers(newArr);
    } else if (type === 'AGREE') {
      const newArr = [...agreers];
      newArr.splice(index, 1);
      setAgreers(newArr);
    } else {
      const newArr = [...referrers];
      newArr.splice(index, 1);
      setReferrers(newArr);
    }
  };

  // [공통 함수] 순서 이동
  const handleMove = (type, index, direction) => {
    let list = [];
    let setList = null;

    if (type === 'APPROVE') { list = [...approvers]; setList = setApprovers; }
    else if (type === 'AGREE') { list = [...agreers]; setList = setAgreers; }
    else { list = [...referrers]; setList = setReferrers; } // 참조도 순서 변경 가능하게 함

    if (direction === 'up') {
      if (index === 0) return;
      const [movedItem] = list.splice(index, 1);
      list.splice(index - 1, 0, movedItem);
    } else {
      if (index === list.length - 1) return;
      const [movedItem] = list.splice(index, 1);
      list.splice(index + 1, 0, movedItem);
    }
    setList(list);
  };

  // [최종 확인] 3개의 리스트를 합쳐서 부모에게 전달
  const handleConfirm = () => {
    // 순서: 합의자(먼저) -> 결재자(나중) -> 참조자(맨뒤)
    const finalLine = [...agreers, ...approvers, ...referrers];
    handleSubmitLine(finalLine);
    handleClose();
  };

  // --- 오른쪽 리스트 렌더링 헬퍼 컴포넌트 ---
  const RenderSection = ({ title, list, type, color }) => (
    <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden', borderTop: `3px solid ${color}` }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: color }}>
        {title} <Typography component="span" variant="caption" color="text.secondary">({list.length}명)</Typography>
      </Typography>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {list.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            선택된 사용자가 없습니다.
          </Typography>
        ) : (
          <List dense>
            {list.map((line, index) => (
              <ListItem key={line.userId} sx={{ borderBottom: '1px solid #eee', px: 0 }}>
                 <ListItemText
                    primary={`${line.name} ${getJobGradeDisplay(line.positionName)}`}
                    secondary={line.deptName}
                    primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 'medium', whiteSpace: 'nowrap' }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {/* 참조자는 순서가 중요하지 않다면 화살표 숨겨도 됨 (여기선 다 보여줌) */}
                    <IconButton size="small" onClick={() => handleMove(type, index, 'up')} disabled={index === 0}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleMove(type, index, 'down')} disabled={index === list.length - 1}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleRemove(type, index)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  );

  const renderUserItem = (user) => (
    <ListItem key={user.userId} disablePadding>
      <ListItemButton>
        <ListItemText
          primary={`${user.name} (${getJobGradeDisplay(user.positionName)})`}
          secondary={user.deptName}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); handleAddUser(user, "APPROVE"); }}>결재</Button>
          <Button variant="outlined" size="small" color="warning" onClick={(e) => { e.stopPropagation(); handleAddUser(user, "AGREE"); }}>합의</Button>
          <Button variant="outlined" size="small" color="inherit" onClick={(e) => { e.stopPropagation(); handleAddUser(user, "REFER"); }}>참조</Button>
        </Box>
      </ListItemButton>
    </ListItem>
  );

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={style}>
        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
          결재선 지정
        </Typography>
        
        <Grid container spacing={2} sx={{ flex: 1, overflow: "hidden" }}>
          {/* --- 1. 왼쪽: 조직도 (기존과 동일) --- */}
          <Grid item xs={3} sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
               <TextField
                fullWidth
                label="이름 또는 부서 검색"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 2 }}
              />
               {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}><CircularProgress /></Box>
              ) : error ? (
                <Typography variant="body2" color="error">{error}</Typography>
              ) : (
                <List disablePadding sx={{ overflowY: "auto", flex: 1 }}>
                  {searchTerm ? (
                    filteredUsers.map(renderUserItem)
                  ) : (
                    Object.keys(groupedUsers).sort().map((deptName) => {
                        const isOpen = !!openDepartments[deptName];
                        return (
                          <React.Fragment key={deptName}>
                            <ListItemButton onClick={() => handleToggleDepartment(deptName)} dense>
                              <ListItemText primary={deptName} primaryTypographyProps={{ fontWeight: "bold" }} />
                              {isOpen ? <ExpandLess /> : <ExpandMore />}
                            </ListItemButton>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <List component="div" disablePadding sx={{ pl: 2 }}>
                                {groupedUsers[deptName].map(renderUserItem)}
                              </List>
                            </Collapse>
                          </React.Fragment>
                        );
                      })
                  )}
                </List>
              )}
            </Paper>
          </Grid>

          {/* --- 2. 오른쪽: 3단 분리된 결재선 --- */}
          <Grid item xs={9} sx={{ display: "flex", gap: 2, height: "100%" }}>
             {/* 합의 (합의->결재 순서 암시를 위해 왼쪽에 둠) */}
             <RenderSection title="1. 합의" list={agreers} type="AGREE" color="#ff9800" /> {/* 주황 */}
             
             {/* 결재 */}
             <RenderSection title="2. 결재" list={approvers} type="APPROVE" color="#2196f3" /> {/* 파랑 */}

             {/* 참조 */}
             <RenderSection title="참조" list={referrers} type="REFER" color="#9e9e9e" /> {/* 회색 */}
          </Grid>
        </Grid>

        {/* --- 3. 하단 버튼 --- */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button variant="outlined" onClick={handleClose}>취소</Button>
          <Button variant="contained" onClick={handleConfirm} disabled={approvers.length === 0 && agreers.length === 0 && referrers.length === 0}>
            적용하기
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default ApprovalLineModal;