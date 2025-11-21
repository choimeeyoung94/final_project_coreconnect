# Multi-File Image Upload Feature

## Overview
This PR implements a comprehensive multi-file image upload feature for the chat system with support for:
- Multiple image uploads (up to 50MB total)
- Image preview carousel
- File download with authentication
- Participant avatars display

## Backend Implementation

### New Controller: ChatFileController

Located at: `backend/src/main/java/com/goodee/coreconnect/chat/controller/ChatFileController.java`

#### Endpoints:

1. **POST /api/v1/chat/{roomId}/messages/files**
   - Upload multiple image files to a chat room
   - Validates total size ≤ 50MB
   - Validates content types (JPEG, PNG, GIF, WEBP, BMP only)
   - Stores files in S3
   - Creates MessageFile entities
   - Returns list of ChatResponseDTOs
   - Response: 201 Created with message data

2. **GET /api/v1/chat/files/{fileId}/download**
   - Download a chat file
   - Requires authentication
   - Validates user has access to the chat room
   - Streams file from S3 with proper Content-Disposition header
   - Response: File blob with download headers

#### Security Features:
- Bearer token authentication required
- Access control verification (user must be room participant)
- File size limit enforcement (50MB)
- Content-type validation (images only)
- Proper error handling with appropriate HTTP status codes

### Modified Files:

1. **ResponseDTO.java**
   - Added `created(T data)` method
   - Added `unsupportedMediaType(String message)` method
   - Added `payloadTooLarge(String message)` method
   - Added `forbidden(String message)` method

2. **ToggleFavoriteRequestDTO.java** (Bug Fix)
   - Created missing DTO to fix compilation errors

## Frontend Implementation

### New Components:

1. **ChatFileUploader.jsx**
   - Location: `frontend/src/features/chat/components/ChatFileUploader.jsx`
   - Features:
     - Multiple image file selection
     - Grid layout with image previews (ObjectURL)
     - Per-image cancel button
     - Client-side 50MB total size validation
     - Image content-type validation
     - Memory leak prevention (ObjectURL cleanup)
     - Bounds checking for array operations

2. **ImageCarouselDialog.jsx**
   - Location: `frontend/src/features/chat/components/ImageCarouselDialog.jsx`
   - Features:
     - Full-screen image viewing
     - Swipe navigation (using react-swipeable-views)
     - Previous/Next buttons
     - Keyboard navigation (Arrow keys, Escape)
     - Download button integration
     - Image counter display

3. **RoomParticipantAvatars.jsx**
   - Location: `frontend/src/features/chat/components/RoomParticipantAvatars.jsx`
   - Features:
     - Display up to 4 participant avatars
     - Show +N for overflow
     - Click handler for opening participants dialog
     - Tooltip with participant names
     - Support for profile images or initials

4. **ChatDetailPaneEnhancedExample.jsx**
   - Location: `frontend/src/features/chat/components/ChatDetailPaneEnhancedExample.jsx`
   - Comprehensive integration guide with code examples for:
     - Multi-file upload handler
     - File download handler
     - Unread message indicator
     - Scroll preservation when loading older messages

### Modified Files:

1. **ChatRoomApi.js**
   - Added `uploadMultipleFiles(roomId, files)` function
   - Added `downloadChatFile(fileId)` function

2. **MailFavoritePage.jsx** (Bug Fix)
   - Created missing page component to fix build errors

### Dependencies Added:
- `react-swipeable-views@^0.14.1` - For image carousel
- `react-swipeable-views-utils@^0.14.1` - Utilities for carousel
- `@fullcalendar/core` - To fix build errors

## Integration Guide

### Backend Usage:

```bash
# Upload multiple images
curl -X POST "http://localhost:8080/api/v1/chat/123/messages/files" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@image1.jpg" \
  -F "files=@image2.png"

# Download a file
curl -X GET "http://localhost:8080/api/v1/chat/files/456/download" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded_file.jpg
```

### Frontend Integration:

See `ChatDetailPaneEnhancedExample.jsx` for detailed integration examples.

