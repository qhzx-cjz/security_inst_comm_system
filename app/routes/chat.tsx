// app/routes/chat.tsx

import { useState, useEffect } from 'react';
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Menu } from 'lucide-react';

// 导入您的组件和UI库
import ChatInterface from '~/components/ChatInterface';
import FriendsList from '~/components/FriendList';
import { Button } from '~/components/ui/button';
import { getSessionUser } from '~/utils/session.server';

// --- 类型定义 ---
// 最佳实践是将这些类型移动到 app/types.ts 文件中
export interface Friend {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastSeen?: string;
  lastMessage?: {
    content: string;
    timestamp: string;
    isRead: boolean;
  };
}

export interface Message {
  id: string;
  senderId: string; // 'me' 或 friend.id
  content: string;
  timestamp: string;
}

// --- 服务器端 Loader ---
// 这个函数会在页面加载前在服务器上运行
export async function loader({ request }: LoaderFunctionArgs) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    // 如果用户未登录，重定向到登录页面
    return redirect("/auth");
  }
  // 将用户信息传递给前端组件
  return json({ user: sessionUser });
}


// --- 页面主组件 ---
// 我们将您在 index.tsx 中编写的 ChatPage 组件作为这里的默认导出
export default function ChatRoute() {
  const { user } = useLoaderData<typeof loader>();

  // --- 您提供的所有状态和模拟数据 ---
  const mockFriends: Friend[] = [
    { id: '1', name: 'Alex Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', isOnline: true, lastMessage: { content: 'Hey! How are you doing?', timestamp: '10:30 AM', isRead: true } },
    { id: '2', name: 'Sarah Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', isOnline: true, lastMessage: { content: 'Can we meet tomorrow?', timestamp: '9:45 AM', isRead: false } },
    { id: '3', name: 'Mike Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike', isOnline: false, lastSeen: '2 hours ago', lastMessage: { content: 'I will send you the documents later', timestamp: 'Yesterday', isRead: true } },
  ];

  const initialMessages: Record<string, Message[]> = {
    '1': [
      { id: '101', senderId: '1', content: 'Hey! How are you doing?', timestamp: '10:30 AM' },
      { id: '102', senderId: 'me', content: 'I am good, thanks! How about you?', timestamp: '10:32 AM' },
    ],
    '2': [
      { id: '201', senderId: '2', content: 'Can we meet tomorrow?', timestamp: '9:45 AM' },
    ],
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(mockFriends[0]);
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  
  // 移动端响应式处理
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 您提供的所有事件处理函数 ---
  const handleFriendSelect = (friend: Friend) => {
    setSelectedFriend(friend);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedFriend) return;
    
    const newMessage: Message = {
      id: `${Date.now()}`,
      senderId: 'me',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    // 这个逻辑会立刻更新UI，修复了“发送后没反应”的问题
    setMessages(prev => ({
      ...prev,
      [selectedFriend.id]: [...(prev[selectedFriend.id] || []), newMessage],
    }));
  };

  const handleSearchFriend = (query: string) => {
    if (!query.trim()) {
      setFriends(mockFriends);
      return;
    }
    const filteredFriends = mockFriends.filter(friend => 
      friend.name.toLowerCase().includes(query.toLowerCase())
    );
    setFriends(filteredFriends);
  };

  const handleAddFriend = (name: string) => {
    // ... (您的添加好友逻辑)
  };

  // --- 最终的 JSX 布局 ---
  // 使用了 flex 和 h-[calc(...)] 来确保布局在导航栏下正确显示
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100">
      {/* 侧边栏好友列表 */}
      <FriendsList 
        friends={friends} 
        selectedFriend={selectedFriend} 
        onSelectFriend={handleFriendSelect} 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSearch={handleSearchFriend}
        onAddFriend={handleAddFriend}
      />

      {/* 主聊天区 */}
      <div className="flex-1 flex flex-col min-w-0"> {/* min-w-0 修复flex布局溢出问题 */}
        {/* 移动端菜单按钮 */}
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
            <p>Select a friend to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
