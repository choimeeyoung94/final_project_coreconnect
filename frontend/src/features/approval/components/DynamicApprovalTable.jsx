import {
  Paper,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import React from "react";

import { getJobGradeLabel } from "../../../utils/labelUtils";
import Signature from "./Signature";

const DynamicApprovalTable = ({ approvers = [], drafter }) => {
  // 1. 데이터 분류 (참조 제외, 합의/결재 분리)
  const validLines = approvers.filter((line) => {
    const type = line.type || line.approvalType || line.approvalLineType;
    return type !== "REFER";
  });

  // 합의자 목록
  const agreeLines = validLines.filter((line) => {
    const type = line.type || line.approvalType || line.approvalLineType;
    return type === "AGREE";
  });

  // 결재자 목록
  const approveLines = validLines.filter((line) => {
    const type = line.type || line.approvalType || line.approvalLineType;
    return type === "APPROVE";
  });

  // 2. 셀 생성 헬퍼 함수 (합의, 결재 각각의 칸을 만들어줌)
  const renderCells = (lines) => {
    const posCells = [];
    const nameCells = [];
    const sigCells = [];

    if (lines.length > 0) {
      lines.forEach((line) => {
        let userId, positionName, name, approvalStatus;

        // 서버 데이터 vs 작성 중 데이터 구분
        if (line.approver) {
          userId = line.approver.userId;
          positionName = getJobGradeLabel(line.approver.positionName);
          name = line.approver.userName;
          approvalStatus = line.approvalLineStatus || line.approvalStatus;
        } else {
          userId = line.userId;
          // 조직도 API는 직급이 없으면 "N/A"를 보낸다. 결재란은 빈칸으로 둔다
          positionName = line.positionName === "N/A" ? "" : getJobGradeLabel(line.positionName);
          name = line.name;
          approvalStatus = line.approvalStatus || "";
        }

        // 직급 셀
        posCells.push(
          <TableCell key={`${userId}-pos`} sx={{ width: 70, backgroundColor: '#f2f2f2', textAlign: 'center' }}>
            {positionName}
          </TableCell>
        );

        // 이름 셀
        nameCells.push(
          <TableCell key={`${userId}-name`} sx={{ textAlign: 'center' }}>{name}</TableCell>
        );

        // 서명(도장) 셀
        // 타입 확인 (비동의 처리를 위해)
        const currentType = line.type || line.approvalType || line.approvalLineType;
        
        let sigContent = "";
        if (approvalStatus === "APPROVED") {
          sigContent = <Signature name={name} status="APPROVED" />;
        } else if (approvalStatus === "REJECTED") {
          // 합의자가 반려하면 '비동의', 결재자가 반려하면 '반려'
          const rejectText = currentType === 'AGREE' ? "비동의" : "반려";
          sigContent = <Signature name={name} status="REJECTED" customText={rejectText} />;
        }
        
        sigCells.push(
          <TableCell key={`${userId}-sig`} sx={{ height: "70px", verticalAlign: 'middle', textAlign: 'center' }}>
            {sigContent}
          </TableCell>
        );
      });
    } else {
      // 라인이 없을 경우 빈 칸 처리 (결재선 지정 전 등)
      // 합의는 없으면 아예 안 그리지만, 결재는 없어도 빈칸 하나는 보여주는 게 이쁨 (선택사항)
      if (lines === approveLines) { 
          posCells.push(<TableCell key="blank-pos" sx={{ width: 70, backgroundColor: '#f2f2f2' }}></TableCell>);
          nameCells.push(<TableCell key="blank-name"> </TableCell>);
          sigCells.push(<TableCell key="blank-sig" sx={{ height: "70px" }}></TableCell>);
      }
    }

    return { posCells, nameCells, sigCells };
  };

  // 3. 각 섹션별 셀 생성
  const agreeCells = renderCells(agreeLines);
  const approveCells = renderCells(approveLines);

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ width: "auto", maxWidth: "100%" }}
    >
      <Table
        size="small"
        sx={{
          borderCollapse: "collapse",
          "& td, & th": {
            border: "1px solid #ccc",
            textAlign: "center",
            p: 0,
            fontSize: "0.8rem",
          },
        }}
      >
        <TableHead>
          {/* 1행: 직급 (Position) */}
          <TableRow sx={{ backgroundColor: "#f9f9f9", height: "30px" }}>
            {/* --- [1] 신청란 --- */}
            <TableCell
              rowSpan={3}
              sx={{ width: 20, writingMode: "vertical-rl", backgroundColor: "#f2f2f2", textAlign: "center" }}
            >
              신청
            </TableCell>
            <TableCell sx={{ width: 70, backgroundColor: '#f2f2f2', textAlign: 'center' }}>
              {getJobGradeLabel(drafter?.positionName) || "기안자"}
            </TableCell>

            {/* --- [2] 합의란 (합의자가 있을 때만 표시) --- */}
            {agreeLines.length > 0 && (
              <>
                <TableCell
                  rowSpan={3}
                  sx={{ width: 20, writingMode: "vertical-rl", backgroundColor: "#f2f2f2", textAlign: "center" }}
                >
                  합의
                </TableCell>
                {agreeCells.posCells}
              </>
            )}

            {/* --- [3] 결재란 --- */}
            <TableCell
              rowSpan={3}
              sx={{ width: 20, writingMode: "vertical-rl", backgroundColor: "#f2f2f2", textAlign: "center" }}
            >
              결재
            </TableCell>
            {approveCells.posCells}
          </TableRow>

          {/* 2행: 이름 (Name) */}
          <TableRow sx={{ height: "30px" }}>
            {/* 신청자 이름 */}
            <TableCell sx={{ textAlign: 'center' }}>{drafter?.userName || drafter?.name}</TableCell>
            
            {/* 합의자 이름들 */}
            {agreeLines.length > 0 && agreeCells.nameCells}
            
            {/* 결재자 이름들 */}
            {approveCells.nameCells}
          </TableRow>

          {/* 3행: 서명 (Signature) */}
          <TableRow sx={{ height: "70px" }}>
            {/* 신청자 서명 (항상 승인) */}
            <TableCell sx={{ verticalAlign: 'middle', textAlign: 'center' }}>
              <Signature name={drafter?.userName || drafter?.name} status="APPROVED" />
            </TableCell>

            {/* 합의자 서명들 */}
            {agreeLines.length > 0 && agreeCells.sigCells}

            {/* 결재자 서명들 */}
            {approveCells.sigCells}
          </TableRow>
        </TableHead>
      </Table>
    </TableContainer>
  );
};

export default DynamicApprovalTable;