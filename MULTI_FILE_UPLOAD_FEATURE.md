# Multi-File Image Upload Feature

## Overview
This feature allows users to upload multiple images at once to a chat room, with a combined size limit of 50MB. Images are previewed before upload, and users can remove individual images from the selection.

## Architecture

### Backend (Spring Boot)

#### Endpoints

1. **POST** `/api/v1/chat/{roomId}/messages/files`
   - **Description:** Upload multiple image files to a chat room
   - **Authentication:** Required (Bearer token)
   - **Request:** FormData with `files` parameter (MultipartFile[])
   - **Validations:**
     - Files must not be empty
     - Total size must be ≤ 50MB (52,428,800 bytes)
     - All files must have MIME type starting with `image/`
   - **Success Response:** HTTP 201 Created
     ```json
     {
       "status": 200,
       "message": "다중 파일 업로드 성공",
       "data": [
         {
           "id": 123,
           "messageContent": null,
           "sendAt": "2024-11-20T15:30:00",
           "fileYn": true,
           "fileUrl": "https://s3.amazonaws.com/...",
           "roomId": 1,
           "senderId": 5,
           "senderName": "홍길동",
           "senderEmail": "hong@example.com",
           "unreadCount": 2
         }
       ]
     }
     ```
   - **Error Responses:**
     - HTTP 400: No files provided or bad request
     - HTTP 413: Total size exceeds 50MB
     - HTTP 415: Non-image file detected
     - HTTP 500: All uploads failed

2. **GET** `/api/v1/chat/files/{fileId}/download`
   - **Description:** Download a chat file
   - **Authentication:** Required (Bearer token)
   - **Authorization:** User must be a participant in the chat room
   - **Success Response:** HTTP 302 redirect to S3 URL
   - **Error Responses:**
     - HTTP 400: File not found
     - HTTP 403: User is not a participant in the chat room

#### Services

**S3Service.uploadChatFile()**
- Uploads files to S3 in the `chat/{username}/` folder
- Returns the S3 object key (not URL)
- Generates unique filenames using UUID

#### Entities

**MessageFile**
- `id`: Integer (Primary Key)
- `fileName`: String (Original filename)
- `fileSize`: Double (File size in bytes)
- `S3ObjectKey`: String (S3 object key)
- `chat`: Many-to-One relationship with Chat entity

### Frontend (React)

#### Components

1. **ChatFileUploader** (`src/features/chat/components/ChatFileUploader.jsx`)
   - Renders file input with multiple selection
   - Shows image previews in a responsive grid
   - Displays file names, sizes, and total size
   - Allows removing individual files before upload
   - Validates total size (50MB client-side)
   - Validates file types (images only)
   - Calls `onUpload` callback with FormData
   - Cleans up object URLs on unmount and file removal

2. **ChatDetailPane** (Updated)
   - Adds toggle button for multi-file uploader
   - Integrates ChatFileUploader component
   - Shows/hides uploader panel

3. **ChatMessageInputBox** (Updated)
   - Adds Collections icon button for multi-file upload
   - Keeps existing single-file upload functionality

#### State Management

**ChatLayout** (Updated)
- Adds `handleMultiFileUpload()` function
- Uploads files via FormData to backend
- Merges returned ChatResponseDTO array into messages state
- Updates room list with latest message
- Handles errors and displays to user

## Data Flow

### Upload Process
1. User clicks Collections icon in chat input
2. ChatFileUploader component opens
3. User selects multiple images
4. Component creates object URLs for previews
5. Client validates:
   - File types (images only)
   - Total size (≤ 50MB)
6. User clicks "업로드" button
7. Component creates FormData and calls `onUpload(formData)`
8. ChatLayout's `handleMultiFileUpload()`:
   - POSTs to `/api/v1/chat/{roomId}/messages/files`
   - Receives array of ChatResponseDTO
   - Merges into messages state
   - Updates room list
9. Server:
   - Validates files (empty check, size, MIME type)
   - Uploads each file to S3
   - Creates MessageFile entities
   - Creates Chat messages
   - Broadcasts via WebSocket (handled by existing logic)
   - Returns ChatResponseDTO array
