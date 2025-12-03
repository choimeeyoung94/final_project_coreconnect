/**
 * ============================================================
 *    Date Format Utility (LocalDateTime ↔ ISO ↔ JS Date)
 * ------------------------------------------------------------
 * - Backend(LocalDateTime): "yyyy-MM-dd HH:mm:ss"
 * - Frontend(ISO):          "yyyy-MM-ddTHH:mm:ss"
 * - JS Date:                Date Object
 *
 *     Features
 *   - 모든 변환 간 일관된 포맷 보장
 *   - ISO ↔ LocalDateTime 상호 변환 자동
 *   - 잘못된 입력 방어 및 디버깅 모드 지원
 * ============================================================
 */

const pad = (n) => String(n).padStart(2, "0");
const DEBUG = false;

/** 내부 디버깅 로거 */
const log = (fn, input, output) => {
  if (DEBUG) console.log(`[${fn}] 입력:`, input, "→ 출력:", output);
};

/**
 * JS Date / ISO / LocalDateTime → 백엔드(LocalDateTime: "yyyy-MM-dd HH:mm:ss")
 */
export const toBackendFormat = (input) => {
  if (!input) {
    return null;
  }
  
  let result;
  const inputType = typeof input;
  const isDate = input instanceof Date;

  // Date 객체
  if (isDate && !isNaN(input)) {
    const pad = (n) => String(n).padStart(2, "0");
    result = `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(
      input.getDate()
    )} ${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(
      input.getSeconds()
    )}`;
  }

  // 문자열 ("T" or " " 모두 지원)
  else if (inputType === "string") {
    let temp = input.trim();
    
    // 타임존 오프셋 제거 (+09:00, -05:00, Z 등) - 먼저 처리
    temp = temp.replace(/[+-]\d{2}:\d{2}$/, "").replace(/Z$/, "");
    
    // 잘못된 형식 정리: "2025-11-24 08:00:00+09:00 09:00:00" 같은 경우
    // 타임존 오프셋이 제거된 후에도 중복 시간이 남아있을 수 있음
    // 정규식으로 올바른 형식만 추출: "yyyy-MM-dd HH:mm:ss" 또는 "yyyy-MM-ddTHH:mm:ss"
    const dateTimeMatch = temp.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
    if (dateTimeMatch) {
      const [, datePart, timePart] = dateTimeMatch;
      // 시간 부분에 초가 없으면 추가
      const normalizedTime = timePart.includes(':') && timePart.split(':').length === 2 
        ? `${timePart}:00` 
        : timePart;
      temp = `${datePart} ${normalizedTime}`;
    } else {
      // 매칭되지 않으면 기본 처리
      // 공백 이후의 중복 시간 부분 제거
      if (temp.includes(" ") && temp.split(" ").length > 2) {
        const parts = temp.split(" ");
        // 날짜 부분과 첫 번째 시간 부분만 사용
        if (parts.length >= 2) {
          temp = `${parts[0]} ${parts[1]}`;
        }
      }
      
      // "T"를 " "로 변환
      temp = temp.includes("T") ? temp.replace("T", " ") : temp;

      // 초(:ss)가 없는 경우 자동으로 ":00" 추가
      // 예: "2025-11-07 11:00" → "2025-11-07 11:00:00"
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(temp)) {
        temp += ":00";
      }
    }

    result = temp.trim();
  }

  // 기타 타입
  else {
    // Date 객체의 toString() 결과를 처리 (예: "Mon Nov 24 2025 09:00:00 GMT+0900")
    // 또는 다른 형식의 날짜 문자열
    const inputStr = String(input);
    
    // Date 객체의 toString() 형식 감지
    const dateStringMatch = inputStr.match(/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/);
    if (dateStringMatch) {
      try {
        const dateObj = new Date(inputStr);
        if (!isNaN(dateObj.getTime())) {
          const pad = (n) => String(n).padStart(2, "0");
          result = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(
            dateObj.getDate()
          )} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(
            dateObj.getSeconds()
          )}`;
          log("toBackendFormat", input, result);
          return result;
        }
      } catch {
        // Date 생성 실패
      }
    }
    
    // 마지막 시도: String 변환 후 Date 생성
    try {
      const dateObj = new Date(inputStr);
      if (!isNaN(dateObj.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        result = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(
          dateObj.getDate()
        )} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(
          dateObj.getSeconds()
        )}`;
        log("toBackendFormat", input, result);
        return result;
      }
    } catch {
      // 모든 변환 실패
    }
    
    // 변환 실패 시 null 반환 (잘못된 형식 방지)
    return null;
  }

  // 최종 검증: 올바른 형식인지 확인
  if (result && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result)) {
    return null;
  }

  log("toBackendFormat", input, result);
  return result;
};

/**
 * 백엔드(LocalDateTime or ISO) → ISO 포맷("yyyy-MM-ddTHH:mm:ss")
 * FullCalendar, input[type=datetime-local] 등에 사용
 */
