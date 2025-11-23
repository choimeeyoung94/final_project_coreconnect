import http from '../../../api/http.js';


// 기본 받은메일함 조회 (기본 옵션만)
export const fetchInboxSimple = (userEmail, page, size, filter) =>
  http.get('/email/inbox', { params: { userEmail, page, size, filter } });

/**
 * 받은메일함 조회 (정렬/추가옵션 지원)
 */
export const fetchInbox = (
  userEmail, page, size, filter,
  sortField = null, sortDirection = null,
  searchType = null, keyword = null
) => {
  const params = { userEmail, page, size, filter };
  if (sortField) params.sortField = sortField;
  if (sortDirection) params.sortDirection = sortDirection;
  if (searchType) params.searchType = searchType;
  if (keyword && keyword.trim().length > 0) params.keyword = keyword.trim();
  return http.get('/email/inbox', { params });
};

// '안읽은 메일' 개수 조회 (Controller의 /email/inbox/unread-count와 매칭)
export const fetchUnreadCount = (userEmail) =>
  http.get('/email/inbox/unread-count', { params: { userEmail } })
    .then(res => res.data.data);

// 메일 상세 조회 (userEmail 동봉)
export const getEmailDetail = (emailId, userEmail) => {
  return http.get(`/email/${emailId}`, { params: { userEmail } });
};

// 메일 읽음 처리 API (PATCH)
export const markMailAsRead = (emailId, userEmail) =>
  http.patch(`/email/${emailId}/read`, { userEmail });

// 메일 중요 표시 토글 API (PATCH)
export const toggleFavoriteStatus = (emailId, userEmail) =>
  http.patch(`/email/${emailId}/favorite`, { userEmail });

// 파일 다운로드 (첨부파일)
export const downloadAttachment = (fileId, fileName) => {
  return http.get(`/email/file/download/${fileId}`, { responseType: 'blob' }).then(res => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || `attachment_${fileId}`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  });
};

// sendMail: accepts a FormData or an object; if object passed, it will be converted here
export const sendMail = (mailData) => {
  // If front passes a FormData already (e.g., MailWritePage.buildSendFormData returned it), send it directly.
  if (mailData instanceof FormData) {
    // Do NOT set Content-Type header; let axios set boundary automatically
    return http.post('/email/send', mailData);
  }

  // Otherwise, convert plain object to FormData (backwards compatibility)
  const formData = new FormData();
  const { attachments, ...pureData } = mailData;
  formData.append(
    "data",
    new Blob([JSON.stringify(pureData)], { type: "application/json" })
  );
  if (attachments && attachments.length) {
    attachments.forEach(file => {
      formData.append("attachments", file);
    });
  }
  return http.post('/email/send', formData);
};

export const fetchSentbox = (userEmail, page, size, searchType = null, keyword = null) => {
  const params = { userEmail, page, size };
  if (searchType) params.searchType = searchType;
  if (keyword && keyword.trim().length > 0) params.keyword = keyword.trim();
  return http.get('/email/sentbox', { params });
};

export const downloadAllAttachments = (attachments = []) => {
  attachments.forEach(file => {
    downloadAttachment(file.fileId, file.fileName);
  });
};

// 임시저장 메일 생성 API
export const saveDraftMail = (mailData) => {
  // Accepts FormData or plain object
  if (mailData instanceof FormData) {
    return http.post('/email/draft', mailData);
  }
  const formData = new FormData();
  const { attachments, ...pureData } = mailData;
  formData.append(
    "data",
    new Blob([JSON.stringify(pureData)], { type: "application/json" })
  );
  if (attachments && attachments.length) {
    attachments.forEach(file => {
      formData.append("attachments", file);
    });
  }
  return http.post('/email/draft', formData);
};

// 임시보관함(임시저장 메일함) 목록 조회
export const fetchDraftbox = (userEmail, page = 0, size = 20) =>
  http.get('/email/draftbox', { params: { userEmail, page, size } });

// 임시보관함 안읽은 개수 (or 전체 임시저장 메일 개수)
export const fetchDraftCount = (userEmail) =>
  http.get('/email/draftbox/count', { params: { userEmail } })
    .then(res => res.data.data);

// 임시저장 메일 상세 보기
export const getDraftDetail = (draftId, userEmail) =>
  http.get(`/email/draft/${draftId}`, { params: { userEmail } });

// 임시메일 삭제 API 함수 예시
export function deleteDraftMail(draftId) {
  return http.delete(`/email/draft/delete/${draftId}`);
}

// 선택된 이메일을 휴지통(TRASH)으로 이동
export const moveToTrash = (emailIds) => {
  return http.post('/email/move-to-trash', emailIds);
};

// 휴지통에서 선택된 이메일을 복원
export const restoreFromTrash = (emailIds) => {
  return http.post('/email/restore-from-trash', emailIds, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

// 휴지통 비우기
export const emptyTrash = () => {
  return http.post('/email/trash/empty');
};

// 휴지통(TRASH) 메일 목록 조회
export const fetchTrashList = (userEmail, page = 0, size = 20) => 
  http.get('/email/trash', { params: { userEmail, page, size } });

// 선택된 mailIds를 삭제(휴지통) 처리
// api/emailApi.js (axios 인스턴스 http 이용 시)
export function deleteMails(deleteMailsRequest) {
  // 반드시 두번째 파라미터(config)에 data를 넣는다! (axios v0.19 이상)
  return http.delete('/email/trash', {
    data: deleteMailsRequest, // ← { mailIds: [...] }
    headers: { 'Content-Type': 'application/json' } // 명시(일부 env에서 필요)
  });
}

// fetchTrashMails wrapper returning axios response (older callers)
export async function fetchTrashMails(userEmail, page = 0, size = 10) {
  const res = await http.get('/email/trash', {
    params: { userEmail, page, size },
    withCredentials: true
  });
  return res.data;
}

export async function fetchScheduledMails(userEmail, page = 0, size = 10) {
  const res = await http.get('/email/reserved', {
    params: { userEmail, page, size },
    withCredentials: true
  });
  return res.data;
}

// 중요 메일 목록 조회
export const fetchFavoriteMails = (
  userEmail, page, size,
  searchType = null, keyword = null
) => {
  const params = { userEmail, page, size };
  if (searchType) params.searchType = searchType;
  if (keyword && keyword.trim().length > 0) params.keyword = keyword.trim();
  return http.get('/email/favorite', { params });
};

