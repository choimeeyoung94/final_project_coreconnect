export const JOB_GRADE_LABELS = {
  INTERN: "인턴",
  STAFF: "사원",
  ASSISTANT_MANAGER: "대리",
  MANAGER: "과장",
  DEPUTY_GENERAL_MANAGER: "차장",
  GENERAL_MANAGER: "부장",
  DIRECTOR: "이사",
  EXECUTIVE_DIRECTOR: "상무",
  VICE_PRESIDENT: "전무",
  PRESIDENT: "대표"
};

export const LEAVE_REQUEST_LABELS = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELED: "취소",
};

export const LEAVE_TYPE_LABELS = {
  ANNUAL: "연차",
  HALF_DAY_MORNING: "반차(오전)",
  HALF_DAY_AFTERNOON: "반차(오후)",
  SICK: "병가",
  FAMILY_EVENT: "경조휴가",
  ETC: "기타",
};

export const NOTIFICATION_TYPE_LABELS = {
  EMAIL: "메일",
  NOTICE: "공지",
  APPROVAL: "결재",
  SCHEDULE: "일정",
};

export const LOG_ACTION_TYPE_LABELS = {
  LOGIN: "로그인",
  LOGOUT: "로그아웃",
  FAIL: "로그인 실패",
  REFRESH: "토큰 재발급",
};

export const ATTENDANCE_STATUS_LABELS = {
  PRESENT: "출근",
  LATE: "지각",
  ABSENT: "결근",
  LEAVE_EARLY: "조퇴",
  COMPLETED: "완료",
};

export const USER_STATUS_LABELS = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
};

export const ROLE_LABELS = {
  ADMIN: "관리자",
  MANAGER: "부서장",
  USER: "일반",
};

export const getJobGradeLabel = key => JOB_GRADE_LABELS[key] || key;
export const getLeaveRequestLabel = key => LEAVE_REQUEST_LABELS[key] || key;
export const getLeaveTypeLabel = value => LEAVE_TYPE_LABELS[value] || value;
export const getNotificationTypeLabel = type => NOTIFICATION_TYPE_LABELS[type] || type;
export const getLogActionTypeLabel = type => LOG_ACTION_TYPE_LABELS[type] || type;
export const getAttendanceStatusLabel = status => ATTENDANCE_STATUS_LABELS[status] || status;
export const getStatusLabel = status => USER_STATUS_LABELS[status] || status;
export const getRoleLabel = role => ROLE_LABELS[role] || role;


