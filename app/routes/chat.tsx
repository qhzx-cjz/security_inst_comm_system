// app/routes/chat.tsx

import { useState, useEffect, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, } from "@remix-run/react";
import { Menu } from 'lucide-react';

import ChatInterface from '~/components/ChatInterface';
import FriendsList from '~/components/FriendList';
import { Button } from '~/components/ui/button';
import { getSessionUser, getAuthToken } from '~/utils/session.server';
import { encryptMessage, decryptMessage } from '~/lib/crypto';

// --- 类型定义 ---
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  ip?: string;
  port?: number;
  lastMessage?: { content: string; timestamp: string; };
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
}

// --- 服务器端 Loader ---
export async function loader({ request }: LoaderFunctionArgs) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return redirect("/auth");

  const token = await getAuthToken(request);
  if (!token) return redirect("/auth");

  // 注意：我们不再从loader获取初始好友列表，
  // 因为后端会在WebSocket连接成功后立即推送。
  return json({ user: sessionUser, token });
}

// --- 页面主组件 ---
export default function ChatRoute() {
  const { user, token } = useLoaderData<typeof loader>();
  const ws = useRef<WebSocket | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!token) return;

    const wsUrl = `ws://127.0.0.1:8000/ws?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket Received:", data);

      switch (data.type) {
        // --- 核心修复在这里 ---
        case 'message:receive': {
          const { from, encryptedContent } = data.payload;
          const decryptedContent = decryptMessage(encryptedContent);
          const newMessage: Message = {
            id: Date.now(),
            senderId: from,
            content: decryptedContent,
            timestamp: new Date().toISOString(),
          };
          
          // 更新消息列表
          setMessages(prev => ({
            ...prev,
            [from]: [...(prev[from] || []), newMessage],
          }));
          
          // 更新好友列表的最后一条消息
          setFriends(prevFriends => prevFriends.map(f => f.id === from ? {
            ...f,
            lastMessage: { content: newMessage.content, timestamp: newMessage.timestamp }
          } : f));
          break;
        }
        
        case 'friends:online_list': {
          const initialFriends = data.payload.map((u: any) => ({
            id: u.username,
            name: u.username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
            isOnline: true, 
            ip: u.ip,
            port: u.port
          }));
          setFriends(initialFriends);
          break;
        }
        
        case 'friend:online': {
          const newFriendPayload = data.payload;
          const newFriend: Friend = {
            id: newFriendPayload.username,
            name: newFriendPayload.username,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newFriendPayload.username}`,
            isOnline: true,
            ip: newFriendPayload.ip,
            port: newFriendPayload.port,
          };
          setFriends(prev => {
            const existing = prev.find(f => f.id === newFriend.id);
            if (existing) {
              return prev.map(f => f.id === newFriend.id ? { ...f, isOnline: true } : f);
            }
            return [...prev, newFriend];
          });
          break;
        }
        
        case 'friend:offline': {
          const offlineUsername = data.payload.username;
          setFriends(prev => prev.map(f => f.id === offlineUsername ? { ...f, isOnline: false } : f));
          if(selectedFriend?.id === offlineUsername) {
            setSelectedFriend(prev => prev ? {...prev, isOnline: false} : null);
          }
          break;
        }
      }
    };

    return () => ws.current?.close();
  }, [token, selectedFriend?.id]);

  // 其他函数和JSX保持不变...
  const handleSendMessage = (content: string) => {
    if (!selectedFriend || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    const encryptedContent = encryptMessage(content);
    const messagePayload = { type: "message:send", payload: { to: selectedFriend.id, encryptedContent } };
    ws.current.send(JSON.stringify(messagePayload));
    const ownMessage: Message = { id: Date.now().toString(), senderId: user.username, content, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => ({ ...prev, [selectedFriend.id]: [...(prev[selectedFriend.id] || []), ownMessage] }));
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100">
      <FriendsList 
        friends={friends} 
        selectedFriend={selectedFriend} 
        onSelectFriend={(friend) => setSelectedFriend(friend)} 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSearch={(q) => {}}
        onAddFriend={(name) => {}}
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
            user={user}
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
