import React from 'react';
import { Box, Typography } from '@mui/material';

const MailFavoritePage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">중요 메일</Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        중요 메일 기능은 곧 추가될 예정입니다.
      </Typography>
    </Box>
  );
};

export default MailFavoritePage;
