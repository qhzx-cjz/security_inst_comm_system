// app/routes/chat.tsx

import { useState, useEffect, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, } from "@remix-run/react";
import { Menu } from 'lucide-react';

import ChatInterface from '~/components/ChatInterface';
import FriendsList from '~/components/FriendList';
import { Button } from '~/components/ui/button';
import { getSessionUser, getAuthToken } from '~/utils/session.server';
import { generateAndStoreKeys, encryptMessage, decryptMessage } from '~/utils/crypto.client'; // 导入密钥生成函数

// --- 类型定义 ---
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  publicKey?: string; // 新增：用于缓存好友的公钥
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

// --- API 辅助函数 ---
async function uploadPublicKey(publicKey: string, token: string) {
  const response = await fetch(`http://127.0.0.1:8000/api/users/me/key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ publicKey }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '公钥上传失败');
  }

  return response.json();
}

// --- 页面主组件 ---
export default function ChatRoute() {
  const { user, token } = useLoaderData<typeof loader>();
  const ws = useRef<WebSocket | null>(null);

  // --- 新增：自动生成和上传公钥的逻辑 ---
  useEffect(() => {
    const setupKeys = async () => {
      if (user && !user.hasPublicKey && token) {
        try {
          console.log("用户没有公钥，开始生成和上传...");
          const publicKey = await generateAndStoreKeys();
          await uploadPublicKey(publicKey, token);
          console.log("公钥成功上传！");
          // 你可以在这里更新UI或状态，例如移除一个“设置密钥”的提示
        } catch (error) {
          console.error("密钥设置失败:", error);
          // 可以在这里向用户显示一个错误消息
        }
      }
    };

    setupKeys();
  }, [user, token]);

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

          // 使用 async IIFE (立即执行的异步函数) 来处理解密
          (async () => {
            try {
              const decryptedContent = await decryptMessage(encryptedContent);
              const newMessage: Message = {
                id: new Date().toISOString(), // 使用更唯一的ID
                senderId: from,
                content: decryptedContent, // 这是解密后的文本
                timestamp: new Date().toISOString(),
              };

              // 安全地更新消息列表
              setMessages(prev => ({
                ...prev,
                [from]: [...(prev[from] || []), newMessage],
              }));

              // 更新好友列表的最后一条消息
              setFriends(prevFriends => prevFriends.map(f => 
                f.id === from 
                  ? { ...f, lastMessage: { content: decryptedContent, timestamp: newMessage.timestamp } } 
                  : f
              ));

            } catch (error) {
              console.error("消息解密失败:", error);
              // 可选：在这里向用户显示一条错误消息
            }
          })();
          
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
  const handleSendMessage = async (content: string) => {
    if (!selectedFriend || !ws.current || ws.current.readyState !== WebSocket.OPEN || !token || !user) return;

    try {
      let publicKey = selectedFriend.publicKey;

      // 1. 如果本地没有公钥，则从服务器获取
      if (!publicKey) {
        console.log(`正在为 ${selectedFriend.id} 获取公钥...`);
        const response = await fetch(`http://127.0.0.1:8000/api/users/${selectedFriend.id}/key`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("获取对方公钥失败");
        const keyData = await response.json();
        publicKey = keyData.publicKey;

        // 2. 缓存公钥到 friends 状态中
        if (publicKey) {
          setFriends(prev => prev.map(f => f.id === selectedFriend.id ? { ...f, publicKey } : f));
        } else {
          throw new Error("服务器未返回有效的公钥");
        }
      }
      
      // 3. 使用获取到的公钥加密消息
      console.log("正在加密消息...");
      const encryptedContent = await encryptMessage(content, publicKey);
      
      // 4. 发送加密后的消息
      const messagePayload = { type: "message:send", payload: { to: selectedFriend.id, encryptedContent } };
      ws.current.send(JSON.stringify(messagePayload));
      
      // 5. 在自己的界面上显示明文消息
      const ownMessage: Message = { 
        id: new Date().toISOString(), 
        senderId: user.username, 
        content, 
        timestamp: new Date().toISOString() 
      };
      setMessages(prev => ({ ...prev, [selectedFriend.id]: [...(prev[selectedFriend.id] || []), ownMessage] }));

    } catch (error) {
      console.error("发送消息失败:", error);
      // 可以在此向用户显示错误提示
    }
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