Basic usage:

```javascript
import ChatFileUploader from './ChatFileUploader';
import ImageCarouselDialog from './ImageCarouselDialog';
import { uploadMultipleFiles, downloadChatFile } from '../api/ChatRoomApi';

// In your component:
const handleUpload = async (files) => {
  const messages = await uploadMultipleFiles(roomId, files);
  setMessages(prev => [...prev, ...messages]);
};

<ChatFileUploader onUpload={handleUpload} />
```

## Testing

### Manual Testing Steps:

1. **Multi-file Upload:**
   - Select multiple images (JPG, PNG, GIF)
   - Verify preview grid displays
   - Verify total size calculation
   - Verify individual image removal
   - Verify upload creates chat messages

2. **Size Validation:**
   - Try uploading files totaling > 50MB
   - Should show error message
   - Backend should return 413 Payload Too Large

3. **Content-Type Validation:**
   - Try uploading non-image files (PDF, DOC)
   - Should show error message
   - Backend should return 415 Unsupported Media Type

4. **Download:**
   - Click download on uploaded image
   - Verify file downloads with correct name
   - Verify authentication is required
   - Verify access control (only room participants)

5. **Image Carousel:**
   - Click on uploaded image
   - Verify full-screen view
   - Test swipe navigation
   - Test arrow key navigation
   - Test download from carousel

6. **Participant Avatars:**
   - Verify shows up to 4 avatars
   - Verify +N for overflow
   - Verify click opens participants dialog

## Known Limitations

1. **Rate Limiting:** No explicit rate limiting on file uploads (should be handled at infrastructure/API gateway level)
2. **Virus Scanning:** No virus scanning integration (consider adding in production)
3. **File Name Sanitization:** Basic sanitization via S3 key generation
4. **Storage Quota:** No per-user or per-room storage quota enforcement
5. **Image Optimization:** No automatic image compression/optimization

## Security Considerations

1. **Authentication:** All endpoints require valid JWT token
2. **Authorization:** Download endpoint verifies user is room participant
3. **File Size Limit:** 50MB enforced on both client and server
4. **Content-Type:** Only image types allowed (JPEG, PNG, GIF, WEBP, BMP)
5. **Memory Leaks:** Frontend properly cleans up ObjectURLs
6. **Input Validation:** Array bounds checking and error handling

## Future Enhancements

1. **Progressive Upload:** Upload files one at a time with progress indicators
2. **Image Compression:** Client-side image compression before upload
3. **Thumbnail Generation:** Server-side thumbnail generation
4. **Storage Management:** Implement storage quotas and cleanup policies
5. **Advanced Search:** Search messages by file type or name
6. **Batch Operations:** Bulk download or delete operations

## Dependencies

### Backend:
- Spring Boot 3.5.6
- AWS SDK for S3
- Existing S3Service and MessageFileRepository

### Frontend:
- React 19.1.1
- Material-UI 7.3.4
- react-swipeable-views 0.14.1
- axios 1.12.2

## Files Changed

### Backend (3 files):
- `ChatFileController.java` (new)
- `ResponseDTO.java` (modified)
- `ToggleFavoriteRequestDTO.java` (new, bug fix)

### Frontend (8 files):
- `ChatFileUploader.jsx` (new)
- `ImageCarouselDialog.jsx` (new)
- `RoomParticipantAvatars.jsx` (new)
- `ChatDetailPaneEnhancedExample.jsx` (new)
- `ChatRoomApi.js` (modified)
- `MailFavoritePage.jsx` (new, bug fix)
- `package.json` (dependencies)
- `package-lock.json` (dependencies)

## Build Status

✅ Backend compiles successfully
✅ Frontend builds successfully
✅ Code review feedback addressed
⚠️ CodeQL timed out (manual security review completed)

## Deployment Notes

1. Ensure S3 bucket permissions are properly configured
2. Verify CORS settings allow multipart/form-data requests
3. Consider implementing CDN for image delivery
4. Monitor S3 storage usage and costs
5. Set up CloudWatch alerts for upload failures
