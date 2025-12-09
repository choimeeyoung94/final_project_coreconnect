import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell, TextField, Select, MenuItem, Typography, Button, Box } from '@mui/material';
import { NumericFormat } from 'react-number-format';

// 공통 스타일 정의
const commonStyles = {
  th: {
    border: '1px solid #ccc',
    backgroundColor: '#f8f8f8',
    padding: '10px',
    textAlign: 'center',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  td: {
    border: '1px solid #ccc',
    padding: '8px',
    textAlign: 'center',
  },
};

const ExpenseForm = ({ formData, onFormChange }) => {
  
  // 항목(item) 테이블 내부의 입력값이 변경될 때 호출될 핸들러
  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [name]: value };

    // 부모(NewDocumentPage)의 onFormChange를 호출
    onFormChange({
      target: {
        name: 'items',
        value: newItems
      }
    });
  };

  const handlePurposeChange = e => {
    const { name, value } = e.target;

    let processedValue = value;
    if (processedValue.length > 100) {
      processedValue = processedValue.slice(0, 100);
    }

    onFormChange({
      target: {
        name: name,
        value: processedValue
      }
    });
  }

  // 항목 추가 버튼 클릭 시
  const handleAddItem = () => {
    const newItem = {
      id: Date.now(), 
      date: '',
      account: '',
      description: '',
      amount: 0,
      note: ''
    };
    const newItems = [...(formData.items || []), newItem];
    onFormChange({
      target: {
        name: 'items',
        value: newItems
      }
    });
  };

  // 항목 삭제 버튼 클릭 시
  const handleRemoveItem = (indexToRemove) => {
    const newItems = formData.items.filter((_, index) => index !== indexToRemove);
    onFormChange({
      target: {
        name: 'items',
        value: newItems
      }
    });
  };

  return (
    <>
      {/* 1. 지출 목적 */}
      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1 }}>
        신청 내용
      </Typography>
      <Table sx={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{...commonStyles.th, width: '120px'}}>* 지출 목적</TableCell>
            <TableCell sx={commonStyles.td}>
              <TextField
                name="purpose"
                value={formData.purpose || ''}
                onChange={handlePurposeChange} // 이 필드는 부모 핸들러 직접 호출
                required
                multiline
                rows={3}
                fullWidth
                placeholder="지출의 주된 목적을 기재 (예: XX 프로젝트 야근 식대 및 교통비 정산)"
                helperText={`${(formData.purpose || '').length}/100자`}
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* 2. 지출 항목 (동적 테이블) */}
      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1 }}>
        지출 항목
      </Typography>
      <Table sx={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={commonStyles.th}>* 사용일</TableCell>
            <TableCell sx={commonStyles.th}>* 계정과목</TableCell>
            <TableCell sx={commonStyles.th}>* 적요 (상세내역)</TableCell>
            <TableCell sx={commonStyles.th}>* 금액</TableCell>
            <TableCell sx={commonStyles.th}>관리</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {formData.items && formData.items.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell sx={commonStyles.td}>
                <TextField
                  type="date"
                  name="date"
                  value={item.date || ''}
                  onChange={e => handleItemChange(index, e)}
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: '120px' }}
                />
              </TableCell>
              <TableCell sx={commonStyles.td}>
                <Select
                  name="account"
                  value={item.account || ''}
                  onChange={e => handleItemChange(index, e)}
                  required
                  size="small"
                  displayEmpty
                  sx={{ minWidth: '120px' }}
                >
                  <MenuItem value="" disabled><em>선택</em></MenuItem>
                  <MenuItem value="식대">식대</MenuItem>
                  <MenuItem value="교통비">교통비</MenuItem>
                  <MenuItem value="소모품비">소모품비</MenuItem>
                  <MenuItem value="복리후생비">복리후생비</MenuItem>
                  <MenuItem value="기타">기타</MenuItem>
                </Select>
              </TableCell>
              <TableCell sx={commonStyles.td}>
                <TextField
                  type="text"
                  name="description"
                  value={item.description || ''}
                  onChange={e => handleItemChange(index, e)}
                  placeholder="예: 00식당 (법인카드)"
                  required
                  fullWidth
                  multiline
                  rows={2}
                  inputProps={{ maxLength: 50 }}
                />
              </TableCell>
              <TableCell sx={commonStyles.td}>
                <NumericFormat
                  name='amount'
                  value={item.amount || ''}
                  onValueChange={values => {
                    handleItemChange(index, {
                      target: {
                        name: 'amount',
                        value: values.value,
                      }
                    });
                  }}
                  allowNegative={false}
                  decimalScale={0}
                  thousandSeparator=","
                  customInput={TextField}
                  placeholder='숫자만 입력'
                  required
                  fullWidth
                  size='small'
                  sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                />
              </TableCell>

              <TableCell sx={commonStyles.td}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleRemoveItem(index)}
                >
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* 항목 추가 버튼 */}
      <Box sx={{ textAlign: 'right', mt: 2, mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleAddItem}
        >
          지출 항목 추가
        </Button>
      </Box>

      {/* 3. 신청 합계 */}
      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1 }}>
        신청 합계
      </Typography>
      <Table sx={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
        <TableBody>
          <TableRow>
            <TableCell component="th" sx={{...commonStyles.th, width: '120px'}}>총 합계 금액</TableCell>
            <TableCell sx={{...commonStyles.td, textAlign: 'right'}}>
              <Typography variant="h6" component="span" sx={{ fontWeight: 'bold', color: 'blue' }}>
                {Number(formData.totalAmount || 0).toLocaleString()} 원
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
};

export default ExpenseForm;