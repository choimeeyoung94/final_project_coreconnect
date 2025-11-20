# Multi-File Image Upload Implementation - Testing Guide

## Prerequisites

### Backend
1. Ensure S3 is configured in `application.properties` or `application.yml`:
```properties
cloud.aws.s3.bucket=your-bucket-name
cloud.aws.credentials.access-key=your-access-key
cloud.aws.credentials.secret-key=your-secret-key
cloud.aws.region.static=your-region
```

2. Database should have `message_file` table (already exists based on MessageFile entity)

### Frontend
1. Node.js dependencies installed (`npm install`)
2. Vite build tool configured

## Manual Testing Procedure

### Test 1: Backend Compilation
```bash
cd backend
./gradlew compileJava
```
✅ Expected: BUILD SUCCESSFUL (verified)

### Test 2: Frontend Build
```bash
cd frontend
npm run build
```
✅ Expected: Built successfully (verified)

### Test 3: Multi-File Upload (Happy Path)
**Steps:**
1. Start backend server: `cd backend && ./gradlew bootRun`
2. Start frontend dev server: `cd frontend && npm run dev`
3. Login to application
4. Navigate to a chat room
5. Look for multi-file upload button in ChatDetailPane
6. Click button to show ChatFileUploader component
7. Select 2-3 small images (< 5MB each)
8. Verify preview shows all selected images
9. Click "Upload" button

**Expected Results:**
- Preview thumbnails display correctly
- Total file size shows under 50MB
- Upload completes successfully
- Each file appears as a separate message in chat
- Messages include sender info and timestamps

### Test 4: File Size Validation (Client-Side)
**Steps:**
1. Select multiple images totaling > 50MB
2. Observe ChatFileUploader component

**Expected Results:**
- Error message appears: "총 파일 크기가 50MB를 초과합니다"
- Upload button remains disabled
- No network request sent

### Test 5: File Size Validation (Server-Side)
**Steps:**
1. Use curl or Postman to POST files > 50MB to endpoint
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@large-file.jpg" \
  http://localhost:8080/api/v1/chat/1/messages/files
```

**Expected Results:**
- HTTP 413 response
- Error message: "총 파일 크기가 50MB를 초과합니다"

### Test 6: File Type Validation (Client-Side)
**Steps:**
1. Attempt to select non-image files (.pdf, .txt, .docx)
2. Observe ChatFileUploader component

**Expected Results:**
- Error message: "이미지 파일만 선택할 수 있습니다"
- Non-image files filtered out

### Test 7: File Type Validation (Server-Side)
**Steps:**
1. Use curl to POST non-image file
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@document.pdf" \
  http://localhost:8080/api/v1/chat/1/messages/files
```

**Expected Results:**
- HTTP 415 response
- Error message contains "이미지 파일만 업로드 가능합니다"

### Test 8: Image Carousel
**Steps:**
1. Upload several images to chat
2. Click on any image message
3. Verify ImageCarouselDialog opens
4. Test navigation:
   - Click left/right arrows
   - Use keyboard arrows
   - Click thumbnail images

**Expected Results:**
- Dialog opens in full-screen
- Images load correctly
- Navigation works smoothly
- Current image index displayed (e.g., "1 / 5")
- ESC key closes dialog

### Test 9: File Download
**Steps:**
1. Open ImageCarouselDialog
2. Click download button
3. Verify browser downloads file

**Expected Results:**
- File downloads successfully
- Filename format: `chat-file-{fileId}`
- File content matches uploaded image

### Test 10: Participant Avatars
**Steps:**
1. Open chat room with multiple participants
2. Observe header area

**Expected Results:**
- Up to 4 participant avatars displayed
- If > 4 participants, "+N" indicator shows
- Click avatars opens participants dialog
- Profile images load correctly
- Initials shown for users without profile images

### Test 11: Per-Image Cancel
**Steps:**
1. Open ChatFileUploader
2. Select 5 images
3. Click X button on 2nd and 4th images
4. Click Upload

