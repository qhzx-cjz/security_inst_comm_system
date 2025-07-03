// app/routes/chat.tsx

import { useState, useEffect, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, } from "@remix-run/react";
import { Menu, FileText, Download } from 'lucide-react';

import ChatInterface from '~/components/ChatInterface';
import FriendsList from '~/components/FriendList';
import { Button } from '~/components/ui/button';
import { getSessionUser, getAuthToken } from '~/utils/session.server';
import { 
  generateAndStoreKeys, 
  encryptMessage, 
  decryptMessage,
  encryptFile,
  decryptFile,
} from '~/utils/crypto.client'; // 导入加密/解密及密钥生成函数

// --- 类型定义 ---
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  publicKey?: string; // 新增：用于缓存好友的公钥
  lastMessage?: { content: string; timestamp: string; };
  ip: string,
  port: number
}

interface FileMessage {
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl?: string; // 用于下载解密后的文件
  status?: 'sending' | 'sent' | 'failed'; // 用于跟踪文件上传状态
}

export interface Message {
  id: string;
  senderId: string;
  content: string; // 对于文件消息，这里可以为空
  timestamp: string;
  type: 'text' | 'file';
  file?: FileMessage; 
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

// --- 辅助函数 ---
// 将Blob转换为Base64字符串
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // 结果是 "data:;base64,...."，我们只需要逗号后面的部分
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 将Base64字符串转换为ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

// --- 页面主组件 ---
export default function ChatRoute() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, token } = useLoaderData<typeof loader>();
  const ws = useRef<WebSocket | null>(null);

  // --- 自动生成和上传公钥的逻辑 ---
  useEffect(() => {
    const setupKeys = async () => {
      if (user && !user.hasPublicKey && token) {
        try {
          console.log("用户没有公钥，开始生成和上传...");
          const publicKey = await generateAndStoreKeys();
          await uploadPublicKey(publicKey, token);
          console.log("公钥成功上传！");
        } catch (error) {
          console.error("密钥设置失败:", error);
        }
      }
    };
    setupKeys();
  }, [user, token]);

  // --- WebSocket 连接和消息处理 ---
  useEffect(() => {
    if (!token) return;
    const wsUrl = `ws://127.0.0.1:8000/ws?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket Received:", data);

      switch (data.type) {
        case 'message:receive': {
          const { from, encryptedContent } = data.payload;
          (async () => {
            try {
              const decryptedContent = await decryptMessage(encryptedContent);
              const newMessage: Message = {
                id: new Date().toISOString(),
                senderId: from,
                content: decryptedContent,
                timestamp: new Date().toISOString(),
                type: 'text'
              };
              setMessages(prev => ({ ...prev, [from]: [...(prev[from] || []), newMessage] }));
              setFriends(prev => prev.map(f => 
                f.id === from 
                  ? { ...f, lastMessage: { content: decryptedContent, timestamp: newMessage.timestamp } } 
                  : f
              ));
            } catch (error) {
              console.error("消息解密失败:", error);
              // 在这里向用户显示一条错误消息
            }
          })();
          break;
        }
        
        case 'file:receive': {
          const { from, fileName, fileType, encryptedFile, encryptedKey } = data.payload;
          (async () => {
            try {
              // 1. 将Base64数据转换回原始格式
              const encryptedFileBlob = new Blob([base64ToArrayBuffer(encryptedFile)], { type: fileType });
              const encryptedKeyArrayBuffer = base64ToArrayBuffer(encryptedKey);

              // 2. 解密文件
              const decryptedBlob = await decryptFile(encryptedFileBlob, encryptedKeyArrayBuffer);
              const blobUrl = URL.createObjectURL(decryptedBlob);

              // 3. 创建文件消息并更新UI
              const newMessage: Message = {
                id: new Date().toISOString(),
                senderId: from,
                content: '', // 文件消息没有文本内容
                timestamp: new Date().toISOString(),
                type: 'file',
                file: {
                  fileName,
                  fileType,
                  fileSize: decryptedBlob.size,
                  blobUrl, // 这个URL用于后续的下载
                  status: 'sent'
                },
              };
              setMessages(prev => ({ ...prev, [from]: [...(prev[from] || []), newMessage] }));
            } catch (error) {
              console.error('文件解密失败:', error);
              // 可以在此向用户显示错误提示
            }
          })();
          break;
        }

        // ... (其他case保持不变)
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

  // --- 获取公钥的通用函数 ---
  const getFriendPublicKey = async (friendId: string): Promise<string> => {
    const friend = friends.find(f => f.id === friendId);
    if (friend?.publicKey) return friend.publicKey;

    console.log(`正在为 ${friendId} 获取公钥...`);
    const response = await fetch(`http://127.0.0.1:8000/api/users/${friendId}/key`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error("获取对方公钥失败");
    const keyData = await response.json();
    const publicKey = keyData.publicKey;

        // 2. 缓存公钥到 friends 状态中
    if (publicKey) {
      setFriends(prev => prev.map(f => f.id === friendId ? { ...f, publicKey } : f));
      return publicKey;
    } else {
      throw new Error("服务器未返回有效的公钥");
    }
  };

  // --- 消息和文件发送处理 ---
  const handleSendMessage = async (content: string) => {
    if (!selectedFriend || !ws.current || ws.current.readyState !== WebSocket.OPEN || !user) return;
    try {
      const publicKey = await getFriendPublicKey(selectedFriend.id);
      const encryptedContent = await encryptMessage(content, publicKey);
      
      // 4. 发送加密后的消息
      const messagePayload = { type: "message:send", payload: { to: selectedFriend.id, encryptedContent } };
      ws.current.send(JSON.stringify(messagePayload));
      
      // 5. 在自己的界面上显示明文消息
      const ownMessage: Message = { 
        id: new Date().toISOString(), 
        senderId: user.username, 
        content, 
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => ({ ...prev, [selectedFriend.id]: [...(prev[selectedFriend.id] || []), ownMessage] }));
    } catch (error) {
      console.error("发送消息失败:", error);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!selectedFriend || !ws.current || ws.current.readyState !== WebSocket.OPEN || !user) return;
    
    const tempId = new Date().toISOString();
    // 立即在UI上显示一个占位消息
    const optimisticMessage: Message = {
      id: tempId,
      senderId: user.username,
      content: '',
      timestamp: tempId,
      type: 'file',
      file: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        status: 'sending',
      },
    };
    setMessages(prev => ({ ...prev, [selectedFriend.id]: [...(prev[selectedFriend.id] || []), optimisticMessage] }));

    try {
      // 1. 获取公钥
      const publicKey = await getFriendPublicKey(selectedFriend.id);

      // 2. 加密文件和对称密钥
      const { encryptedFile, encryptedKey } = await encryptFile(file, publicKey);

      // 3. 将Blob转换为Base64以便通过JSON传输
      const fileData = await blobToBase64(encryptedFile);
      const keyData = await blobToBase64(encryptedKey);

      // 4. 通过WebSocket发送
      const payload = {
        type: 'file:send',
        payload: {
          to: selectedFriend.id,
          fileName: file.name,
          fileType: file.type,
          encryptedFile: fileData, // 修正字段名以匹配后端
          encryptedKey: keyData,   // 修正字段名以匹配后端
        },
      };
      ws.current.send(JSON.stringify(payload));

      // 5. 更新UI状态为'sent'
      setMessages(prev => ({
        ...prev,
        [selectedFriend.id]: prev[selectedFriend.id].map(m => 
          m.id === tempId ? { ...m, file: { ...m.file!, status: 'sent' } } : m
        ),
      }));

    } catch (error) {
      console.error("文件发送失败:", error);
      // 更新UI状态为'failed'
      setMessages(prev => ({
        ...prev,
        [selectedFriend.id]: prev[selectedFriend.id].map(m => 
          m.id === tempId ? { ...m, file: { ...m.file!, status: 'failed' } } : m
        ),
      }));
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
            onFileSelect={handleFileSelect} // 传递文件处理函数
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
