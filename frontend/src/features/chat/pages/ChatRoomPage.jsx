import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import ChatRoomContainer from "../components/Chat/ChatRoomContainer";
import { UserProfileContext } from "../../../App";

function GetUserName() {
  try {
    const user = useContext(UserProfileContext);
    return user?.name || "";
  } catch {
    return "";
  }
}

// 환경 변수에서 WebSocket base URL 가져오기
// 개발 환경: ws://localhost:8080/ws/chat
// 배포 환경: ws://${window.location.host}/ws/chat 또는 환경 변수 값
const getWebSocketBase = () => {
  if (import.meta.env.VITE_WS_BASE_URL) {
    return import.meta.env.VITE_WS_BASE_URL;
  }
  // 개발 환경 감지 (localhost 또는 127.0.0.1)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return "ws://localhost:8080/ws/chat";
  }
  // 배포 환경: 현재 호스트의 WebSocket 사용
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/chat`;
};

const WEBSOCKET_BASE = getWebSocketBase();

export default function ChatRoomPage() {
  const { roomId } = useParams();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [socket, setSocket] = useState(null);
  const userName = GetUserName();
  const accessToken = localStorage.getItem("accessToken");

  // WebSocket 연결 및 메시지 수신
  useEffect(() => {
    if (!roomId) return;
    const wsUrl = `${WEBSOCKET_BASE}?roomId=${roomId}&accessToken=${accessToken}`;
    const ws = new window.WebSocket(wsUrl);

    ws.onopen = () => {
      // 연결 성공시
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
    };
    ws.onclose = () => {
      // 연결 종료시
    };
    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [roomId, accessToken]);

  // 메시지 전송 함수
  const handleSend = () => {
    if (socket && socket.readyState === 1 && inputValue.trim()) {
      socket.send(JSON.stringify({ roomId, content: inputValue }));
      setInputValue("");
    }
  };

  return (
    <ChatRoomContainer
      roomId={roomId}
      messages={messages}
      userName={userName}
      inputValue={inputValue}
      setInputValue={setInputValue}
      onSend={handleSend}
    />
  );
}