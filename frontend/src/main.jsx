import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { SnackbarProvider } from "./components/utils/SnackbarContext";
import App from "./App";
import LoginPage from "./features/auth/pages/LoginPage";
import HomePage from "./features/dashboard/pages/HomePage";
import UserCreateForm from "./features/admin/components/UserCreateForm";
import AdminRoute from "./features/admin/utils/AdminRoute";
import ApprovalHomePage from "./features/approval/pages/ApprovalHomePage";
import ApprovalLayout from "./features/approval/pages/ApprovalLayout";
import AdminHomePage from "./features/admin/pages/AdminHomePage";
import AccountLogPage from "./features/admin/pages/AccountLogPage";
import UserList from "./features/admin/components/UserList";
import ChatHomePage from "./features/chat/pages/ChatHomePage";
import ChatLayout from "./features/chat/pages/ChatLayout";
import EmailLayout from "./features/email/pages/EmailLayout";
import TemplateAdminCreate from "./features/admin/components/TemplateAdminCreate";
import BoardLayout from "./features/board/pages/BoardLayout";
import BoardListPage from "./features/board/pages/BoardListPage";
import BoardDetailPage from "./features/board/pages/BoardDetailPage";
import BoardWritePage from "./features/board/pages/BoardWritePage";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import CalendarPage from "./features/schedule/pages/CalendarPage";
import AdminCategoryPage from "./features/board/pages/AdminCategoryPage";
import MailInboxPage from "./features/email/pages/MailInboxPage";
import MailWritePage from "./features/email/pages/MailWritePage";
import MailTrashPage from "./features/email/pages/MailTrashPage";
import PasswordReset from "./features/admin/components/PasswordReset";
import NewDocumentPage from "./features/approval/pages/NewDocumentPage";
import MailSentBoxPage from "./features/email/pages/MailSentBoxPage";
import MailDetailPage from "./features/email/pages/MailDetailPage";
import DocumentDetailPage from "./features/approval/pages/DocumentDetailPage";
import DraftBoxPage from "./features/email/pages/DraftBoxPage";
import LeaveLayout from "./features/leave/pages/LeaveLayout";
import LeaveHistory from "./features/leave/components/LeaveHistory";
import CompanyLeaveStatus from "./features/leave/components/CompanyLeaveStatus";
import LeaveRequests from "./features/admin/components/LeaveRequests";
import DepartmentManagementPage from "./features/admin/pages/DepartmentManagementPage";
import { RealtimeNotificationProvider } from "./features/notification/RealtimeNotificationProvider";
import PendingDocuments from "./features/approval/pages/PendingDocumentPage";
import MyDocumentsPage from "./features/approval/pages/MyDocumentsPage";
import MyDraftsPage from "./features/approval/pages/MyDraftsPage";
import ReferDocumentPage from "./features/approval/pages/ReferDocumentPage";
import MailReservedPage from "./features/email/pages/MailReservedPage";
import MailFavoritePage from "./features/email/pages/MailFavoritePage";
import AttendanceLayout from "./features/attendance/pages/AttendanceLayout";
import MyAttendanceStatus from "./features/attendance/components/MyAttendanceStatus";
import CompanyAttendanceStatus from "./features/attendance/components/CompanyAttendanceStatus";

/* 전체 라우트 구조 */
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // App.jsx: 공통 레이아웃
    children: [
      {
        path: "home",
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "chat",
        element: (
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ChatHomePage /> },
          // 나중에 /chat/:roomId, /chat/new 등 추가 가능
        ],
      },
      {
        path: "email",
        element: (
          <ProtectedRoute>
            <EmailLayout/>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <MailInboxPage /> },
          { path: "write", element: <MailWritePage /> },
          { path: "trash", element: <MailTrashPage /> },
          { path: "sent", element: <MailSentBoxPage/>},
          { path: "draftbox", element: <DraftBoxPage /> }, // ★ 임시보관함 추가 (동적 경로보다 먼저)
          { path: "reserved", element: <MailReservedPage /> },   // <-- add here
          { path: "favorite", element: <MailFavoritePage /> },   // 중요 메일
          { path: ":emailId", element: <MailDetailPage /> }, // 동적 경로는 마지막에
        ]
      },
      {
        path: "e-approval",
        element: (
          <ProtectedRoute>
            <ApprovalLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ApprovalHomePage /> }, // 결재홈
          { path: "new/:templateId", element: <NewDocumentPage /> }, // 새 결제 진행
          { path: "edit/:documentId", element: <NewDocumentPage />},
          { path: "doc/:documentId", element: <DocumentDetailPage /> },
          { path: "pending", element: <PendingDocuments /> },
          { path: "my-documents", element: <MyDocumentsPage /> },
          { path: "my-drafts", element: <MyDraftsPage />},
          { path: "refer", element: <ReferDocumentPage />},
        ],
      },
      {
        path: "calendar",
        element: (
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "leave",
        element: (
          <ProtectedRoute>
            <LeaveLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <LeaveHistory /> },
          { path: "history", element: <LeaveHistory /> },
          { path: "company", element: <CompanyLeaveStatus /> },
        ],
      },
      {
        path: "attendance",
        element: (
          <ProtectedRoute>
            <AttendanceLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <MyAttendanceStatus /> },
          { path: "my", element: <MyAttendanceStatus /> },
          { path: "company", element: <CompanyAttendanceStatus /> },
        ],
      },
      {
        path: "board",
        element: (
          <ProtectedRoute>
            <BoardLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <BoardListPage /> },
          { path: ":categoryId", element: <BoardListPage /> },
          { path: "search", element: <BoardListPage /> },
          { path: "detail/:boardId", element: <BoardDetailPage /> },
          { path: "new", element: <BoardWritePage /> },
          { path: "edit/:boardId", element: <BoardWritePage /> },
          { path: "category-admin", element: <AdminCategoryPage /> },
        ],
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute>
            <AdminRoute />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AdminHomePage /> },
          { path: "users/create", element: <UserCreateForm /> },
          { path: "users", element: <UserList /> },
          { path: "templates/create", element: <TemplateAdminCreate /> },
          { path: "password-reset-requests", element: <PasswordReset /> },
          { path: "leave-requests", element: <LeaveRequests /> },
          { path: "departments", element: <DepartmentManagementPage /> },
          { path: "account-logs", element: <AccountLogPage /> }
        ],
      },
      {
        index: true,
        element: <Navigate to="/home" replace />, // 루트 경로일 때는 /home으로 이동
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "*",
    element: <div>404 Not Found</div>,
  },
]);

/* 렌더링 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SnackbarProvider>
      <RealtimeNotificationProvider>
        <RouterProvider router={router} />
      </RealtimeNotificationProvider>
    </SnackbarProvider>
  </React.StrictMode>
);