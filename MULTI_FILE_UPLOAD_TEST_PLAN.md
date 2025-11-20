# Multi-File Image Upload - Manual Test Plan

## Feature Summary
Multi-file image upload with 50MB total size limit and preview functionality for chat messages.

## Backend Endpoints

### 1. Upload Multiple Files
**Endpoint:** `POST /api/v1/chat/{roomId}/messages/files`
**Headers:** `Authorization: Bearer {token}`
**Body:** FormData with `files` (MultipartFile[])
**Success Response:** HTTP 201 with List<ChatResponseDTO>

### 2. Download File
**Endpoint:** `GET /api/v1/chat/files/{fileId}/download`
**Headers:** `Authorization: Bearer {token}`
**Success Response:** HTTP 302 redirect to S3 URL

## Manual Test Cases

### Test Case 1: Upload Multiple Images (Under 50MB)
1. Start backend: `cd backend && ./gradlew bootRun`
2. Start frontend: `cd frontend && npm run dev`
3. Login to application
4. Navigate to a chat room
5. Click the Collections icon (multi-file upload button)
6. Select 3-5 images totaling less than 50MB
7. Verify previews are shown with file names and sizes
8. Click "업로드" button

**Expected Results:**
- All images upload successfully
- Messages appear in chat with file URLs
- Images are visible in message list
- Room list updates with latest message

### Test Case 2: Remove File Before Upload
1. Click Collections icon
2. Select 3 images
3. Click X button on one preview
4. Verify preview is removed
5. Click "업로드" button

**Expected Results:**
- Only 2 images are uploaded
- Removed image is not uploaded
- No memory leaks (object URL revoked)

### Test Case 3: Exceed 50MB Limit (Client-side)
1. Click Collections icon
2. Select images totaling more than 50MB
3. Observe error message

**Expected Results:**
- Error message: "총 파일 크기가 50MB를 초과합니다"
- Upload button remains disabled
- No upload occurs

### Test Case 4: Exceed 50MB Limit (Server-side)
1. Bypass client validation (browser dev tools)
2. Upload files totaling > 50MB

**Expected Results:**
- Server returns HTTP 413 (Payload Too Large)
- Error message displayed
- No files are uploaded

### Test Case 5: Upload Non-Image File
1. Click Collections icon
2. Try to select PDF or other non-image file

**Expected Results:**
- Error message: "이미지 파일만 업로드할 수 있습니다"
- File is not added to preview

### Test Case 6: Upload Non-Image (Server-side)
1. Bypass client validation
2. Upload non-image file

**Expected Results:**
- Server returns HTTP 415 (Unsupported Media Type)
- Error message displayed
- No files are uploaded

### Test Case 7: Cancel Upload
1. Click Collections icon
2. Select 3 images
3. Click "취소" button

**Expected Results:**
- Preview panel closes
- Object URLs are revoked
- No upload occurs
- No memory leaks

### Test Case 8: Download Uploaded File
1. Upload images successfully
2. Click on file name in message
3. Verify file downloads

**Expected Results:**
- File downloads from S3
- User must be chat room participant
- Non-participants get 403 error

### Test Case 9: Concurrent Single and Multi-file Upload
1. Upload single file via AttachFile icon
2. Upload multiple files via Collections icon
3. Verify both work correctly

**Expected Results:**
- Both upload methods work independently
- Messages appear in correct order
- No conflicts or errors

### Test Case 10: Empty File Selection
1. Click Collections icon
2. Click file input but cancel without selecting files
3. Verify no error occurs

**Expected Results:**
- No error message
- Upload panel remains empty
- No upload occurs

## Performance Tests

### Test Case 11: Large Number of Small Files
1. Select 50 small images (100KB each)
2. Verify total size < 50MB
3. Upload

**Expected Results:**
- All files upload successfully
- Messages broadcast via WebSocket
- No performance degradation

### Test Case 12: Few Large Files
1. Select 3 large images (15MB each)
2. Verify total size < 50MB
3. Upload

**Expected Results:**
- All files upload successfully
- Progress indication (if implemented)
- Successful completion

## Security Tests

### Test Case 13: Unauthorized Download
1. Upload file in Room A
2. Try to download file as user not in Room A

**Expected Results:**
- Server returns HTTP 403
- Error message: "파일 다운로드 권한이 없습니다"

### Test Case 14: Invalid File Extension
1. Rename virus.exe to virus.jpg
2. Try to upload

**Expected Results:**
- Server validates MIME type (not just extension)
- Returns 415 if MIME type is not image/*

## UI/UX Tests

### Test Case 15: Responsive Preview Grid
1. Resize browser window
2. Verify preview grid adjusts properly

**Expected Results:**
- Grid shows 3 columns on desktop
- Grid shows 2 columns on tablet
- Grid shows 1 column on mobile

### Test Case 16: File Info Display
1. Select files with various sizes
2. Verify file info is shown correctly

**Expected Results:**
- File names truncate if too long
- File sizes display in KB or MB
- Total size shown above previews

## Integration Tests

### Test Case 17: WebSocket Broadcast
1. Open chat room in 2 browsers (2 users)
2. Upload images in one browser
3. Verify messages appear in both browsers

**Expected Results:**
- Messages broadcast via WebSocket
- Both users see uploaded images
- Unread counts update correctly

### Test Case 18: Message Persistence
1. Upload images
2. Refresh page
3. Verify images persist

**Expected Results:**
- Images load from database
- S3 URLs are accessible
- Message order is preserved

## Cleanup Tests

### Test Case 19: Memory Leak Prevention
1. Open browser dev tools (Memory tab)
2. Take heap snapshot
3. Upload and cancel multiple times
4. Take another heap snapshot
5. Compare memory usage

**Expected Results:**
- No significant memory growth
- Object URLs are properly revoked
- No lingering preview elements

## Error Handling Tests

### Test Case 20: Network Failure During Upload
1. Start upload
2. Disconnect network mid-upload
3. Verify error handling

**Expected Results:**
- Clear error message
- User can retry
- Partial uploads don't corrupt data

### Test Case 21: S3 Upload Failure
1. Configure invalid S3 credentials (dev only)
2. Try to upload

**Expected Results:**
- Server returns 500 error
- Error message displayed
- User is notified of failure

## Browser Compatibility

Test all above cases on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Notes
- All tests should be performed on a clean database state
- Monitor server logs for any errors
- Check S3 bucket for uploaded files
- Verify no orphaned files in S3
- Check database for MessageFile records
