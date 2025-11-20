# ChatLayout Integration Guide for Multi-File Upload

## Overview
This guide explains how to integrate the multi-file upload functionality into the existing ChatLayout component.

## Step 1: Add Multi-File Upload Handler to ChatLayout

Add the following handler function to ChatLayout.jsx (around line 666, after `handleFileUpload`):

```javascript
// 다중 파일 업로드 핸들러
const handleMultiFileUpload = async (formData) => {
  if (!selectedRoomId) {
    alert("채팅방이 선택되지 않았습니다.");
    return;
  }
  
  try {
    const res = await fetch(`/api/v1/chat/${selectedRoomId}/messages/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData
    });
    
    if (!res.ok) {
      if (res.status === 413) {
        throw new Error("파일 크기가 너무 큽니다 (최대 50MB)");
      } else if (res.status === 415) {
        throw new Error("지원하지 않는 파일 형식입니다 (이미지만 가능)");
      }
      throw new Error("파일 업로드 실패");
    }
    
    const chatMessages = await res.json(); // Array of ChatResponseDTO
    
    // 각 메시지를 messages 배열에 추가 (중복 체크)
    setMessages((prev) => {
      const newMessages = [...prev];
      
      for (const chatMessage of chatMessages) {
        const exists = prev.some(m => {
          const mId = m?.id;
          const newId = chatMessage?.id;
          if (mId == null || newId == null) return false;
          return Number(mId) === Number(newId);
        });
        
        if (!exists) {
          newMessages.push(chatMessage);
        } else {
          console.log("📨 [ChatLayout] 중복 메시지 무시 (다중 파일 업로드):", {
            messageId: chatMessage.id,
            messageContent: chatMessage.messageContent
          });
        }
      }
      
      return newMessages;
    });
    
    console.log(`✅ ${chatMessages.length}개 파일 업로드 성공`);
  } catch (err) {
    console.error("Multi-file upload error:", err);
    alert("파일 업로드에 실패했습니다: " + err.message);
    throw err; // Re-throw to let ChatFileUploader handle cleanup
  }
};
```

## Step 2: Add State for Room Participants (Optional)

If you want to show participant avatars in the header, add this state:

```javascript
const [roomParticipants, setRoomParticipants] = useState([]);
```

And fetch participants when a room is selected:

```javascript
useEffect(() => {
  if (selectedRoomId) {
    fetchRoomParticipants(selectedRoomId);
  }
}, [selectedRoomId]);

const fetchRoomParticipants = async (roomId) => {
  try {
    const res = await fetch(`/api/v1/chat/${roomId}/users`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) throw new Error("Failed to fetch participants");
    const result = await res.json();
    setRoomParticipants(result.data || []);
  } catch (error) {
    console.error("Failed to fetch room participants:", error);
  }
};
```

## Step 3: Update ChatDetailPane Props

Update the ChatDetailPane component call (around line 1125) to pass the new props:

```javascript
<ChatDetailPane
  selectedRoom={selectedRoom}
  messages={messages}
  unreadCount={selectedRoom?.unreadCount || 0}
  firstUnreadIdx={firstUnreadIdx}
  formatTime={formatTime}
  inputRef={inputRef}
  onSend={handleSend}
  onFileUpload={handleFileUpload}
  onMultiFileUpload={handleMultiFileUpload} // NEW
  roomParticipants={roomParticipants} // NEW (optional)
  socketConnected={socketConnected}
  onScrollTop={handleLoadMoreMessages}
  isLoadingMore={isLoadingMore}
  hasMoreAbove={hasMore}
/>
```

## Step 4: Environment Variables

Ensure S3 configuration is properly set in your backend application.properties or application.yml:

```properties
cloud.aws.s3.bucket=your-bucket-name
cloud.aws.credentials.access-key=your-access-key
cloud.aws.credentials.secret-key=your-secret-key
cloud.aws.region.static=your-region
```

## Testing

### Manual Test Steps

1. **Test Multi-File Upload**
   - Open a chat room
   - Look for the multi-file upload button (usually in the input box area)
   - Select multiple images (up to 50MB total)
   - Verify preview shows all selected images
   - Click upload and verify all files appear as separate messages

2. **Test File Size Validation**
   - Try uploading files exceeding 50MB total
   - Verify error message appears

3. **Test File Type Validation**
   - Try uploading non-image files
   - Verify error message appears

4. **Test Image Carousel**
   - Click on an uploaded image in the chat
   - Verify full-screen carousel opens
   - Test navigation (arrows, keyboard, thumbnails)
   - Test download button

5. **Test Participant Avatars** (if implemented)
   - Verify up to 4 avatars show in chat header
   - Verify "+N" indicator for extra participants
   - Click avatars to open participants dialog

## Scroll Restore Logic (Future Enhancement)

When loading earlier messages, save and restore scroll position:

```javascript
const handleLoadMoreMessages = async () => {
  if (!selectedRoomId || !hasMore || isLoadingMore) return;
  
  setIsLoadingMore(true);
  
  // Save current scroll position
  const messageList = document.querySelector('.message-list-container');
  const prevScrollHeight = messageList?.scrollHeight || 0;
  
  try {
    const nextPage = currentPage + 1;
    const res = await fetchChatRoomMessages(selectedRoomId, nextPage, 20);
    
    // Process response...
    
    // Restore scroll position after render
    setTimeout(() => {
      if (messageList) {
        const newScrollHeight = messageList.scrollHeight;
        messageList.scrollTop = newScrollHeight - prevScrollHeight;
      }
    }, 0);
    
  } catch (error) {
    console.error("Load more messages failed:", error);
  } finally {
    setIsLoadingMore(false);
  }
};
```

## Unread Indicator with IntersectionObserver (Future Enhancement)

Track when messages come into view to mark them as read:

```javascript
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageId = entry.target.dataset.messageId;
          // Mark message as read
          markMessageAsRead(messageId);
        }
      });
    },
    { threshold: 0.5 }
  );
  
  // Observe all unread messages
  const unreadMessages = document.querySelectorAll('.message[data-unread="true"]');
  unreadMessages.forEach(msg => observer.observe(msg));
  
  return () => observer.disconnect();
}, [messages]);
```

## Notes

- The backend expects FormData with a "files" field containing multiple files
- Each uploaded file creates a separate chat message
- File downloads use the /api/v1/chat/files/{fileId}/download endpoint
- Ensure proper CORS configuration if frontend and backend are on different domains