10. Component cleans up object URLs
11. Upload panel closes

### Download Process
1. User clicks file name in message
2. Browser navigates to `/api/v1/chat/files/{fileId}/download`
3. Server:
   - Retrieves MessageFile by ID
   - Checks user is participant in chat room
   - Converts S3 key to URL
   - Returns HTTP 302 redirect to S3 URL
4. Browser downloads file from S3

## Security Considerations

1. **Authentication:** All endpoints require valid JWT token
2. **Authorization:** Download endpoint verifies user is chat room participant
3. **Validation:**
   - Server validates MIME types (never trust client)
   - Server validates total file size
   - Server validates individual file sizes
4. **S3 Access:** Files stored in user-specific folders
5. **CORS:** S3 bucket must have appropriate CORS configuration

## Memory Management

1. **Object URLs:** Created for previews using `URL.createObjectURL()`
2. **Cleanup:** URLs revoked:
   - When file is removed from selection
   - After successful upload
   - On component unmount
3. **No Memory Leaks:** All object URLs are properly cleaned up

## Error Handling

### Client-Side
- Invalid file type: Shows error, prevents selection
- Size limit exceeded: Shows error with current size
- Upload failure: Displays server error message
- Network failure: Catches and displays error

### Server-Side
- No files: Returns 400 with clear message
- Size exceeded: Returns 413 with current size
- Invalid MIME: Returns 415 with problematic file name
- S3 failure: Logs error, continues with other files
- All failed: Returns 500 with error message

## Configuration

### Backend
- Max total upload size: 50MB (configurable in code)
- S3 bucket: Configured in `application.properties`
- Allowed MIME types: `image/*`

### Frontend
- Max total size: 50MB (matches backend)
- Accepted file types: `image/*`
- Preview grid: Responsive (3/2/1 columns)

## Testing

See [MULTI_FILE_UPLOAD_TEST_PLAN.md](./MULTI_FILE_UPLOAD_TEST_PLAN.md) for comprehensive test cases.

## Future Enhancements

1. **Progress Indication:** Show upload progress for large files
2. **Drag & Drop:** Support drag-and-drop file selection
3. **Image Compression:** Compress images client-side before upload
4. **Retry Logic:** Automatically retry failed uploads
5. **Batch Operations:** Allow selecting/deselecting all files
6. **File Type Icons:** Show appropriate icons for different file types
7. **Preview Lightbox:** Click preview to view full-size image
8. **Upload Queue:** Queue uploads and show status for each

## Dependencies

### Backend
- Spring Boot Web
- Spring Data JPA
- AWS SDK for Java (S3)
- Lombok

### Frontend
- React
- Material-UI (@mui/material)
- Material Icons (@mui/icons-material)

## Files Modified/Added

### Backend
- `ChatMessageController.java`: Added uploadMultipleFiles() and downloadFile()
- `S3Service.java`: Added uploadChatFile()
- `MessageFile.java`: (No changes, existing entity)

### Frontend
- `ChatFileUploader.jsx`: NEW component
- `ChatDetailPane.jsx`: Integrated uploader
- `ChatMessageInputBox.jsx`: Added multi-file button
- `ChatLayout.jsx`: Added handleMultiFileUpload()

## Known Limitations

1. Only image files are supported
2. Maximum 50MB total size (not configurable via UI)
3. No upload progress indication
4. Files are uploaded sequentially (not in parallel)
5. Download opens in new tab (no inline preview)

## Troubleshooting

### Issue: Upload fails with 413 error
**Solution:** Files exceed 50MB. Remove some files or reduce file sizes.

### Issue: Upload fails with 415 error
**Solution:** Non-image file detected. Only image files are allowed.

### Issue: Preview not showing
**Solution:** Check browser console for object URL errors. Ensure browser supports object URLs.

### Issue: Memory leak / high memory usage
**Solution:** Object URLs not being revoked. Check component cleanup logic.

### Issue: Download fails with 403
**Solution:** User is not a participant in the chat room. Only participants can download files.

### Issue: Files not appearing in S3
**Solution:** Check S3 credentials and bucket permissions in application.properties.