**Expected Results:**
- Selected images removed from preview
- Total count updates correctly
- Only remaining 3 images uploaded
- No errors in console

### Test 12: Memory Leak Prevention
**Steps:**
1. Open ChatFileUploader
2. Select images multiple times
3. Cancel without uploading
4. Monitor browser memory in DevTools

**Expected Results:**
- Object URLs properly revoked (check console)
- No memory leak warnings
- Preview images clear when component unmounts

### Test 13: Concurrent Upload
**Steps:**
1. Upload files from two different chat clients simultaneously
2. Observe message ordering

**Expected Results:**
- All messages appear in correct order
- No duplicate messages
- Proper sender attribution
- unreadCount updates correctly

### Test 14: Authentication
**Steps:**
1. Attempt upload without valid token
```bash
curl -X POST \
  -F "files=@image.jpg" \
  http://localhost:8080/api/v1/chat/1/messages/files
```

**Expected Results:**
- HTTP 401 or 403 response
- Authentication error message

### Test 15: Non-Existent Room
**Steps:**
1. Attempt upload to non-existent roomId
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@image.jpg" \
  http://localhost:8080/api/v1/chat/99999/messages/files
```

**Expected Results:**
- HTTP 404 or 400 response
- Error message indicating room not found

### Test 16: S3 Integration
**Steps:**
1. Upload image successfully
2. Check S3 bucket directly (AWS Console)
3. Verify file exists at expected key: `chat/{username}/{timestamp}_{filename}`

**Expected Results:**
- File exists in S3 bucket
- Correct content type set (image/jpeg, image/png, etc.)
- File accessible via generated URL

### Test 17: Database Persistence
**Steps:**
1. Upload image
2. Check `message_file` table in database
```sql
SELECT * FROM message_file ORDER BY id DESC LIMIT 5;
```

**Expected Results:**
- New record created
- `file_name` matches uploaded filename
- `file_size` matches actual size
- `s3_object_key` contains correct S3 path
- `chat_message_id` references valid chat message

## Integration Testing Checklist

- [ ] Backend compiles without errors
- [ ] Frontend builds without errors
- [ ] S3 credentials configured
- [ ] Multi-file upload (happy path)
- [ ] Client-side file size validation
- [ ] Server-side file size validation
- [ ] Client-side file type validation
- [ ] Server-side file type validation
- [ ] Image carousel opens and navigates
- [ ] File download works
- [ ] Participant avatars display
- [ ] Per-image cancel works
- [ ] Memory leaks prevented
- [ ] Concurrent uploads handled
- [ ] Authentication required
- [ ] Non-existent room handling
- [ ] S3 files uploaded correctly
- [ ] Database records created

## Performance Considerations

1. **Large File Uploads**: Consider implementing progress indicators for uploads > 10MB
2. **Image Compression**: Consider client-side image compression before upload
3. **Lazy Loading**: Consider lazy loading images in carousel for better performance
4. **Thumbnail Generation**: Consider server-side thumbnail generation for chat list

## Security Checklist

- [x] File size validation (client and server)
- [x] File type validation (client and server)
- [x] Authentication required
- [x] Authorization header included
- [x] S3 keys generated with timestamp (prevent collision)
- [ ] Virus scanning (future enhancement)
- [ ] Rate limiting (future enhancement)

## Known Limitations

1. No progress indicator for individual file uploads
2. No image compression
3. No virus scanning
4. No rate limiting
5. ChatLayout integration provided as example (manual integration required)

## Future Enhancements

1. Add upload progress bars
2. Implement client-side image compression
3. Add drag-and-drop support
4. Implement scroll-restore for loading earlier messages
5. Add unread indicator with IntersectionObserver
6. Add WebSocket broadcasting for real-time upload notifications
7. Implement thumbnail generation
8. Add virus scanning integration
