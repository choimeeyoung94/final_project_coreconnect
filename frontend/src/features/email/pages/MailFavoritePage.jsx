import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const MailFavoritePage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          중요 메일함
        </Typography>
        <Typography variant="body1" color="text.secondary">
          중요 메일 기능은 개발 중입니다.
        </Typography>
      </Paper>
    </Box>
  );
};

export default MailFavoritePage;
