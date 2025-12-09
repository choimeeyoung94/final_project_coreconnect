// 실시간 시간 생성하는 파일

/** "2025년 11월 5일 (수)" 형식의 날짜 반환 (한국 시간 기준) */
export function formatKoreanDate(date) {
  if (!date) return "-";
  try {
    // 문자열인 경우 Date 객체로 변환
    let dateObj = date instanceof Date ? date : new Date(date);
    
    // 한국 시간으로 변환
    const koreaTimeStr = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
    dateObj = new Date(koreaTimeStr);
    
    return dateObj.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: 'Asia/Seoul'
    });
  } catch (error) {
    console.error('[formatKoreanDate] 에러:', error, date);
    return "-";
  }
}

/** "11:22:31" 형식의 시간 반환 (한국 시간 기준) */
export function formatKoreanTime(date) {
  if (!date) return "-";
  try {
    // 문자열인 경우 Date 객체로 변환
    let dateObj = date instanceof Date ? date : new Date(date);
    
    // 한국 시간으로 변환
    const koreaTimeStr = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
    dateObj = new Date(koreaTimeStr);
    
    return dateObj.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: 'Asia/Seoul'
    });
  } catch (error) {
    console.error('[formatKoreanTime] 에러:', error, date);
    return "-";
  }
}

/** 출퇴근 시간 표시용 "11:22" 형식의 시간 반환 (한국 시간 기준) */
export function formatTime(timeString) {
  if(!timeString) return "-";
  
  try {

    // LocalDateTime은 시간대 정보가 없는 로컬 시간이므로,
    // 문자열에서 직접 시간 부분을 추출하는 것이 가장 안전합니다.
    // 백엔드에서 이미 한국 시간대로 저장된 로컬 시간을 전송합니다.
    
    let timeStr = null;
    
    // Date 객체인 경우
    if (timeString instanceof Date) {
      const hours = String(timeString.getHours()).padStart(2, "0");
      const minutes = String(timeString.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;

    }
    
    // 문자열인 경우
    if (typeof timeString === 'string') {
      // ISO 8601 형식인 경우 (예: "2025-01-15T09:36:00" 또는 "2025-01-15T09:36:00.123")
      if (timeString.includes('T')) {
        // "T" 이후의 시간 부분 추출 (시간대 정보 제거)
        const timePart = timeString.split('T')[1];
        if (timePart) {
          // "+", "-", "Z" 이전까지만 추출 (시간대 정보 제거)
          timeStr = timePart.split(/[+\-Z]/)[0];
        }
      }
      // "yyyy-MM-dd HH:mm:ss" 형식인 경우 (예: "2025-01-15 09:36:00")
      else if (timeString.includes(' ')) {
        timeStr = timeString.split(' ')[1];
      }
      // 직접 시간 형식인 경우 (예: "09:36:00" 또는 "09:36")
      else if (timeString.match(/^\d{1,2}:\d{2}/)) {
        timeStr = timeString;
      }
      
      // 시간 문자열에서 시:분 추출
      if (timeStr) {
        const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          const hours = match[1].padStart(2, "0");
          const minutes = match[2].padStart(2, "0");
          return `${hours}:${minutes}`;
        }
      }
      
      // 문자열에서 시간을 추출할 수 없으면 Date 객체로 파싱 시도
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
      }
    }
    
    console.warn('[formatTime] 잘못된 날짜 형식:', timeString);
    return "-";

  } catch (error) {
    console.error('[formatTime] 날짜 파싱 오류:', error, 'timeString:', timeString);
    return "-";
  }
}

/** 분 -> "44h 31m" 형식으로 변환 */
export function formatHM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

/** "2025.11.21 11:22:31" 형식의 날짜/시간 반환 (한국 시간 기준) */
export function formatDateTime(date) {
  if (!date) return "-";
  try {
    // 문자열인 경우 Date 객체로 변환
    let dateObj = date instanceof Date ? date : new Date(date);
    
    // 한국 시간으로 변환
    const koreaTimeStr = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
    dateObj = new Date(koreaTimeStr);
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");
    
    return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('[formatDateTime] 에러:', error, date);
    return "-";
  }
}