export const toISO = (input) => {
  if (!input) return null;
  let result;

  // JS Date 객체
  if (input instanceof Date && !isNaN(input)) {
    result = input.toISOString().slice(0, 19); // UTC 기준
  }

  // 문자열 (" " or "T")
  else if (typeof input === "string") {
    let temp = input.trim();
    
    // Date 객체의 toString() 결과를 처리 (예: "Mon Nov 24 2025 09:00:00 GMT+0900")
    // 이런 형식은 정규식으로 파싱하여 ISO 형식으로 변환
    const dateStringMatch = temp.match(/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/);
    if (dateStringMatch) {
      try {
        const dateObj = new Date(temp);
        if (!isNaN(dateObj.getTime())) {
          result = dateObj.toISOString().slice(0, 19);
          log("toISO", input, result);
          return result;
        }
      } catch {
        // Date 생성 실패 시 아래 로직으로 계속 진행
      }
    }
    
    // 타임존 오프셋 제거 (+09:00, -05:00, Z 등)
    temp = temp.replace(/[+-]\d{2}:\d{2}$/, "").replace(/Z$/, "");
    
    // 잘못된 형식 정리: "2025-11-24T09:00:00+09:00 09:00:00" 같은 경우
    // 공백 이후의 중복 시간 부분 제거
    if (temp.includes("T") && temp.includes(" ")) {
      const tIndex = temp.indexOf("T");
      const spaceIndex = temp.indexOf(" ", tIndex);
      if (spaceIndex > 0) {
        // "T" 이후 첫 번째 공백까지만 사용
        temp = temp.substring(0, spaceIndex);
      }
    }
    
    // " "를 "T"로 변환
    result = temp.includes("T") ? temp : temp.replace(" ", "T");
    
    // 최종 검증: 올바른 ISO 형식인지 확인 (yyyy-MM-ddTHH:mm:ss)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(result)) {
      // 유효하지 않은 형식이면 null 반환
      return null;
    }
  }

  // 기타 타입 (Date 객체가 아닌 객체 등)
  else {
    // Date 객체인데 instanceof 체크를 통과하지 못한 경우 (다른 컨텍스트)
    if (input && typeof input.getTime === "function") {
      try {
        const dateObj = new Date(input);
        if (!isNaN(dateObj.getTime())) {
          result = dateObj.toISOString().slice(0, 19);
          log("toISO", input, result);
          return result;
        }
      } catch {
        // Date 생성 실패
      }
    }
    
    // 마지막 시도: String 변환 후 Date 생성
    try {
      const dateObj = new Date(String(input));
      if (!isNaN(dateObj.getTime())) {
        result = dateObj.toISOString().slice(0, 19);
        log("toISO", input, result);
        return result;
      }
    } catch {
      // 모든 변환 실패
    }
    
    return null;
  }

  log("toISO", input, result);
  return result;
};

/**
 * ISO / LocalDateTime → datetime-local input 형식("yyyy-MM-ddThh:mm")
 * 타임존 오프셋과 초를 제거하여 datetime-local input에 맞게 변환
 */
export const toDateTimeLocal = (input) => {
  if (!input) {
    // 빈 값일 때 오늘 날짜 + 현재 시간을 기본값으로 반환
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  const iso = toISO(input);
  if (!iso) {
    // toISO 변환 실패 시에도 기본값 반환
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  // 타임존 오프셋 제거 (+09:00, -05:00 등)
  let result = iso.replace(/[+-]\d{2}:\d{2}$/, "");
  
  // 초(:ss) 제거 (datetime-local은 초를 표시하지 않음)
  result = result.replace(/:\d{2}$/, "");
  
  return result;
};

/**
 * datetime-local input 값 → LocalDateTime 형식("yyyy-MM-dd HH:mm:ss")
 * datetime-local input에서 받은 "yyyy-MM-ddThh:mm" 형식을 백엔드 형식으로 변환
 */
export const fromDateTimeLocal = (input) => {
  if (!input) return "";
  // "yyyy-MM-ddThh:mm" → "yyyy-MM-dd HH:mm:ss"
  return input.replace("T", " ") + ":00";
};

/**
 * 백엔드(LocalDateTime or ISO) → JS Date 객체 변환
 * DatePicker 초기값, 시간 계산 등에서 사용
 */
export const toDate = (input) => {
  if (!input) return null;
  try {
    const iso = toISO(input);
    const date = new Date(iso);
    if (isNaN(date)) throw new Error("Invalid date");
    log("toDate", input, date);
    return date;
  } catch {
    return null;
  }
};

/**
 * JS Date → ISO 문자열 ("yyyy-MM-ddTHH:mm:ss")
 * FullCalendar 수동 생성 시 사용
 */
export const toISOFromDate = (date) => {
  if (!(date instanceof Date) || isNaN(date)) return null;
  const result = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
  log("toISOFromDate", date, result);
  return result;
};


/**
 * LocalDateTime / ISO / JS Date → "yyyy-MM-dd" (LocalDate 전용)
 * 백엔드 @DateTimeFormat(pattern="yyyy-MM-dd")용 파라미터에 사용
 */
export const toLocalDate = (input) => {
  if (!input) return null;

  // Date 객체인 경우
  if (input instanceof Date && !isNaN(input)) {
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
  }

  // 문자열인 경우 ("T" 또는 " " 포함)
  if (typeof input === "string") {
    const temp = input.includes("T") ? input.split("T")[0] : input.split(" ")[0];
    return temp;
  }

  // 기타 타입
  return String(input).slice(0, 10);
};