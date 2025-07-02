// app/routes/chat.tsx

import { useState, useEffect, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Menu } from 'lucide-react';

import ChatInterface from '~/components/ChatInterface';
import FriendsList from '~/components/FriendList';
import { Button } from '~/components/ui/button';
import { getSessionUser, getAuthToken } from '~/utils/session.server';

// --- 类型定义 (建议放在 app/types.ts) ---
export interface Friend {
  id: string; // 用户名作为ID
  name: string;
  avatar: string;
  isOnline: boolean;
  lastMessage?: { content: string; timestamp: string; isRead: boolean; };
}

export interface Message {
  id: string;
  senderId: string; // 'me' 或 friend.id
  content: string;
  timestamp: string;
}

// --- 服务器端 Loader ---
export async function loader({ request }: LoaderFunctionArgs) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return redirect("/auth");
  }

  const token = await getAuthToken(request);
  if (!token) {
    // 理论上用户已登录，token必定存在
    return redirect("/auth");
  }

  // 从后端API获取初始在线用户列表
  let initialFriends: Friend[] = [];
  try {
    const response = await fetch("http://127.0.0.1:8000/api/users/online", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      initialFriends = data.users.map(u => ({
        id: u.username,
        name: u.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
        isOnline: u.status === 'online',
      }));
    }
  } catch (error) {
    console.error("Failed to fetch online friends:", error);
  }

  return json({ user: sessionUser, initialFriends, token });
}

// --- 页面主组件 ---
export default function ChatRoute() {
  const { user, initialFriends, token } = useLoaderData<typeof loader>();
  const ws = useRef<WebSocket | null>(null);

  // --- 状态管理 ---
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // --- 实时通信 Effect ---
  useEffect(() => {
    if (!token) return;

    const wsUrl = `ws://127.0.0.1:8000/ws?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log("✅ WebSocket connection established");
    ws.current.onclose = () => console.log("❌ WebSocket connection closed");
    ws.current.onerror = (err) => console.error("WebSocket error:", err);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket 收到消息:", data);

      switch (data.type) {
        case 'message:receive':
          // TODO: 在这里解密 data.payload.encryptedContent
          const decryptedContent = data.payload.encryptedContent; // 临时做法
          
          const newMessage: Message = {
            id: new Date().toISOString(),
            senderId: data.payload.from,
            content: decryptedContent,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          
          // 更新消息列表
          setMessages(prev => ({
            ...prev,
            [data.payload.from]: [...(prev[data.payload.from] || []), newMessage],
          }));
          
          // 更新好友列表的最后一条消息
          setFriends(prevFriends => prevFriends.map(f => f.id === data.payload.from ? {
            ...f,
            lastMessage: { content: decryptedContent, timestamp: newMessage.timestamp, isRead: f.id !== selectedFriend?.id }
          } : f));
          break;
        
        // TODO: 在后端实现 user:online 和 user:offline 事件的广播
      }
    };

    // 组件卸载时关闭连接
    return () => ws.current?.close();
  }, [token, selectedFriend?.id]); // 依赖token和当前选中的好友

  // 移动端响应式
  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 事件处理函数 ---
  const handleSendMessage = (content: string) => {
    if (!selectedFriend || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    
    // TODO: 在这里加密 content
    const encryptedContent = content; // 临时做法

    const messagePayload = {
      type: "message:send",
      payload: { to: selectedFriend.id, encryptedContent },
    };
    
    ws.current.send(JSON.stringify(messagePayload));

    // 立即在UI上显示自己发送的消息
    const ownMessage: Message = {
      id: new Date().toISOString(),
      senderId: user.username, // 使用当前登录用户的用户名
      content: content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => ({
      ...prev,
      [selectedFriend.id]: [...(prev[selectedFriend.id] || []), ownMessage],
    }));
    setFriends(prevFriends => prevFriends.map(f => f.id === selectedFriend.id ? {
      ...f,
      lastMessage: { content, timestamp: ownMessage.timestamp, isRead: true }
    } : f));
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100">
      <FriendsList 
        friends={friends} 
        selectedFriend={selectedFriend} 
        onSelectFriend={(friend) => setSelectedFriend(friend)} 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSearch={(q) => console.log("Searching:", q)} // TODO: 实现搜索
        onAddFriend={(name) => console.log("Adding:", name)} // TODO: 实现添加好友
      />

      <div className="flex-1 flex flex-col min-w-0">
        {!sidebarOpen && (
          <div className="p-2 md:hidden border-b bg-white">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        )}
        
        {selectedFriend ? (
          <ChatInterface 
            friend={selectedFriend}
            messages={messages[selectedFriend.id] || []}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>选择一个好友开始聊天</p>
          </div>
        )}
      </div>
    </div>
  );
}
