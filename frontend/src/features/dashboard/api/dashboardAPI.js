import http from "../../../api/http";

//----------------- 내부 유틸 함수 -----------------//

/** 한국 시간대(KST) 기준으로 오늘 00:00부터 내일 00:00 직전까지의 시간 범위를 Date 객체로 계산해 반환 */
function getTodayRangeKST() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return { start, end };
}

/** "YYYY-MM-DDTHH:mm:ss" 형태의 문자열을 안전하게 Date 객체로 변환 */
function parseLocalDateTime(s) {
  if (!s) return new Date(NaN);
  
  try {
    // ISO 8601 형식 처리 (예: "2025-01-15T09:00:00" 또는 "2025-01-15T09:00:00.123")
    if (typeof s === 'string' && s.includes('T')) {
      // 시간대 정보 제거 ("+09:00", "-05:00", "Z" 등)
      let cleanStr = s.split(/[+\-Z]/)[0];
      
      // 밀리초 부분 제거 (있는 경우)
      if (cleanStr.includes('.')) {
        cleanStr = cleanStr.split('.')[0];
      }
      
      // 날짜와 시간 분리
      const [date, time = "00:00:00"] = cleanStr.split("T");
      if (!date) return new Date(NaN);
      
      const [y, m, d] = date.split("-").map(Number);
      const timeParts = time.split(":");
      const [hh, mm, ss] = [
        parseInt(timeParts[0] || 0, 10),
        parseInt(timeParts[1] || 0, 10),
        parseInt(timeParts[2] || 0, 10)
      ];
      
      // 유효한 날짜인지 확인
      if (isNaN(y) || isNaN(m) || isNaN(d)) {
        console.warn('[parseLocalDateTime] 잘못된 날짜 형식:', s);
        return new Date(NaN);
      }
      
      // 로컬 시간대로 Date 객체 생성 (한국 시간대 가정)
      return new Date(y, m - 1, d, hh, mm, ss);
    }
    
    // 다른 형식인 경우 그대로 파싱 시도
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    console.warn('[parseLocalDateTime] 파싱 실패:', s);
    return new Date(NaN);
  } catch (error) {
    console.error('[parseLocalDateTime] 파싱 오류:', error, 'input:', s);
    return new Date(NaN);
  }
}

/** axios 응답(res) 객체 안에 있는 실제 데이터를 꺼내 목록 길이나 총 개수를 유연하게 계산 */
function extractCount(res) {
  const raw = res?.data;
  const page = raw?.data ?? raw;           
  if (Array.isArray(page)) return page.length;
  if (typeof page?.totalElements === "number") return page.totalElements;
  if (Array.isArray(page?.content)) return page.content.length;
  return 0;
}

//----------------- API 함수 -----------------//

/** 공지사항 목록 가져오기 */
export async function getDashboardNotices(size = 5) {
  const res = await http.get("/dashboard/notices/latest", {
    params: { size },
  });
  return res.data;
}

/** 공지사항 상세 */
export async function getDashboardNoticeDetail(id) {
  const res = await http.get(`/dashboard/notices/detail/${id}`);
  return res.data;
}

/** 사용자 부서의 게시판 카테고리 ID 조회 (응답 형태 유연 대응) */
export async function getMyDeptBoardCategoryId() {
  const res = await http.get("/dashboard/my-department");
  const raw = res.data;
  const data = raw?.data ?? raw;
  return (
    data?.categoryId ??
    data?.id ??
    (typeof data === "number" ? data : null)
  );
}

/** 오늘(클라 기준) 새 글 카운트 - API 변경 없이 페이지를 훑어서 카운트 */
export async function countTodayPostsByCategoryClientOnly(categoryId, pageSize = 100, maxPages = 5) {
  const { start, end } = getTodayRangeKST();
  let page = 0;
  let total = 0;

  // 오늘 날짜 문자열 (YYYY-MM-DD 형식)
  const todayStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  while (page < maxPages) {
    const { data } = await http.get(`/board/category/${categoryId}`, {
      params: { sortType: "latest", page, size: pageSize },
    });

    const pageData = data?.data; 
    const content = pageData?.content ?? [];
    
    if (content.length === 0) break;

    for (const item of content) {
      if (!item.createdAt) continue;
      
      // 날짜 문자열에서 날짜 부분만 추출 (YYYY-MM-DD)
      const createdAtStr = String(item.createdAt);
      let dateStr = null;
      
      if (createdAtStr.includes('T')) {
        dateStr = createdAtStr.split('T')[0];
      } else if (createdAtStr.includes(' ')) {
        dateStr = createdAtStr.split(' ')[0];
      } else {
        dateStr = createdAtStr.substring(0, 10);
      }
      
      // 날짜 문자열 비교로 오늘인지 확인
      if (dateStr === todayStr) {
        total++;
      }
    }

    // 다음 페이지 확인용: 마지막 항목의 날짜가 오늘 이전이면 중단
    if (content.length > 0) {
      const last = content[content.length - 1];
      if (last?.createdAt) {
        const lastDateStr = String(last.createdAt);
        let lastDateOnly = null;
        
        if (lastDateStr.includes('T')) {
          lastDateOnly = lastDateStr.split('T')[0];
        } else if (lastDateStr.includes(' ')) {
          lastDateOnly = lastDateStr.split(' ')[0];
        } else {
          lastDateOnly = lastDateStr.substring(0, 10);
        }
        
        // 마지막 항목의 날짜가 오늘보다 이전이면 더 이상 오늘 날짜가 없음
        if (lastDateOnly < todayStr) break;
      }
    }
    
    if (page + 1 >= (pageData?.totalPages ?? Infinity)) break;
    page++;
  }

  return total;
}

/** 내가 결재해야 할 문서 수 */
export async function getMyPendingApprovalCount() {
  const res = await http.get("/approvals/my-tasks");
  return extractCount(res);
}

/** 내가 수신한 문서(참조/수신함) 카운트 */
export async function getMyReceivedApprovalCount() {
  const res = await http.get("/approvals/my-reference-docs");
  return extractCount(res);
}

/** 전체 게시판 최신순 조회 (공지/상단고정 구분 없음) */
export async function getBoardsByLatestOnly(page = 0, size = 10) {
  const res = await http.get("/board/latest", {
    params: { page, size },
  });
  return res.data;
}

/** 월간 일정 요약 조회 */
export const getMonthlyScheduleSummary = (year, month) =>
  http.get("/schedules/summary", {
    params: { year, month },
  });
