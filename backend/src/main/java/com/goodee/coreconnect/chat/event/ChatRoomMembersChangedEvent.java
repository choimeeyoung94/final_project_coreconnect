package com.goodee.coreconnect.chat.event;

/**
 * 채팅방 참여자 목록이 바뀜 (방 만들기, 초대, 나가기)
 * - 커밋된 뒤 ChatRoomMemberCache가 받아서 그 방 캐시를 비움
 */
public record ChatRoomMembersChangedEvent(Integer roomId) {}
