import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, ButtonGroup, Button, InputBase, Divider, Checkbox, Chip, Pagination, Badge, Tabs, Tab,
  Menu, MenuItem, Select, LinearProgress, CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ReplyIcon from '@mui/icons-material/Reply';
import DeleteIcon from '@mui/icons-material/Delete';
import ForwardIcon from '@mui/icons-material/Forward';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SyncIcon from '@mui/icons-material/Sync';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { fetchInbox, fetchUnreadCount, moveToTrash, markMailAsRead, getEmailDetail } from '../api/emailApi';
import { useNavigate, useLocation } from 'react-router-dom';
import { MailCountContext } from "../../../App"; // 메일 카운트 컨텍스트(사이드바 등 공유)
import { UserProfileContext } from "../../../App";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";
import { UNREAD_REFRESH_FLAG, UNREAD_PENDING_IDS_KEY } from "../constants";

const MailInboxPage = () => {
  const { showSnack } = useSnackbarContext();
  // 상태변수 선언
  const [tab, setTab] = useState("all"); // 전체/오늘/안읽음
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10); // 페이지당 항목 수 (5 또는 10 선택 가능)
  const [total, setTotal] = useState(0);
  const [sizeMenuAnchor, setSizeMenuAnchor] = useState(null); // 페이지 크기 선택 메뉴
  const [mails, setMails] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0); // Chip/Badge
  const [selected, setSelected] = useState(new Set());
  const [searchType, setSearchType] = useState("TITLE_CONTENT");
  const [appliedSearchType, setAppliedSearchType] = useState("TITLE_CONTENT");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // 날짜 정렬 순서: "desc" (내림차순, 최신순), "asc" (오름차순, 오래된순)
  const [isRefreshing, setIsRefreshing] = useState(false); // 새로고침 로딩 상태
  const [isLoading, setIsLoading] = useState(false); // 초기 로딩 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const pendingReadIdsRef = useRef(new Set());
  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email;
  const navigate = useNavigate();
  const location = useLocation();
  const mailCountContext = useContext(MailCountContext);
  const setUnreadCountDirectly = mailCountContext?.setUnreadCountDirectly;

  // 쿼리파라미터에 따라 탭 상태 반영
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabQuery = searchParams.get('tab');
    if (tabQuery && ["all", "today", "unread"].includes(tabQuery) && tab !== tabQuery) {
      setTab(tabQuery);
    }
  }, [location.search, tab]);

  // 메일상태 라벨/칼라 변환
  const formatMailStatusLabel = (status) => {
    switch (status) {
      case "SENT": return "수신완료";
      case "TRASH": return "휴지통";
      case "DELETED": return "삭제됨";
      default: return status || "-";
    }
  };
  const formatMailStatusColor = (status) => {
    switch (status) {
      case "SENT": return "success";
      case "TRASH": return "warning";
      case "DELETED": return "error";
      default: return "default";
    }
  };

  const loadPendingIdsFromStorage = () => {
    try {
      const raw = sessionStorage.getItem(UNREAD_PENDING_IDS_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.filter(id => typeof id === "number"));
    } catch (err) {
      console.error("[MailInboxPage] loadPendingIdsFromStorage error", err);
      return new Set();
    }
  };

  const persistPendingIds = () => {
    const ids = Array.from(pendingReadIdsRef.current);
    if (ids.length === 0) {
      sessionStorage.removeItem(UNREAD_PENDING_IDS_KEY);
    } else {
      sessionStorage.setItem(UNREAD_PENDING_IDS_KEY, JSON.stringify(ids));
    }
  };

  // 받은메일함 목록 로딩
  const loadInbox = async (
    pageIdx = page,
    pageSize = size,
    activeTab = tab,
    keywordParam = appliedKeyword,
    searchTypeParam = appliedSearchType,
    showLoading = true
  ) => {
    if (!userEmail) {
      console.warn("[MailInboxPage] loadInbox: userEmail이 없어서 메일 목록을 불러오지 않습니다.", {
        userProfile,
        userEmail
      });
      setMails([]);
      setTotal(0);
      return;
    }
    
    console.log("[MailInboxPage] loadInbox 호출:", {
      userEmail,
      pageIdx,
      pageSize,
      activeTab,
      keywordParam,
      searchTypeParam
    });
    
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      // 서버에서 삭제된 메일이 제외되어 반환됨(DB/JPQL 필터)
      const res = await fetchInbox(
        userEmail,
        pageIdx - 1,
        pageSize,
        activeTab === "all" ? null : activeTab,
        null,
        null,
        searchTypeParam,
        keywordParam
      );
      
      console.log("[MailInboxPage] fetchInbox 응답:", res);
      
      const boxData = res?.data?.data;
      const mailList = Array.isArray(boxData?.content) ? boxData.content : [];
      
      console.log("[MailInboxPage] 메일 목록:", {
        mailListLength: mailList.length,
        totalElements: boxData?.totalElements,
        boxData
      });

      if (activeTab === "unread") {
        // 안읽은 메일 탭: 서버에서 읽음 처리된 메일도 필터링
        console.log("[MailInboxPage] 안읽은 메일 탭 필터링 시작:", {
          mailListLength: mailList.length,
          pendingReadIdsSize: pendingReadIdsRef.current.size,
          pendingReadIds: Array.from(pendingReadIdsRef.current)
        });

        // 1단계: 서버에서 읽음 처리된 메일 필터링 및 pendingReadIds 정리
        const readMailIdsFromServer = new Set();
        const actuallyUnreadMails = mailList.filter(mail => {
          // emailReadYn이 true이면 읽음 처리된 메일이므로 제외
          if (mail.emailReadYn === true) {
            readMailIdsFromServer.add(mail.emailId);
            return false;
          }
          // pendingReadIds에 있는 메일도 제외 (Optimistic Update)
          if (pendingReadIdsRef.current.has(mail.emailId)) {
            return false;
          }
          return true;
        });

        console.log("[MailInboxPage] 필터링 결과:", {
          readMailIdsFromServer: Array.from(readMailIdsFromServer),
          actuallyUnreadMailsLength: actuallyUnreadMails.length,
          actuallyUnreadMailsIds: actuallyUnreadMails.map(m => m.emailId)
        });

        // 2단계: pendingReadIds 정리
        // - 서버에서 읽음 처리된 메일 ID는 pendingReadIds에서 제거 (DB 반영 완료)
        // - 서버에서 반환되지 않는 ID도 제거 (DB 반영 완료)
        // - 서버에서 여전히 안읽은 메일로 반환되는 ID만 유지 (아직 DB 반영 안 된 경우)
        if (pendingReadIdsRef.current.size > 0 || readMailIdsFromServer.size > 0) {
          const idsFromServer = new Set(mailList.map(m => m.emailId));
          const stillPending = new Set();
          
          pendingReadIdsRef.current.forEach(id => {
            // 서버에서 읽음 처리된 메일이면 제거 (DB 반영 완료)
            if (readMailIdsFromServer.has(id)) {
              console.log("[MailInboxPage] pendingReadIds에서 제거 (서버에서 읽음 처리됨):", id);
              return; // 제거
            }
            // 서버에서 여전히 안읽은 메일로 반환되는 경우만 유지 (아직 DB 반영 안 된 경우)
            if (idsFromServer.has(id)) {
              stillPending.add(id);
              console.log("[MailInboxPage] pendingReadIds 유지 (서버에서 여전히 반환됨):", id);
            } else {
              console.log("[MailInboxPage] pendingReadIds에서 제거 (서버에서 반환되지 않음):", id);
            }
          });
          
          pendingReadIdsRef.current = stillPending;
          persistPendingIds();
          
          console.log("[MailInboxPage] pendingReadIds 정리 완료:", {
            before: Array.from(pendingReadIdsRef.current),
            after: Array.from(stillPending),
            removed: Array.from(readMailIdsFromServer)
          });
        }

        const listForState = actuallyUnreadMails;
        setMails(listForState);
        const serverTotal = typeof boxData?.totalElements === "number" ? boxData.totalElements : 0;
        // 서버에서 읽음 처리된 메일 수를 계산하여 총 개수 조정
        const readMailsCount = readMailIdsFromServer.size;
        const adjustedTotal = Math.max(0, serverTotal - readMailsCount - pendingReadIdsRef.current.size);
        setTotal(adjustedTotal);
        
        console.log("[MailInboxPage] 최종 상태:", {
          listForStateLength: listForState.length,
          serverTotal,
          readMailsCount,
          pendingReadIdsSize: pendingReadIdsRef.current.size,
          adjustedTotal
        });
        
        // selected 상태 업데이트
        setSelected(prev => {
          const idsOnPage = new Set(listForState.map(m => m.emailId));
          const newSet = new Set([...prev].filter(id => idsOnPage.has(id)));
          return newSet;
        });
      } else {
        // 다른 탭에서는 pendingReadIds 초기화하지 않음 (탭 전환 시 상태 유지)
        const listForState = mailList;
        setMails(listForState);
        const serverTotal = typeof boxData?.totalElements === "number" ? boxData.totalElements : 0;
        setTotal(serverTotal);
        
        // selected 상태 업데이트
        setSelected(prev => {
          const idsOnPage = new Set(listForState.map(m => m.emailId));
          const newSet = new Set([...prev].filter(id => idsOnPage.has(id)));
          return newSet;
        });
      }
    } catch (err) {
      console.error("fetchInbox error", err);
      setMails([]);
      setTotal(0);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const decrementUnreadCounters = (count = 1) => {
    if (!count || count <= 0) return;
    setUnreadCount(prev => Math.max(0, prev - count));
    if (typeof setUnreadCountDirectly === "function") {
      setUnreadCountDirectly(prev => Math.max(0, prev - count));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadInbox(1, size, tab, appliedKeyword, appliedSearchType, false),
        loadUnreadCount()
      ]);
    } catch (err) {
      console.error("handleRefresh error", err);
      showSnack('메일 목록 새로고침 중 오류가 발생했습니다.', 'error');
    } finally {
      // 로딩바가 잠깐 보이도록 최소 시간 대기 (UX 개선)
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  };

  // 답장 핸들러
  const handleReply = async () => {
    if (selected.size === 0) {
      showSnack('답장할 메일을 선택해주세요.', 'warning');
      return;
    }

    // 선택된 메일 중 첫 번째 메일 사용
    const selectedMailId = Array.from(selected)[0];
    const selectedMail = mails.find(m => m.emailId === selectedMailId);
    
    if (!selectedMail) {
      showSnack('선택한 메일을 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      // 메일 상세 정보 가져오기 (cc, bcc 정보 포함)
      const detailRes = await getEmailDetail(selectedMailId, userEmail);
      const mailDetail = detailRes?.data?.data || selectedMail;

      // 답장 정보 구성
      const replyData = {
        originalEmail: {
          emailId: mailDetail.emailId,
          senderEmail: mailDetail.senderEmail || selectedMail.senderEmail,
          senderName: mailDetail.senderName || selectedMail.senderName,
          emailTitle: mailDetail.emailTitle || selectedMail.emailTitle,
          sentTime: mailDetail.sentTime || mailDetail.emailSentTime || selectedMail.sentTime,
          recipientAddresses: mailDetail.recipientAddresses || selectedMail.recipientAddresses || [],
          ccAddresses: mailDetail.ccAddresses || [],
          bccAddresses: mailDetail.bccAddresses || [],
          emailContent: mailDetail.emailContent || ''
        }
      };

      // 메일쓰기 페이지로 이동 (location.state로 답장 정보 전달)
      navigate('/email/write', { state: { replyData } });
    } catch (err) {
      console.error("handleReply error", err);
      showSnack('메일 상세 정보를 가져오는 중 오류가 발생했습니다.', 'error');
    }
  };

  // 전달 핸들러
  const handleForward = async () => {
    if (selected.size === 0) {
      showSnack('전달할 메일을 선택해주세요.', 'warning');
      return;
    }

    // 선택된 메일 중 첫 번째 메일 사용
    const selectedMailId = Array.from(selected)[0];
    const selectedMail = mails.find(m => m.emailId === selectedMailId);
    
    if (!selectedMail) {
      showSnack('선택한 메일을 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      // 메일 상세 정보 가져오기 (cc, bcc 정보 포함)
      const detailRes = await getEmailDetail(selectedMailId, userEmail);
      const mailDetail = detailRes?.data?.data || selectedMail;

      // 전달 정보 구성
      const forwardData = {
        originalEmail: {
          emailId: mailDetail.emailId,
          senderEmail: mailDetail.senderEmail || selectedMail.senderEmail,
          senderName: mailDetail.senderName || selectedMail.senderName,
          emailTitle: mailDetail.emailTitle || selectedMail.emailTitle,
          sentTime: mailDetail.sentTime || mailDetail.emailSentTime || selectedMail.sentTime,
          recipientAddresses: mailDetail.recipientAddresses || selectedMail.recipientAddresses || [],
          ccAddresses: mailDetail.ccAddresses || [],
          bccAddresses: mailDetail.bccAddresses || [],
          emailContent: mailDetail.emailContent || ''
        }
      };

      // 메일쓰기 페이지로 이동 (location.state로 전달 정보 전달)
      navigate('/email/write', { state: { forwardData } });
    } catch (err) {
      console.error("handleForward error", err);
      showSnack('메일 상세 정보를 가져오는 중 오류가 발생했습니다.', 'error');
    }
  };

  // 날짜순 정렬 토글 핸들러
  const handleSortByDate = () => {
    setSortOrder(prev => prev === "desc" ? "asc" : "desc");
  };

  // 메일 목록을 날짜순으로 정렬
  const sortedMails = useMemo(() => {
    if (!Array.isArray(mails) || mails.length === 0) return mails;
    
    const sorted = [...mails].sort((a, b) => {
      const dateA = a.sentTime ? new Date(a.sentTime).getTime() : 0;
      const dateB = b.sentTime ? new Date(b.sentTime).getTime() : 0;
      
      if (sortOrder === "asc") {
        // 오름차순: 오래된 메일부터
        return dateA - dateB;
      } else {
        // 내림차순: 최신 메일부터 (기본값)
        return dateB - dateA;
      }
    });
    
    return sorted;
  }, [mails, sortOrder]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const keyword = search.trim();
    const type = searchType;
    setAppliedSearchType(type);
    setAppliedKeyword(keyword);
    setPage(1);
    loadInbox(1, size, tab, keyword, type);
  };

  // 탭/페이지 등 변경시 메일함 새로고침
  useEffect(() => {
    // 탭이 변경될 때 pendingReadIds를 세션 스토리지에서 다시 로드
    if (tab === "unread") {
      const loadedIds = loadPendingIdsFromStorage();
      pendingReadIdsRef.current = loadedIds;
      console.log("[MailInboxPage] 안읽은 메일 탭으로 전환 - pendingReadIds 로드:", {
        loadedIds: Array.from(loadedIds),
        size: loadedIds.size
      });
    } else {
      // 다른 탭으로 전환할 때는 pendingReadIds를 유지 (초기화하지 않음)
      console.log("[MailInboxPage] 다른 탭으로 전환 - pendingReadIds 유지:", {
        pendingReadIds: Array.from(pendingReadIdsRef.current),
        size: pendingReadIdsRef.current.size
      });
    }
    loadInbox();
    // eslint-disable-next-line
  }, [userEmail, page, size, tab, appliedKeyword, appliedSearchType, location.key]);

  // 페이지 포커스 시 목록 새로고침 (뒤로가기 시 목록 업데이트)
  useEffect(() => {
    const handleFocus = () => {
      if (userEmail && tab === "unread") {
        loadInbox();
        loadUnreadCount();
        // 사이드바 뱃지도 업데이트
        if (mailCountContext?.refreshUnreadCount) {
          mailCountContext.refreshUnreadCount();
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, tab]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && userEmail && tab === "unread") {
        loadInbox();
        loadUnreadCount();
        // 사이드바 뱃지도 업데이트
        if (mailCountContext?.refreshUnreadCount) {
          mailCountContext.refreshUnreadCount();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, tab]);

  // 안읽은 메일 목록 새로고침 이벤트 리스너 (MailDetailPage에서 메일을 읽을 때 발생)
  useEffect(() => {
    pendingReadIdsRef.current = loadPendingIdsFromStorage();
  }, []);

  useEffect(() => {
    const handleRefreshUnreadMailList = () => {
      if (userEmail && tab === "unread") {
        // DB 반영을 위한 대기 후 목록 새로고침 (대기 시간 증가)
        setTimeout(async () => {
          try {
            await loadInbox(page, size, "unread");
            await loadUnreadCount();
            // 사이드바 뱃지도 업데이트
            if (mailCountContext?.refreshUnreadCount) {
              await mailCountContext.refreshUnreadCount();
            }
            // 받은 메일함 전체 개수도 업데이트
            if (mailCountContext?.refreshInboxCount) {
              await mailCountContext.refreshInboxCount();
            }
          } catch (err) {
            console.error("handleRefreshUnreadMailList error:", err);
          }
        }, 800); // 500ms -> 800ms로 증가하여 DB 반영 시간 확보
      }
    };
    
    window.addEventListener('refreshUnreadMailList', handleRefreshUnreadMailList);
    return () => window.removeEventListener('refreshUnreadMailList', handleRefreshUnreadMailList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, tab, page, size]);

  useEffect(() => {
    if (tab !== "unread") return;
    const shouldRefresh = sessionStorage.getItem(UNREAD_REFRESH_FLAG);
    if (shouldRefresh === 'true') {
      sessionStorage.removeItem(UNREAD_REFRESH_FLAG);
      (async () => {
        try {
          await loadInbox(page, size, "unread");
          await loadUnreadCount();
        } catch (err) {
          console.error("[MailInboxPage] unread refresh sync error", err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, location.key]);

  // 안읽은 개수 fetch + 컨텍스트 연동
  const loadUnreadCount = async () => {
    if (!userEmail) return;
    try {
      const count = await fetchUnreadCount(userEmail);
      const finalCount = count || 0;
      setUnreadCount(finalCount);
      // 컨텍스트도 직접 업데이트하여 사이드바에 반영 (refreshUnreadCount, refreshInboxCount 호출)
      if (mailCountContext?.refreshUnreadCount) {
        await mailCountContext.refreshUnreadCount();
      }
      if (mailCountContext?.refreshInboxCount) {
        await mailCountContext.refreshInboxCount();
      }
    } catch (err) {
      console.error("loadUnreadCount error:", err);
      setUnreadCount(0);
      if (mailCountContext?.refreshUnreadCount) {
        await mailCountContext.refreshUnreadCount();
      }
    }
  };
  useEffect(() => {
    loadUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // 개별 행 선택/토글
  const toggleSelect = (mailId) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(mailId)) s.delete(mailId);
      else s.add(mailId);
      return s;
    });
  };

  // 전체선택/해제 토글
  const toggleSelectAll = () => {
    setSelected(prev => {
      const idsOnPage = mails.map(m => m.emailId);
      const allSelected = idsOnPage.every(id => prev.has(id));
      if (allSelected) {
        const s = new Set(prev);
        idsOnPage.forEach(id => s.delete(id));
        return s;
      } else {
        const s = new Set(prev);
        idsOnPage.forEach(id => s.add(id));
        return s;
      }
    });
  };

  // 선택된 메일들 읽음 처리
  const markSelectedAsRead = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      showSnack('읽음 처리할 메일을 선택하세요.', 'warning');
      return;
    }
    if (!userEmail) {
      showSnack('사용자 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      // 선택된 메일들 중 안읽은 메일만 필터링
      const unreadMails = mails.filter(mail => 
        ids.includes(mail.emailId) && 
        (mail.emailReadYn === false || mail.emailReadYn === null || mail.emailReadYn === undefined)
      );
      
      if (unreadMails.length === 0) {
        showSnack('선택한 메일은 이미 읽음 처리된 메일입니다.', 'info');
        return;
      }

      // 각 메일을 읽음 처리
      console.log("[MailInboxPage] markSelectedAsRead: 읽음 처리 시작:", {
        unreadMailsCount: unreadMails.length,
        emailIds: unreadMails.map(m => m.emailId)
      });
      
      const readPromises = unreadMails.map(async (mail) => {
        try {
          console.log("[MailInboxPage] markSelectedAsRead: 개별 메일 읽음 처리 시작:", { emailId: mail.emailId });
          const result = await markMailAsRead(mail.emailId, userEmail);
          console.log("[MailInboxPage] markSelectedAsRead: 개별 메일 읽음 처리 응답:", { emailId: mail.emailId, result });
          return { emailId: mail.emailId, success: result?.data?.data === true };
        } catch (error) {
          console.error("[MailInboxPage] markSelectedAsRead: 개별 메일 읽음 처리 에러:", { emailId: mail.emailId, error });
          return { emailId: mail.emailId, success: false, error };
        }
      });
      
      const results = await Promise.all(readPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log("[MailInboxPage] markSelectedAsRead: 읽음 처리 완료:", {
        successCount,
        failCount,
        results
      });
      
      if (failCount > 0) {
        console.warn("[MailInboxPage] markSelectedAsRead: 일부 메일 읽음 처리 실패:", {
          failedIds: results.filter(r => !r.success).map(r => r.emailId)
        });
      }

      if (unreadMails.length > 0) {
        decrementUnreadCounters(unreadMails.length);
      }

      // 안읽은 메일 탭인 경우 읽음 처리된 메일들을 목록에서 즉시 제거 (Optimistic Update)
      if (tab === "unread") {
        const readMailIds = new Set(unreadMails.map(m => m.emailId));
        readMailIds.forEach(id => pendingReadIdsRef.current.add(id));
        persistPendingIds();
        setMails(prev => prev.filter(m => !readMailIds.has(m.emailId)));
        setTotal(prev => Math.max(0, prev - readMailIds.size));
      }

      // 선택 상태 초기화
      setSelected(new Set());
      
      showSnack(`${unreadMails.length}개의 메일을 읽음 처리했습니다.`, 'success');

      // DB 반영 후 목록 새로고침 (안읽은 메일 탭인 경우)
      if (tab === "unread") {
        setTimeout(async () => {
          try {
            await loadInbox(page, size, "unread");
            await loadUnreadCount();
            // 사이드바 뱃지 업데이트
            if (mailCountContext?.refreshUnreadCount) {
              await mailCountContext.refreshUnreadCount();
            }
            // 받은 메일함 전체 개수도 업데이트
            if (mailCountContext?.refreshInboxCount) {
              await mailCountContext.refreshInboxCount();
            }
          } catch (err) {
            console.error("loadInbox error after mark as read", err);
          }
        }, 800);
      } else {
        // 다른 탭에서는 안읽은 메일 개수와 받은 메일함 개수 업데이트
        setTimeout(async () => {
          await loadUnreadCount();
          // 사이드바 뱃지 업데이트
          if (mailCountContext?.refreshUnreadCount) {
            await mailCountContext.refreshUnreadCount();
          }
          // 받은 메일함 전체 개수도 업데이트
          if (mailCountContext?.refreshInboxCount) {
            await mailCountContext.refreshInboxCount();
          }
        }, 500);
      }
    } catch (err) {
      console.error('markSelectedAsRead error', err);
      showSnack('메일 읽음 처리 중 오류가 발생했습니다.', 'error');
    }
  };

  // 선택된 메일들 휴지통으로 이동 (moveToTrash 호출)
  const deleteSelected = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      showSnack('삭제할 메일을 선택하세요.', 'warning');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    const ids = Array.from(selected);
    setDeleteDialogOpen(false);

    try {
      await moveToTrash(ids); // 휴지통으로 이동
      showSnack(`${ids.length}개의 메일을 휴지통으로 이동했습니다.`, 'success');
      setSelected(prev => {
        const s = new Set(prev);
        ids.forEach(id => s.delete(id));
        return s;
      });
      await loadInbox();      // 새로고침: 이동한 항목 즉시 사라짐
      await loadUnreadCount();// 언리드카운트까지 새로고침
      // 받은 메일함 전체 개수도 새로고침
      if (mailCountContext?.refreshInboxCount) {
        await mailCountContext.refreshInboxCount();
      }
    } catch (err) {
      console.error('deleteSelected error', err);
      showSnack('메일 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 날짜 포맷 (YYYY-MM-DD HH:mm) - 한국 시간 기준
  const formatSentTime = (sentTime) => {
    if (!sentTime) return '-';
    try {
      let d;
      const dateStr = String(sentTime);
      
      // ISO 8601 형식인 경우 (서버에서 "2025-11-25T00:42:00" 형식으로 보냄)
      if (dateStr.includes('T')) {
        // 타임존 정보가 없으면 한국 시간(UTC+9)으로 간주하여 파싱
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
          // "2025-11-25T00:42:00" 형식을 한국 시간으로 파싱
          const [datePart, timePart] = dateStr.split('T');
          const [year, month, day] = datePart.split('-');
          const [timeOnly] = (timePart || '').split('.');
          const [hour, minute, second = '00'] = (timeOnly || '').split(':');
          
          // UTC로 Date 객체 생성 후 한국 시간(UTC+9)으로 변환
          d = new Date(Date.UTC(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10),
            parseInt(second, 10)
          ));
          // 한국 시간은 UTC+9이므로 9시간을 빼서 UTC로 변환
          d = new Date(d.getTime() - (9 * 60 * 60 * 1000));
        } else {
          d = new Date(dateStr);
        }
      } else {
        d = (typeof sentTime === "string" || typeof sentTime === "number") ? new Date(sentTime) : sentTime;
      }
      
      // 한국 시간으로 변환하여 포맷팅
      const koreaTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
      const koreaTime = new Date(koreaTimeStr);
      const yyyy = koreaTime.getFullYear();
      const mm = String(koreaTime.getMonth() + 1).padStart(2, "0");
      const dd = String(koreaTime.getDate()).padStart(2, "0");
      const HH = String(koreaTime.getHours()).padStart(2, "0");
      const mi = String(koreaTime.getMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${HH}:${mi}`;
    } catch (error) {
      console.error('[MailInboxPage] formatSentTime 에러:', error, sentTime);
      return '-';
    }
  };

  // 메일 행 클릭(읽음처리 + 상세진입)
  const handleMailRowClick = async (mail) => {
    try {
      // 안읽은 메일인지 확인 (false, null, undefined 모두 체크)
      const isUnread = mail.emailReadYn === false || mail.emailReadYn === null || mail.emailReadYn === undefined;
      
      if (isUnread) {
        // DB에 읽음 처리 (await로 완료 대기)
        console.log("[MailInboxPage] markMailAsRead 호출 시작:", { emailId: mail.emailId, userEmail });
        try {
          const result = await markMailAsRead(mail.emailId, userEmail);
          console.log("[MailInboxPage] markMailAsRead 응답:", result);
          
          // 응답 확인
          const success = result?.data?.data;
          if (success === false) {
            console.warn("[MailInboxPage] markMailAsRead 실패 또는 이미 읽은 메일:", { emailId: mail.emailId, result });
          } else if (success === true) {
            console.log("[MailInboxPage] markMailAsRead 성공:", { emailId: mail.emailId });
          }
        } catch (apiError) {
          console.error("[MailInboxPage] markMailAsRead API 에러:", apiError);
          console.error("[MailInboxPage] markMailAsRead API 에러 상세:", {
            message: apiError?.message,
            response: apiError?.response?.data,
            status: apiError?.response?.status
          });
          showSnack("메일 읽음 처리 중 오류가 발생했습니다.", 'error');
          // API 에러가 발생해도 상세 페이지로 이동은 허용
          navigate(`/email/${mail.emailId}`, { state: { fromTab: tab } });
          return;
        }
        
        // 안읽은 메일 탭에서 읽으면 목록에서 즉시 제거 (Optimistic Update)
        if (tab === "unread") {
          pendingReadIdsRef.current = new Set(pendingReadIdsRef.current).add(mail.emailId);
          persistPendingIds();
          setMails(prev => prev.filter(m => m.emailId !== mail.emailId));
          setTotal(prev => Math.max(0, prev - 1));
          // 뱃지 즉시 감소
          decrementUnreadCounters(1);
        } else {
          // 다른 탭에서도 뱃지 즉시 감소
          decrementUnreadCounters(1);
        }
        
        // 안읽은 메일 탭에서 읽으면 DB 반영 후 목록 새로고침
        // 트랜잭션 커밋/반영 딜레이를 고려하여 충분한 대기 시간 설정 (700ms~1초)
        if (tab === "unread") {
          setTimeout(async () => {
            try {
              // DB 반영 후 목록 새로고침 (안읽은 메일 필터 적용하여 서버와 동기화)
              await loadInbox(page, size, "unread");
              await loadUnreadCount();
              // 사이드바 뱃지 업데이트
              if (mailCountContext?.refreshUnreadCount) {
                await mailCountContext.refreshUnreadCount();
              }
              // 받은 메일함 전체 개수도 업데이트
              if (mailCountContext?.refreshInboxCount) {
                await mailCountContext.refreshInboxCount();
              }
            } catch (err) {
              console.error("loadInbox error after read", err);
            }
          }, 800); // DB 트랜잭션 커밋/반영 딜레이를 고려한 충분한 대기 시간
        } else {
          // 다른 탭에서는 안읽은 메일 개수와 받은 메일함 개수 업데이트
          setTimeout(async () => {
            await loadUnreadCount();
            // 사이드바 뱃지 업데이트
            if (mailCountContext?.refreshUnreadCount) {
              await mailCountContext.refreshUnreadCount();
            }
            // 받은 메일함 전체 개수도 업데이트
            if (mailCountContext?.refreshInboxCount) {
              await mailCountContext.refreshInboxCount();
            }
          }, 500);
        }
      }
      navigate(`/email/${mail.emailId}`, { state: { fromTab: tab } });   // 상세 페이지 이동 (현재 탭 정보 전달)
    } catch (err) {
      console.error("markMailAsRead error:", err);
      showSnack("메일 읽음처리 중 오류", 'error');
      navigate(`/email/${mail.emailId}`);
    }
  };

  // 렌더링
  return (
    <Box sx={{ p: 4, minHeight: "100vh", bgcolor: "#fafbfd", position: 'relative' }}>
      {/* 로딩바 - 상단 고정 */}
      {isRefreshing && (
        <LinearProgress 
          sx={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
            height: 4
          }} 
        />
      )}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
        {/* 상단 타이틀 및 탭/Chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            받은메일함
          </Typography>
          <Chip
            label={`안읽은 메일 : ${unreadCount}개`}
            color={unreadCount > 0 ? "error" : "default"}
            size="small"
            sx={{ ml: 2, fontWeight: 700 }}
          />
          <Typography sx={{ ml: 2, color: 'text.secondary', fontSize: 15 }}>
            전체메일 <b>{total}</b>
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}
          >
            <Select
              size="small"
              value={searchType}
              onChange={e => setSearchType(e.target.value)}
              sx={{
                minWidth: 130,
                bgcolor: '#f8fafb',
                borderRadius: 1,
                border: '1px solid #e2e6ea'
              }}
            >
              <MenuItem value="TITLE">제목</MenuItem>
              <MenuItem value="CONTENT">내용</MenuItem>
              <MenuItem value="TITLE_CONTENT">제목+내용</MenuItem>
            </Select>
            <Paper
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: 250,
                p: '2px 8px',
                borderRadius: 1,
                bgcolor: '#f8fafb',
                border: '1px solid #e2e6ea'
              }}
            >
              <InputBase
                sx={{ flex: 1 }}
                placeholder="검색어를 입력하세요"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <IconButton type="submit" sx={{ p: '6px' }}>
                <SearchIcon fontSize="small" />
              </IconButton>
            </Paper>
          </Box>
        </Box>

        {/* 탭 구역 */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <Tabs 
            value={tab} 
            onChange={(_, v) => {
              setTab(v);
              navigate(`/email?tab=${v}`, { replace: true });
            }}
          >
            <Tab value="all" label="전체" />
            <Tab value="today" label="오늘의 메일" />
            <Tab
              value="unread"
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography component="span">안읽은 메일</Typography>
                  {unreadCount > 0 && (
                    <Badge 
                      badgeContent={unreadCount} 
                      color="error"
                      sx={{
                        "& .MuiBadge-badge": {
                          fontSize: 11,
                          height: 16,
                          minWidth: 16,
                          borderRadius: 8,
                        }
                      }}
                    >
                      <Box sx={{ width: 0, height: 0 }} />
                    </Badge>
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>

        {/* 상단 툴바(삭제, 등) */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {/* 전체선택 */}
          <Checkbox
            sx={{ mr: 1 }}
            edge="start"
            checked={mails.length > 0 && selected.size === mails.length}
            indeterminate={selected.size > 0 && selected.size < mails.length}
            onChange={(e) => { e.stopPropagation(); toggleSelectAll(); }}
          />
          <ButtonGroup variant="text" sx={{ gap: 1 }}>
            <Button 
              startIcon={<ReplyIcon />} 
              onClick={handleReply}
              disabled={selected.size !== 1}
            >
              답장
            </Button>
            {/* 삭제(휴지통 이동) */}
            <Button startIcon={<DeleteIcon />} onClick={deleteSelected}>삭제</Button>
            <Button 
              startIcon={<ForwardIcon />} 
              onClick={handleForward}
              disabled={selected.size !== 1}
            >
              전달
            </Button>
            <Button startIcon={<MarkEmailReadIcon />} onClick={markSelectedAsRead}>읽음</Button>
          </ButtonGroup>
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={handleSortByDate} title={sortOrder === "desc" ? "날짜순 내림차순 (최신순)" : "날짜순 오름차순 (오래된순)"}>
            {sortOrder === "desc" ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
          </IconButton>
          <IconButton onClick={handleRefresh}><SyncIcon /></IconButton>
          <Paper 
            sx={{ ml: 1, display: 'inline-flex', alignItems: 'center', px: 0.5, cursor: 'pointer' }}
            onClick={(e) => setSizeMenuAnchor(e.currentTarget)}
          >
            <Typography sx={{ px: 0.5, fontWeight: 500, fontSize: 15 }}>{size}</Typography>
            <IconButton size="small"><MoreVertIcon fontSize="small" /></IconButton>
          </Paper>
          <Menu
            anchorEl={sizeMenuAnchor}
            open={Boolean(sizeMenuAnchor)}
            onClose={() => setSizeMenuAnchor(null)}
          >
            <MenuItem 
              onClick={() => {
                setSize(5);
                setPage(1);
                setSizeMenuAnchor(null);
              }}
              selected={size === 5}
            >
              5개씩 보기
            </MenuItem>
            <MenuItem 
              onClick={() => {
                setSize(10);
                setPage(1);
                setSizeMenuAnchor(null);
              }}
              selected={size === 10}
            >
              10개씩 보기
            </MenuItem>
          </Menu>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* 메일 테이블 */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafd", borderBottom: '2px solid #e1e3ea' }}>
                <TableCell padding="checkbox"></TableCell>
                <TableCell sx={{ fontWeight: 700 }}>발신자</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>제목</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>일자</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>상태</TableCell>
                <TableCell sx={{ fontWeight: 700 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* 메일이 없을 때 안내 */}
              {Array.isArray(sortedMails) && sortedMails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">받은 메일이 없습니다.</TableCell>
                </TableRow>
              ) : (
              sortedMails.map(mail => {
                const id = mail.emailId;
                const checked = selected.has(id);
                // 안읽음 처리 (fontWeight, bg)
                const isUnread = mail.emailReadYn === false || typeof mail.emailReadYn === "undefined";
                return (
                  <TableRow
                    key={id}
                    hover
                    sx={{
                      cursor: "pointer",
                      fontWeight: isUnread ? 700 : 400
                    }}
                    onClick={() => handleMailRowClick(mail)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={checked}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleSelect(id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {mail.senderEmail || mail.senderName || '-'}
                      {(mail.senderDept && mail.senderDept.trim() !== "") && ` / ${mail.senderDept}`}
                    </TableCell>
                    <TableCell>{mail.emailTitle}</TableCell>
                    <TableCell>{formatSentTime(mail.sentTime)}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatMailStatusLabel(mail.emailStatus)}
                        color={formatMailStatusColor(mail.emailStatus)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {/* (눈 아이콘 삭제) ※ */}
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        )}
        {/* 하단 페이징 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <Pagination
            count={Math.max(1, Math.ceil(total / size))}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Paper>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="메일 삭제"
        message={`선택한 ${selected.size}개의 메일을 휴지통으로 이동하시겠습니까?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
};

export default MailInboxPage;