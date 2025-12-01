import React, { useState, useEffect, useMemo, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Stack,
  Autocomplete,
  Alert,
  useMediaQuery,
  useTheme,
  FormControl,      
  InputLabel,      
  Select,          
  Chip, 
  Box,
  Typography,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
  ListSubheader,
} from "@mui/material";
import { toBackendFormat, toISO, toDateTimeLocal, fromDateTimeLocal } from "../../../utils/dateFormat";
import {
  getMeetingRooms,
  getScheduleCategories,
  getUsers,
  checkRoomAvailable,
  getAvailableMeetingRooms,
  getUsersAvailability 
} from "../api/scheduleAPI";
import AttendeeTimelinePanel from "../components/AttendeeTimelinePanel";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import { UserProfileContext } from "../../../App";

export default function ScheduleModal({
  open,
  onClose,
  date,
  onSubmit,
  onDelete,
  initialData,
}) {
  const isEdit = !!initialData;
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm")); // 모바일일 때 전체화면 처리
  const { showSnack } = useSnackbarContext();
  const { userProfile } = useContext(UserProfileContext) || {};
  const currentUserEmail = userProfile?.email;

  // 종일 일정 판단 함수
  const isAllDayEvent = (startDateTime, endDateTime) => {
    if (!startDateTime || !endDateTime) return false;
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    
    const startDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    
    const isMultiDay = startDateStr !== endDateStr;
    const isSameDay = startDateStr === endDateStr;
    
    if (isMultiDay) {
      // 멀티데이: 시작일 00:00, 종료일 23:59이면 종일
      const startTime = start.getHours() === 0 && start.getMinutes() === 0;
      const endTime = end.getHours() === 23 && end.getMinutes() === 59;
      return startTime && endTime;
    }
    
    if (isSameDay) {
      // 하루 종일: 00:00 ~ 23:59
      return start.getHours() === 0 && 
             start.getMinutes() === 0 && 
             end.getHours() === 23 && 
             end.getMinutes() === 59;
    }
    
    return false;
  };

  const [meetingRooms, setMeetingRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [roomAvailable, setRoomAvailable] = useState(true);
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [categoryError, setCategoryError] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    location: "",
    // 통합 필드 (기존 호환성 유지)
    startDateTime: date ? `${date} 09:00:00` : "",
    endDateTime: date ? `${date} 10:00:00` : "",
    // 분리 필드 (UI용)
    startDate: date || "",
    startTime: "09:00",
    endDate: date || "",
    endTime: "10:00",
    // 시간/분 분리 필드 (UI용)
    startTimeHour: "9",
    startTimeMinute: "0",
    endTimeHour: "10",
    endTimeMinute: "0",
    // 종일 일정 여부
    isAllDay: false,
    meetingRoomId: "",
    categoryId: "",
    participantIds: [],
    visibility: "PUBLIC", 
  });

  /** 공통 데이터 로드 */
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [roomsRes, catsRes, usersRes] = await Promise.allSettled([
        getMeetingRooms(),
        getScheduleCategories(),
        getUsers(),
      ]);
      if (roomsRes.status === "fulfilled") setMeetingRooms(roomsRes.value);
      if (catsRes.status === "fulfilled") {
        const categoriesList = catsRes.value;
        setCategories(categoriesList);
        
        // 새 일정 등록 모드일 때만 카테고리 자동 선택
        if (!isEdit && categoriesList && categoriesList.length > 0) {
          // 1순위: 기본 카테고리(defaultYn = true) 찾기
          const defaultCategory = categoriesList.find(cat => cat.defaultYn === true);
          
          // 2순위: 기본 카테고리가 없으면 첫 번째 카테고리 선택
          const selectedCategory = defaultCategory || categoriesList[0];
          
          if (selectedCategory) {
            setForm(prev => ({
              ...prev,
              categoryId: selectedCategory.id
            }));
          }
        } else if (!isEdit && (!categoriesList || categoriesList.length === 0)) {
          // 카테고리 목록이 없으면 경고 표시
          showSnack("사용 가능한 카테고리가 없습니다. 카테고리를 먼저 생성해주세요.", "warning");
        }
      }
      if (usersRes.status === "fulfilled") setUsers(usersRes.value);
    };
    load();
  }, [open, isEdit, showSnack]);

  /** 새 일정 등록 모드일 때 본인을 참여자 목록에 자동 추가 */
  useEffect(() => {
    if (!open || isEdit || !users.length || !currentUserEmail) return;
    
    const currentUser = users.find(u => u.email === currentUserEmail);
    if (currentUser && !form.participantIds.includes(currentUser.id)) {
      setForm(prev => ({
        ...prev,
        participantIds: [currentUser.id, ...prev.participantIds]
      }));
    }
  }, [open, isEdit, users, currentUserEmail]);

  /** categories와 meetingRooms가 로드된 후 initialData 값이 유효하면 form에 다시 설정 */
  useEffect(() => {
    if (!open || !isEdit || !initialData) return;
    
    // categories가 로드되었고, initialData.categoryId가 유효한지 확인
    if (categories.length > 0 && initialData.categoryId) {
      const categoryIds = categories.map(cat => cat.id);
      const isValidCategory = categoryIds.includes(initialData.categoryId);
      
      if (isValidCategory && form.categoryId !== initialData.categoryId) {
        setForm(prev => ({
          ...prev,
          categoryId: initialData.categoryId
        }));
      }
    }
    
    // meetingRooms가 로드되었고, initialData.meetingRoomId가 유효한지 확인
    if (meetingRooms.length > 0 && initialData.meetingRoomId) {
      const roomIds = meetingRooms.map(room => room.id);
      const isValidRoom = roomIds.includes(initialData.meetingRoomId);
      
      if (isValidRoom && form.meetingRoomId !== initialData.meetingRoomId) {
        setForm(prev => ({
          ...prev,
          meetingRoomId: initialData.meetingRoomId
        }));
      }
    }
  }, [categories, meetingRooms, open, isEdit, initialData]);

  /** 모달이 열릴 때 초기화 및 수정 모드일 때 기존 값 채우기 */
  useEffect(() => {
    if (!open) {
      // 모달이 닫히면 form 초기화
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setForm({
        title: "",
        content: "",
        location: "",
        startDateTime: date ? `${date} 09:00:00` : `${todayStr} 09:00:00`,
        endDateTime: date ? `${date} 10:00:00` : `${todayStr} 10:00:00`,
        startDate: date || todayStr,
        startTime: "09:00",
        endDate: date || todayStr,
        endTime: "10:00",
        startTimeHour: "9",
        startTimeMinute: "0",
        endTimeHour: "10",
        endTimeMinute: "0",
        isAllDay: false,
        meetingRoomId: "",
        categoryId: "",
        participantIds: [],
        visibility: "PUBLIC",
      });
      setCategoryError(false); // 에러 상태도 초기화
      setTitleError(false); // 제목 에러 상태도 초기화
      return;
    }

    // 수정 모드라면 기존 값 채우기
    if (isEdit && initialData) {
      // toBackendFormat으로 일관된 형식으로 변환
      const normalizedStart = toBackendFormat(initialData.startDateTime);
      const normalizedEnd = toBackendFormat(initialData.endDateTime);
      
      // null 검증: 날짜 형식이 올바르지 않으면 기본값 사용
      if (!normalizedStart || !normalizedEnd) {
        showSnack("일정 데이터를 불러오는 중 오류가 발생했습니다.", "error");
        return;
      }
      
      // 종일 여부 판단
      const isAllDay = isAllDayEvent(initialData.startDateTime, initialData.endDateTime);
      
      // 정규화된 날짜에서 날짜와 시간 분리
      const startParts = normalizedStart.split(' ');
      const endParts = normalizedEnd.split(' ');
      
      // 날짜 검증: startParts[0]이 유효한 날짜 형식인지 확인
      const startDateStr = startParts[0] && /^\d{4}-\d{2}-\d{2}$/.test(startParts[0]) ? startParts[0] : '';
      const endDateStr = endParts[0] && /^\d{4}-\d{2}-\d{2}$/.test(endParts[0]) ? endParts[0] : '';
      
      // 시간/분 분리
      const startTimeStr = startParts[1] ? startParts[1].substring(0, 5) : '09:00';
      const endTimeStr = endParts[1] ? endParts[1].substring(0, 5) : '10:00';
      const startTimeParts = startTimeStr.split(':');
      const endTimeParts = endTimeStr.split(':');
      
      // 분(minute) 값을 5분 단위로 정규화하는 함수
      const normalizeMinute = (min) => {
        if (!min) return "0";
        const minNum = parseInt(min, 10);
        if (isNaN(minNum)) return "0";
        // 5분 단위로 반올림 (0, 5, 10, 15, ..., 55)
        return String(Math.floor(minNum / 5) * 5).padStart(2, "0");
      };
      
      // 정규화된 분 값 계산
      const normalizedStartMinute = isAllDay ? "0" : normalizeMinute(startTimeParts[1]);
      const normalizedEndMinute = isAllDay ? "55" : normalizeMinute(endTimeParts[1]); // 종일 일정도 "55"로 통일 (minutes 배열에 있는 값)
      
      // 종일 일정일 때는 시간을 명시적으로 설정 (종료 시간은 23:59:59로 설정)
      const finalStartTime = isAllDay ? "00:00" : `${String(startTimeParts[0] || "9").padStart(2, "0")}:${normalizedStartMinute}`;
      const finalEndTime = isAllDay ? "23:59" : `${String(endTimeParts[0] || "10").padStart(2, "0")}:${normalizedEndMinute}`;
      
      // 정규화된 startDateTime과 endDateTime 재생성 (종일 일정은 종료 시간을 23:59:59로 설정)
      const finalNormalizedStart = startDateStr && finalStartTime ? `${startDateStr} ${finalStartTime}:00` : normalizedStart;
      const endTimePart = isAllDay ? "23:59:59" : `${finalEndTime}:00`;
      const finalNormalizedEnd = endDateStr && finalEndTime 
        ? `${endDateStr} ${endTimePart}` 
        : normalizedEnd;
      
      // participantIds 처리: initialData.participantIds가 없거나 빈 배열인 경우 빈 배열로 설정
      const participantIds = initialData.participantIds && Array.isArray(initialData.participantIds) && initialData.participantIds.length > 0
        ? initialData.participantIds
        : [];
      
      const formData = {
        title: initialData.title || "",
        content: initialData.content || "",
        location: initialData.location || "",
        startDateTime: finalNormalizedStart,
        endDateTime: finalNormalizedEnd,
        startDate: startDateStr,
        startTime: finalStartTime,
        endDate: endDateStr,
        endTime: finalEndTime,
        startTimeHour: isAllDay ? "0" : (startTimeParts[0] || "9"),
        startTimeMinute: isAllDay ? "0" : normalizedStartMinute,
        endTimeHour: isAllDay ? "23" : (endTimeParts[0] || "10"),
        endTimeMinute: isAllDay ? "55" : normalizedEndMinute, // 종일 일정일 때는 minutes 배열에 있는 값 사용
        isAllDay: isAllDay,
        meetingRoomId: initialData.meetingRoomId || "",
        categoryId: initialData.categoryId || "",
        participantIds: participantIds,
        visibility: initialData.visibility || "PUBLIC",
      };
      
      setForm(formData);
      
    } else if (date) {
      // 새 일정 등록 모드이고 date가 있으면 초기값 설정
      // date가 Date 객체인 경우 날짜만 추출하고 시간은 기본값(09:00, 10:00) 사용
      let dateStr, startHour, startMinute, endHour, endMinute;
      
      if (date instanceof Date && !isNaN(date.getTime())) {
        // Date 객체인 경우: 날짜만 추출, 시간은 기본값 사용
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        dateStr = `${year}-${month}-${day}`;
        
        // 기본 시간 사용 (09:00, 10:00)
        startHour = "09";
        startMinute = "00";
        endHour = "10";
        endMinute = "00";
      } else {
        // 문자열인 경우: 기본 시간 사용
        dateStr = typeof date === "string" ? date : String(date);
        startHour = "09";
        startMinute = "00";
        endHour = "10";
        endMinute = "00";
      }
      
      // 분(minute) 값을 5분 단위로 정규화
      const normalizeMinute = (min) => {
        const minNum = parseInt(min, 10);
        return String(Math.floor(minNum / 5) * 5).padStart(2, "0");
      };
      
      const normalizedStartMinute = normalizeMinute(startMinute);
      const normalizedEndMinute = normalizeMinute(endMinute);
      
      setForm((prev) => ({
        ...prev,
        startDateTime: `${dateStr} ${startHour}:${normalizedStartMinute}:00`,
        endDateTime: `${dateStr} ${endHour}:${normalizedEndMinute}:00`,
        startDate: dateStr,
        startTime: `${startHour}:${normalizedStartMinute}`,
        endDate: dateStr,
        endTime: `${endHour}:${normalizedEndMinute}`,
        startTimeHour: String(parseInt(startHour, 10)),
        startTimeMinute: normalizedStartMinute,
        endTimeHour: String(parseInt(endHour, 10)),
        endTimeMinute: normalizedEndMinute,
        isAllDay: false,
      }));
    } else {
      // date가 없을 때 오늘 날짜로 기본값 설정
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setForm((prev) => ({
        ...prev,
        startDateTime: `${todayStr} 09:00:00`,
        endDateTime: `${todayStr} 10:00:00`,
        startDate: todayStr,
        startTime: "09:00",
        endDate: todayStr,
        endTime: "10:00",
        startTimeHour: "9",
        startTimeMinute: "0",
        endTimeHour: "10",
        endTimeMinute: "0",
        isAllDay: false,
      }));
    }
  }, [open, initialData, isEdit, date]);

  /** 분리 필드 → 통합 필드 자동 동기화 */
  // 시작 날짜+시간 → startDateTime
  useEffect(() => {
    if (form.startDate && form.startTime) {
      // 종일 일정일 때는 항상 "00:00:00"으로 설정
      const timePart = form.isAllDay ? "00:00:00" : `${form.startTime}:00`;
      const combined = `${form.startDate} ${timePart}`;
      setForm((prev) => {
        if (prev.startDateTime === combined) return prev;
        return { ...prev, startDateTime: combined };
      });
    }
  }, [form.startDate, form.startTime, form.isAllDay]);

  // 종료 날짜+시간 → endDateTime
  useEffect(() => {
    if (form.endDate && form.endTime) {
      // 종일 일정일 때는 항상 "23:59:59"로 설정 (더 정확한 종일 일정 표현)
      const timePart = form.isAllDay ? "23:59:59" : `${form.endTime}:00`;
      const combined = `${form.endDate} ${timePart}`;
      setForm((prev) => {
        if (prev.endDateTime === combined) return prev;
        return { ...prev, endDateTime: combined };
      });
    }
  }, [form.endDate, form.endTime, form.isAllDay]);

  // 시작 시간(시/분) → startTime
  useEffect(() => {
    if (form.startTimeHour !== undefined && form.startTimeMinute !== undefined) {
      // 종일 일정일 때는 항상 "00:00"으로 설정
      const combined = form.isAllDay 
        ? "00:00"
        : `${String(form.startTimeHour).padStart(2, '0')}:${String(form.startTimeMinute).padStart(2, '0')}`;
      setForm((prev) => {
        if (prev.startTime === combined) return prev;
        return { ...prev, startTime: combined };
      });
    }
  }, [form.startTimeHour, form.startTimeMinute, form.isAllDay]);

  // 종료 시간(시/분) → endTime
  useEffect(() => {
    if (form.endTimeHour !== undefined && form.endTimeMinute !== undefined) {
      // 종일 일정일 때는 항상 "23:59"로 설정
      const combined = form.isAllDay 
        ? "23:59"
        : `${String(form.endTimeHour).padStart(2, '0')}:${String(form.endTimeMinute).padStart(2, '0')}`;
      setForm((prev) => {
        if (prev.endTime === combined) return prev;
        return { ...prev, endTime: combined };
      });
    }
  }, [form.endTimeHour, form.endTimeMinute, form.isAllDay]);

  // 수정 모드일 때 일정 ID를 메모이제이션하여 참여자 일정 조회 시 항상 올바르게 전달
  const scheduleId = useMemo(() => {
    return isEdit && initialData ? initialData.id : null;
  }, [isEdit, initialData?.id]);

  // initialData의 날짜를 form과 동일한 방식으로 정규화 (checkAvailability에서 비교 시 사용)
  const normalizedInitialData = useMemo(() => {
    if (!isEdit || !initialData) return null;
    
    try {
      // toBackendFormat으로 일관된 형식으로 변환
      const normalizedStart = toBackendFormat(initialData.startDateTime);
      const normalizedEnd = toBackendFormat(initialData.endDateTime);
      
      if (!normalizedStart || !normalizedEnd) return null;
      
      // 종일 여부 판단
      const isAllDay = isAllDayEvent(initialData.startDateTime, initialData.endDateTime);
      
      // 정규화된 날짜에서 날짜와 시간 분리
      const startParts = normalizedStart.split(' ');
      const endParts = normalizedEnd.split(' ');
      
      // 날짜 검증
      const startDateStr = startParts[0] && /^\d{4}-\d{2}-\d{2}$/.test(startParts[0]) ? startParts[0] : '';
      const endDateStr = endParts[0] && /^\d{4}-\d{2}-\d{2}$/.test(endParts[0]) ? endParts[0] : '';
      
      // 시간/분 분리
      const startTimeStr = startParts[1] ? startParts[1].substring(0, 5) : '09:00';
      const endTimeStr = endParts[1] ? endParts[1].substring(0, 5) : '10:00';
      const startTimeParts = startTimeStr.split(':');
      const endTimeParts = endTimeStr.split(':');
      
      // 분(minute) 값을 5분 단위로 정규화하는 함수
      const normalizeMinute = (min) => {
        if (!min) return "0";
        const minNum = parseInt(min, 10);
        if (isNaN(minNum)) return "0";
        return String(Math.floor(minNum / 5) * 5).padStart(2, "0");
      };
      
      // 정규화된 분 값 계산
      const normalizedStartMinute = isAllDay ? "0" : normalizeMinute(startTimeParts[1]);
      const normalizedEndMinute = isAllDay ? "55" : normalizeMinute(endTimeParts[1]);
      
      // 종일 일정일 때는 시간을 명시적으로 설정
      const finalStartTime = isAllDay ? "00:00" : `${String(startTimeParts[0] || "9").padStart(2, "0")}:${normalizedStartMinute}`;
      const finalEndTime = isAllDay ? "23:59" : `${String(endTimeParts[0] || "10").padStart(2, "0")}:${normalizedEndMinute}`;
      
      // 정규화된 startDateTime과 endDateTime 재생성 (form과 동일한 로직)
      const finalNormalizedStart = startDateStr && finalStartTime ? `${startDateStr} ${finalStartTime}:00` : normalizedStart;
      const endTimePart = isAllDay ? "23:59:59" : `${finalEndTime}:00`;
      const finalNormalizedEnd = endDateStr && finalEndTime 
        ? `${endDateStr} ${endTimePart}` 
        : normalizedEnd;
      
      return {
        meetingRoomId: initialData.meetingRoomId || null,
        startDateTime: finalNormalizedStart,
        endDateTime: finalNormalizedEnd
      };
    } catch (err) {
      return null;
    }
  }, [isEdit, initialData]);

  // 유효한 categoryId 계산: 옵션 목록에 없으면 빈 문자열
  const validCategoryId = useMemo(() => {
    if (!form.categoryId) return "";
    const categoryIds = categories.map(cat => cat.id);
    const isValid = categoryIds.includes(form.categoryId);
    return isValid ? form.categoryId : "";
  }, [form.categoryId, categories]);

  // 유효한 meetingRoomId 계산: 옵션 목록에 없으면 빈 문자열
  const validMeetingRoomId = useMemo(() => {
    if (!form.meetingRoomId) return "";
    const roomIds = meetingRooms.map(room => room.id);
    const isValid = roomIds.includes(form.meetingRoomId);
    return isValid ? form.meetingRoomId : "";
  }, [form.meetingRoomId, meetingRooms]);

  /** 참석자 일정 현황 조회 */
  useEffect(() => {
    if (form.participantIds.length === 0 || !form.startDateTime || !form.endDateTime) {
      return;
    }

    const checkParticipantsAvailability = async () => {
      // 날짜 형식 검증: toBackendFormat이 null을 반환하면 API 호출 건너뛰기
      const normalizedStart = toBackendFormat(form.startDateTime);
      const normalizedEnd = toBackendFormat(form.endDateTime);
      
      if (!normalizedStart || !normalizedEnd) {
        // 날짜 형식이 유효하지 않으면 조회 건너뛰기 (간헐적 오류 방지)
        return;
      }
      
      try {
        // 수정 모드일 때 자기 자신의 일정 ID 전달 (메모이제이션된 값 사용)
        const availability = await getUsersAvailability(
          form.participantIds,
          normalizedStart,
          normalizedEnd,
          scheduleId
        );
        
        setAvailabilityMap({ ...availability });
      } catch (err) {
        showSnack("참석자 일정 현황을 불러오는 중 오류가 발생했습니다.", "error");
      }
    };
    checkParticipantsAvailability();
  }, [form.participantIds, form.startDateTime, form.endDateTime, form.isAllDay, scheduleId]);

  const filteredAvailabilityMap = useMemo(() => {
    if (!availabilityMap) return {};
    const currentIds = new Set(form.participantIds.map((id) => String(id)));
    return Object.entries(availabilityMap).reduce((acc, [userId, schedules]) => {
      if (currentIds.has(String(userId))) {
        acc[userId] = schedules;
      }
      return acc;
    }, {});
  }, [availabilityMap, form.participantIds]);

  /** 회의실 선택 시 시간대 기반으로 가용성 조회 */
  const handleRoomSelectOpen = async () => {
    if (!form.startDateTime || !form.endDateTime) {
      showSnack("먼저 시작 시간과 종료 시간을 입력하세요.", "warning");
      return;
    }

    try {
      const start = toBackendFormat(form.startDateTime);
      const end = toBackendFormat(form.endDateTime);
      const availableRooms = await getAvailableMeetingRooms(start, end, scheduleId);

      setMeetingRooms((prev) =>
        prev.map((room) => {
          const isAvailable = availableRooms.some((r) => r.id === room.id);
          return { ...room, availableYn: isAvailable };
        })
      );
      showSnack("현재 시간대 기준으로 사용 가능한 회의실들을 불러왔습니다.", "info");
    } catch (err) {
      showSnack("회의실 정보를 불러오는 중 오류가 발생했습니다.", "error");
    }
  };

  /** 회의실 예약 가능 여부 검사 */
  useEffect(() => {
    let isCancelled = false;
    
    const checkAvailability = async () => {
      // 종일 일정은 회의실 예약 검사 건너뛰기
      if (form.isAllDay) {
        if (!isCancelled) setRoomAvailable(true);
        return;
      }
      
      // 회의실이 선택되지 않았으면 검사 건너뛰기
      if (!form.meetingRoomId || !form.startDateTime || !form.endDateTime) {
        if (!isCancelled) setRoomAvailable(true);
        return;
      }
      
      // 수정 모드일 때: 회의실과 시간이 변경되지 않았으면 검사 건너뛰기
      if (isEdit && normalizedInitialData) {
        const meetingRoomMatch = normalizedInitialData.meetingRoomId && 
          String(form.meetingRoomId) === String(normalizedInitialData.meetingRoomId);
        const startDateTimeMatch = form.startDateTime === normalizedInitialData.startDateTime;
        const endDateTimeMatch = form.endDateTime === normalizedInitialData.endDateTime;
        
        // 회의실이 같고, 시작/종료 시간도 같으면 검사 건너뛰기
        if (meetingRoomMatch && startDateTimeMatch && endDateTimeMatch) {
          if (!isCancelled) setRoomAvailable(true);
          return;
        }
      }
      
      try {
        // 날짜 형식 검증: toBackendFormat이 null을 반환하면 API 호출 건너뛰기
        const normalizedStart = toBackendFormat(form.startDateTime);
        const normalizedEnd = toBackendFormat(form.endDateTime);
        
        if (!normalizedStart || !normalizedEnd) {
          if (!isCancelled) setRoomAvailable(true);
          return;
        }
        
        // API 호출 전에 현재 form 값 저장 (응답 검증용 - race condition 방지)
        const currentMeetingRoomId = form.meetingRoomId;
        const currentStartDateTime = form.startDateTime;
        const currentEndDateTime = form.endDateTime;
        
        // 수정 모드일 때 자기 자신의 일정 ID 전달 (메모이제이션된 값 사용)
        const result = await checkRoomAvailable(
          currentMeetingRoomId,
          normalizedStart,
          normalizedEnd,
          scheduleId
        );
        
        // 응답이 도착했을 때 현재 form 값과 비교하여 유효한 응답인지 확인
        const isStillValid = 
          !isCancelled &&
          form.meetingRoomId === currentMeetingRoomId &&
          form.startDateTime === currentStartDateTime &&
          form.endDateTime === currentEndDateTime;
        
        // 유효한 응답일 때만 상태 업데이트
        if (isStillValid) {
          setRoomAvailable(result.available);
        }
      } catch (err) {
        // 취소된 요청은 무시
        if (isCancelled) {
          return;
        }
        
        // 회의실 검사 실패 시 기본값으로 설정 (오류가 발생해도 일정 등록은 가능하도록)
        setRoomAvailable(true);
      }
    };
    
    checkAvailability();
    
    // cleanup: form 값이 변경되면 이전 요청 취소
    return () => {
      isCancelled = true;
    };
  }, [form.meetingRoomId, form.startDateTime, form.endDateTime, form.isAllDay, isEdit, normalizedInitialData, scheduleId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // 제목 입력 시 에러 상태 초기화
    if (name === "title" && value) {
      setTitleError(false);
    }
    // 카테고리 선택 시 에러 상태 초기화
    if (name === "categoryId" && value) {
      setCategoryError(false);
    }
  };

  /** 참석자별 상태 계산 함수 */
  const getParticipantStatus = (userId) => {
    // 수정 모드이고 현재 일정의 참여자 목록에 포함된 경우
    if (isEdit && initialData && initialData.participantIds && initialData.participantIds.includes(userId)) {
      return "participating";
    }
    
    // 등록 모드이고 현재 사용자인 경우 (본인은 항상 참여중)
    if (!isEdit && currentUserEmail) {
      const currentUser = users.find(u => u.id === userId);
      if (currentUser && currentUser.email === currentUserEmail) {
        return "participating";
      }
    }
    
    // 기존 로직: availabilityMap 확인
    const schedules = filteredAvailabilityMap[userId];
    return Array.isArray(schedules) && schedules.length > 0 ? "busy" : "free";
  };

  const handleSubmit = () => {
    // 제목 필수 검증
    if (!form.title || form.title.trim() === "") {
      setTitleError(true);
      showSnack("일정 제목을 입력해주세요.", "error");
      return;
    }
    setTitleError(false);
    
    // 카테고리 필수 검증
    if (!form.categoryId || form.categoryId === "") {
      setCategoryError(true);
      showSnack("카테고리를 선택해주세요.", "error");
      return;
    }
    setCategoryError(false);
    
    if (!roomAvailable && !form.isAllDay) {
      // 종일이 아닐 때만 회의실 예약 가능 여부 검사
      showSnack("이 시간대에는 선택한 회의실이 이미 예약되어 있습니다.", "warning");
      return;
    }
    
    // form.startDateTime과 form.endDateTime을 직접 사용 (useEffect에서 이미 동기화됨)
    // null 검증 추가
    if (!form.startDateTime || !form.endDateTime) {
      showSnack("시작 시간 또는 종료 시간이 올바르지 않습니다.", "error");
      return;
    }
    
    // toBackendFormat으로 최종 검증 (scheduleAPI.js에서도 검증하지만, 조기 검증으로 사용자 경험 개선)
    const normalizedStart = toBackendFormat(form.startDateTime);
    const normalizedEnd = toBackendFormat(form.endDateTime);
    
    if (!normalizedStart || !normalizedEnd) {
      showSnack("시작 시간 또는 종료 시간 형식이 올바르지 않습니다.", "error");
      return;
    }
    
    // 분리 필드(UI용)는 제외하고 전송
    const { 
      startDate, 
      startTime, 
      endDate, 
      endTime, 
      startTimeHour, 
      startTimeMinute, 
      endTimeHour, 
      endTimeMinute,
      isAllDay,
      ...payload 
    } = form;
    
    onSubmit({
      ...payload,
      startDateTime: normalizedStart,
      endDateTime: normalizedEnd
    }, isEdit);
  };

  // 오른쪽 패널에 넘길 '선택된 사용자 목록'
  const selectedUsers = useMemo(
    () => users.filter((u) => form.participantIds.includes(u.id)),
    [users, form.participantIds]
  );

  // 시간 옵션 (0~23시)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // 분 옵션 (5분 단위: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  // 종료 시간 옵션 생성 (동적 필터링)
  const endTimeHours = useMemo(() => {
    const isSameDay = form.startDate === form.endDate;
    
    if (isSameDay) {
      // 같은 날짜: 시작 시간 이후만 허용
      const startHour = Number(form.startTimeHour || 9);
      return hours.filter(h => h >= startHour);
    }
    // 다른 날짜: 모든 시간 허용
    return hours;
  }, [form.startDate, form.endDate, form.startTimeHour]);

  const endTimeMinutes = useMemo(() => {
    const isSameDay = form.startDate === form.endDate;
    
    if (isSameDay) {
      // 같은 날짜: 시작 시간과 같은 시간이면 시작 분 이후만 허용
      const startHour = Number(form.startTimeHour || 9);
      const endHour = Number(form.endTimeHour || 10);
      const startMinute = Number(form.startTimeMinute || 0);
      
      if (endHour === startHour) {
        // 같은 시간이면 시작 분 이후만 허용
        return minutes.filter(m => m > startMinute);
      }
    }
    // 다른 날짜이거나 다른 시간이면 모든 분 허용
    return minutes;
  }, [form.startDate, form.endDate, form.startTimeHour, form.startTimeMinute, form.endTimeHour]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="xl"
      fullWidth
      scroll="paper" // 내부 스크롤 자동 처리
      slotProps={{
        sx: {
          borderRadius: 2,
          p: 0,
        },
      }}
    >
      {/* 제목 영역 */}
      <DialogTitle sx={{ fontWeight: 600, borderBottom: "1px solid #ddd" }}>
        {isEdit ? "일정 수정" : "일정 등록"}
      </DialogTitle>

      {/* 내용 영역 (자동 스크롤) */}
      <DialogContent dividers sx={{p: 0, display: "flex", flexDirection: "row", height: "calc(100vh - 120px)", minHeight: "600px", overflow: "hidden"}}>
        <Box sx={{ flex: 1, p: 3, overflowY: "auto", minWidth: 600}}>
          <Stack spacing={2}>
            {/* 제목 + 종일 라디오 버튼 + 비공개 체크박스 */}
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField 
                label="제목" 
                name="title" 
                value={form.title} 
                onChange={handleChange} 
                sx={{ flex: 1 }}
                required
                error={titleError}
                helperText={titleError ? "일정 제목을 입력해주세요." : ""}
              />
              <FormControl>
                <RadioGroup
                  row
                  value={form.isAllDay ? "allDay" : "time"}
                  onChange={(e) => {
                    const isAllDay = e.target.value === "allDay";
                    
                    setForm(prev => {
                      if (isAllDay) {
                        // 종일 선택: 00:00 ~ 23:59로 설정
                        // endTimeMinute는 "55"로 설정 (minutes 배열에 있는 값)
                        // 하지만 endTime은 "23:59"로 직접 설정
                        return {
                          ...prev,
                          isAllDay: true,
                          startTimeHour: "0",
                          startTimeMinute: "0",
                          endTimeHour: "23",
                          endTimeMinute: "55", // minutes 배열에 있는 값 사용
                          startTime: "00:00",
                          endTime: "23:59", // 종일 일정은 항상 23:59
                          // 통합 필드도 업데이트
                          startDateTime: `${prev.startDate} 00:00:00`,
                          endDateTime: `${prev.endDate} 23:59:00`,
                          // 종일 일정은 회의실 예약 불가
                          meetingRoomId: ""
                        };
                      } else {
                        // 시간 지정 선택
                        return {
                          ...prev,
                          isAllDay: false,
                          // 기존 값이 없으면 기본값
                          startTimeHour: prev.startTimeHour || "9",
                          startTimeMinute: prev.startTimeMinute || "0",
                          endTimeHour: prev.endTimeHour || "10",
                          endTimeMinute: prev.endTimeMinute || "0",
                          startTime: prev.startTime || "09:00",
                          endTime: prev.endTime || "10:00"
                        };
                      }
                    });
                  }}
                >
                  <FormControlLabel value="time" control={<Radio />} label="시간 지정" />
                  <FormControlLabel value="allDay" control={<Radio />} label="종일" />
                </RadioGroup>
              </FormControl>
              {/* 비공개 체크박스 */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.visibility === "PRIVATE"}
                    onChange={(e) => {
                      setForm(prev => ({
                        ...prev,
                        visibility: e.target.checked ? "PRIVATE" : "PUBLIC"
                      }));
                    }}
                  />
                }
                label="비공개"
              />
            </Stack>
            <TextField label="내용" name="content" value={form.content} onChange={handleChange} fullWidth />
            <TextField label="장소" name="location" value={form.location} onChange={handleChange} fullWidth />

            {/* 카테고리 */}
            <TextField
              select
              required
              label="카테고리"
              name="categoryId"
              value={validCategoryId}
              onChange={handleChange}
              fullWidth
              error={categoryError}
              helperText={categoryError ? "카테고리를 선택해주세요." : ""}
            >
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>

            {/* 참석자 선택 + 상태 표시 */}
            <Autocomplete
              multiple
              options={users}
              groupBy={(option) => option.deptName || "소속 없음"}
              getOptionLabel={(option) => `${option.name} (${option.email})`}
              value={selectedUsers}
              onChange={(e, selected) =>
                setForm((prev) => ({
                  ...prev,
                  participantIds: selected.map((s) => s.id),
                }))
              }
              renderGroup={(params) => {
                const { key, group, children } = params;
                const deptName = group;
                const deptUsers = users.filter((u) => (u.deptName || "소속 없음") === deptName);
                const deptUserCount = deptUsers.length;
                
                return (
                  <li key={key}>
                    <ListSubheader
                      component="div"
                      onClick={(e) => {
                        e.stopPropagation();
                        // 해당 부서의 모든 사용자 찾기
                        // 이미 선택된 사용자 제외하고 추가
                        const newUsers = deptUsers.filter(
                          (u) => !selectedUsers.some((s) => s.id === u.id)
                        );
                        if (newUsers.length > 0) {
                          setForm((prev) => ({
                            ...prev,
                            participantIds: [
                              ...prev.participantIds,
                              ...newUsers.map((u) => u.id),
                            ],
                          }));
                        }
                      }}
                      sx={{
                        backgroundColor: "#e0e0e0",
                        color: "#666666",
                        fontWeight: 400,
                        fontSize: "1rem",
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "#d0d0d0",
                        },
                        py: 0.5,
                        px: 1,
                        minHeight: "auto",
                        lineHeight: 1.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <Box
                        component="img"
                        src="/coreconnect-logo.png"
                        alt="코어커넥트 로고"
                        onError={(e) => {
                          // 로고 로드 실패 시 vite.svg로 fallback
                          e.target.src = "/vite.svg";
                        }}
                        sx={{
                          height: 16,
                          width: "auto",
                          objectFit: "contain",
                        }}
                      />
                      {deptName} ({deptUserCount}명) - 클릭하여 전체 선택
                    </ListSubheader>
                    {children}
                  </li>
                );
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((option) => {
                    const status = getParticipantStatus(option.id);
                    let label, color;
                    
                    if (status === "participating") {
                      label = `${option.name} 🟦 참여중`;
                      color = "info";
                    } else if (status === "busy") {
                      label = `${option.name} 🟥 바쁨`;
                      color = "error";
                    } else {
                      label = `${option.name} 🟩 가능`;
                      color = "success";
                    }
                    
                    return (
                      <Chip
                        key={option.id}
                        label={label}
                        color={color}
                        onDelete={(e) => {
                          e.stopPropagation();
                          setForm((prev) => ({
                            ...prev,
                            participantIds: prev.participantIds.filter((id) => id !== option.id),
                          }));
                        }}
                      />
                    );
                  })}
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} label="참여자 초대" placeholder="검색 후 선택" />
              )}
            />

            {/* 참석자 중 일정 겹치는 사람 있을 때 경고 */}
            {Object.values(filteredAvailabilityMap).some((arr) => arr && arr.length > 0) && (
              <Alert severity="warning">
                일부 참석자는 이미 해당 날짜에 다른 일정이 있습니다.
              </Alert>
            )}

            {/* 날짜 및 시간 선택 (분리된 필드) */}
            <Stack direction="row" spacing={2} alignItems="center">
              {/* 시작 날짜 */}
              <TextField
                label="시작 날짜"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  const selected = e.target.value;
                  setForm((prev) => {
                    // 종료 날짜가 시작 날짜보다 이전이면 자동 조정
                    const newEndDate = prev.endDate && selected > prev.endDate ? selected : prev.endDate;
                    const isSameDay = selected === newEndDate;
                    
                    return {
                      ...prev,
                      startDate: selected,
                      endDate: newEndDate,
                      // 종일이면 시간은 유지 (00:00, 23:59)
                      // 시간 지정이면 날짜가 같아지면 종료 시간을 시작 시간 + 1시간으로 자동 조정
                      endTime: prev.isAllDay
                        ? prev.endTime  // 종일이면 유지
                        : (isSameDay && prev.startTimeHour !== undefined
                          ? (() => {
                              const hour = Number(prev.startTimeHour || 9);
                              const minute = prev.startTimeMinute || "0";
                              const nextHour = (hour + 1) % 24;
                              return `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                            })()
                          : prev.endTime), // 다른 날짜가 되면 기존 종료 시간 유지
                      // 분리 필드도 함께 업데이트
                      endTimeHour: prev.isAllDay
                        ? prev.endTimeHour  // 종일이면 유지
                        : (isSameDay && prev.startTimeHour !== undefined
                          ? String((Number(prev.startTimeHour || 9) + 1) % 24)
                          : prev.endTimeHour),
                      endTimeMinute: prev.isAllDay
                        ? prev.endTimeMinute  // 종일이면 유지
                        : (isSameDay && prev.startTimeMinute !== undefined
                          ? prev.startTimeMinute
                          : prev.endTimeMinute),
                      // 통합 필드 업데이트
                      startDateTime: prev.isAllDay
                        ? `${selected} 00:00:00`
                        : `${selected} ${prev.startTime}:00`
                    };
                  });
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1 }}
              />
              {/* 시작 시간 (종일이 아닐 때만 표시) */}
              {!form.isAllDay && (
                <Stack direction="row" spacing={1}>
                  <FormControl sx={{ minWidth: 80 }}>
                    <InputLabel>시</InputLabel>
                    <Select
                      value={Number(form.startTimeHour) || 9}
                      onChange={(e) => {
                        const hour = e.target.value;
                        const minute = form.startTimeMinute || "0";
                        // 통합 필드 업데이트
                        const combined = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        // 종료 시간도 자동 업데이트
                        const nextHour = (Number(hour) + 1) % 24;
                        const nextTime = `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        
                        setForm(prev => ({
                          ...prev,
                          startTimeHour: String(hour),
                          startTime: combined,
                          endTimeHour: String(nextHour),
                          endTime: nextTime
                        }));
                      }}
                      label="시"
                    >
                      {hours.map(h => (
                        <MenuItem key={h} value={h}>{h}시</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 80 }}>
                    <InputLabel>분</InputLabel>
                    <Select
                      value={(() => {
                        // 디버깅: 분 값 검증 및 정규화
                        const currentValue = form.startTimeMinute || "0";
                        const numericValue = typeof currentValue === "string" ? parseInt(currentValue, 10) : currentValue;
                        const isValid = !isNaN(numericValue) && minutes.includes(numericValue);
                        const normalizedValue = isValid ? String(numericValue) : "0";
                        return normalizedValue;
                      })()}
                      disabled={form.isAllDay}
                      onChange={(e) => {
                        const minute = e.target.value;
                        const hour = form.startTimeHour || "9";
                        // 통합 필드 업데이트
                        const combined = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        // 종료 시간도 자동 업데이트
                        const nextHour = (Number(hour) + 1) % 24;
                        const nextTime = `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        
                        setForm(prev => ({
                          ...prev,
                          startTimeMinute: minute,
                          startTime: combined,
                          endTimeHour: String(nextHour),
                          endTime: nextTime
                        }));
                      }}
                      label="분"
                    >
                      {minutes.map(m => (
                        <MenuItem key={m} value={String(m)}>{m}분</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}
              {/* 구분선 */}
              <Typography sx={{ mt: 2 }}>-</Typography>
              {/* 종료 날짜 */}
              <TextField
                label="종료 날짜"
                type="date"
                value={form.endDate}
                onChange={(e) => {
                  const selected = e.target.value;
                  // 시작 날짜보다 이전이면 경고
                  if (form.startDate && selected < form.startDate) {
                    showSnack("종료 날짜는 시작 날짜 이후여야 합니다.", "warning");
                    return;
                  }
                  
                  setForm((prev) => {
                    const isSameDay = prev.startDate === selected;
                    
                    return {
                      ...prev,
                      endDate: selected,
                      // 종일이면 시간은 유지 (00:00, 23:59)
                      // 시간 지정이면 날짜가 같아지면 종료 시간을 시작 시간 + 1시간으로 자동 조정
                      endTime: prev.isAllDay
                        ? prev.endTime  // 종일이면 유지
                        : (isSameDay && prev.startTimeHour !== undefined
                          ? (() => {
                              const hour = Number(prev.startTimeHour || 9);
                              const minute = prev.startTimeMinute || "0";
                              const nextHour = (hour + 1) % 24;
                              return `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                            })()
                          : prev.endTime), // 다른 날짜가 되면 기존 종료 시간 유지
                      // 분리 필드도 함께 업데이트
                      endTimeHour: prev.isAllDay
                        ? prev.endTimeHour  // 종일이면 유지
                        : (isSameDay && prev.startTimeHour !== undefined
                          ? String((Number(prev.startTimeHour || 9) + 1) % 24)
                          : prev.endTimeHour),
                      endTimeMinute: prev.isAllDay
                        ? prev.endTimeMinute  // 종일이면 유지
                        : (isSameDay && prev.startTimeMinute !== undefined
                          ? prev.startTimeMinute
                          : prev.endTimeMinute),
                      // 통합 필드 업데이트
                      endDateTime: prev.isAllDay
                        ? `${selected} 23:59:00`
                        : `${selected} ${prev.endTime}:00`
                    };
                  });
                }}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: {
                    min: form.startDate || undefined, // 시작 날짜 이전 선택 불가
                  },
                }}
                sx={{ flex: 1 }}
              />
              {/* 종료 시간 (종일이 아닐 때만 표시) */}
              {!form.isAllDay && (
                <Stack direction="row" spacing={1}>
                  <FormControl sx={{ minWidth: 80 }}>
                    <InputLabel>시</InputLabel>
                    <Select
                      value={(() => {
                        const currentValue = form.endTimeHour;
                        const numericValue = Number(currentValue);
                        const availableOptions = endTimeHours;
                        
                        // currentValue가 availableOptions에 있는지 확인
                        let finalValue = numericValue;
                        if (!availableOptions.includes(finalValue)) {
                          // 유효하지 않은 값이면 availableOptions의 첫 번째 값 사용
                          finalValue = availableOptions.length > 0 ? availableOptions[0] : 10;
                        }
                        
                        return finalValue;
                      })()}
                      onChange={(e) => {
                        const hour = e.target.value;
                        const minute = form.endTimeMinute || "0";
                        const combined = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        setForm(prev => ({
                          ...prev,
                          endTimeHour: String(hour),
                          endTime: combined
                        }));
                      }}
                      label="시"
                    >
                      {endTimeHours.map(h => (
                        <MenuItem key={h} value={h}>{h}시</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl sx={{ minWidth: 80 }}>
                    <InputLabel>분</InputLabel>
                    <Select
                      value={(() => {
                        // 디버깅: 분 값 검증 및 정규화
                        const currentValue = form.endTimeMinute || "0";
                        const numericValue = typeof currentValue === "string" ? parseInt(currentValue, 10) : currentValue;
                        const isValid = !isNaN(numericValue) && endTimeMinutes.includes(numericValue);
                        const normalizedValue = isValid ? String(numericValue) : "0";
                        return normalizedValue;
                      })()}
                      disabled={form.isAllDay}
                      onChange={(e) => {
                        const minute = e.target.value;
                        const hour = form.endTimeHour || "10";
                        const combined = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        setForm(prev => ({
                          ...prev,
                          endTimeMinute: minute,
                          endTime: combined
                        }));
                      }}
                      label="분"
                    >
                      {endTimeMinutes.map(m => (
                        <MenuItem key={m} value={String(m)}>{m}분</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}
            </Stack>

            {/* 회의실 */}
            <FormControl fullWidth>
              <InputLabel id="meetingRoom-label">회의실</InputLabel>
              <Select
                labelId="meetingRoom-label"
                name="meetingRoomId"
                value={validMeetingRoomId}
                label="회의실"
                disabled={form.isAllDay}  // 종일일 때 비활성화
                onOpen={handleRoomSelectOpen}   // 드롭다운이 열릴 때 바로 실행됨
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>회의실 선택 안함</em>
                </MenuItem>
                {meetingRooms.map((room) => {
                  const isCurrentRoom = isEdit && initialData && initialData.meetingRoomId === room.id;
                  const isUnavailable = !room.availableYn;
                  
                  let statusText = "";
                  if (isCurrentRoom) {
                    statusText = "(사용중)";
                  } else if (isUnavailable) {
                    statusText = "(예약 불가)";
                  }
                  
                  return (
                    <MenuItem 
                      key={room.id} 
                      value={room.id} 
                      disabled={isUnavailable && !isCurrentRoom} // 사용중인 회의실은 비활성화하지 않음
                    >
                      {room.name} {statusText}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {form.isAllDay && (
              <Alert severity="info">
                종일 일정은 회의실 예약을 사용할 수 없습니다.
              </Alert>
            )}

            {!roomAvailable && !form.isAllDay && (
              <Alert severity="warning">
                선택한 시간에는 해당 회의실이 이미 예약되어 있습니다.
              </Alert>
            )}
          </Stack>
        </Box>

        {/* 오른쪽 참석자 일정표 */}
        <Box sx={{width: "auto", minWidth: 720, borderLeft: "1px solid #ddd", overflowY: "auto", overflowX: "hidden", backgroundColor: "#fafafa"}}>
          <AttendeeTimelinePanel
            users={selectedUsers}
            availabilityMap={filteredAvailabilityMap}
            startDateTime={form.startDateTime || null}
            endDateTime={form.endDateTime || null}
          />
        </Box>
      </DialogContent>

      {/* 하단 버튼 (항상 고정) */}
      <DialogActions sx={{ borderTop: "1px solid #ddd", p: 2 }}>
        {isEdit && initialData?.userEmail === currentUserEmail && (
          <Button color="error" onClick={() => onDelete(initialData.id)}>
            삭제
          </Button>
        )}
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {isEdit ? "수정" : "등록"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
