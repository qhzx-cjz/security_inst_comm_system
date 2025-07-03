// app/components/ChatInterface.tsx

import { useState, useRef, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Send, Paperclip, File as FileIcon } from 'lucide-react';
import type { Friend, Message, File } from '~/routes/chat'; // 从chat.tsx导入类型

// 新增：一个辅助函数，用于将文件大小格式化为可读字符串
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface ChatInterfaceProps {
  friend: Friend;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onFileSelect: (file: File) => void;
  user: { username: string }; // 新增：接收当前登录的用户信息
}

export default function ChatInterface({ friend, messages, user, onSendMessage, onFileSelect }: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 消息变化时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file); // 如果用户选择了文件，则调用父组件传来的回调函数
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click(); // 以编程方式触发隐藏文件输入框的点击事件
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* 聊天头部 */}
      <div className="bg-white p-4 border-b flex items-center shadow-sm">
        <div className="relative">
          <img src={friend.avatar} alt={friend.name} className="h-10 w-10 rounded-full" />
          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${friend.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>
        <div className="ml-3">
          <h3 className="font-medium">{friend.name}</h3>
          <p className="text-xs text-gray-500">{friend.isOnline ? 'Online' : 'Offline'}</p>
        </div>
      </div>
      
      {/* 聊天消息区域 */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message) => {
            // 判断消息是否由当前登录用户发送
            const isMe = message.senderId === user.username;
            
            return (
              <div key={message.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {message.type === 'file' && message.file ? (
                  // 文件消息气泡
                  <a 
                    href={message.file.blobUrl}
                    download={message.file.fileName}
                    className={`flex items-center gap-3 p-3 cursor-pointer ${!message.file.blobUrl ? 'opacity-50 pointer-events-none' : ''}`}
                    title={message.file.blobUrl ? `Download ${message.file.fileName}` : 'File processing...'}
                  >
                    <FileIcon className="h-10 w-10 flex-shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{message.file.fileName}</p>
                      <p className="text-xs opacity-80">{formatBytes(message.file.fileSize)}</p>
                    </div>
                  </a>
                ) : (
                  // 文本消息气泡
                  <div 
                    className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                      isMe 
                        ? 'bg-primary text-primary-foreground rounded-br-none' // 我发出的消息：深色背景，白色文字
                        : 'bg-card text-card-foreground rounded-bl-none'      // 接收到的消息：白色背景，深色文字
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <span className={`text-xs mt-1 block text-right opacity-70`}>
                      {message.timestamp}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 消息输入框 */}
      <div className="bg-white p-4 border-t">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${friend.name} from ${friend.ip}:${friend.port}...`}
            className="flex-1 resize-none border-gray-300 rounded-lg mr-4"
            rows={1}
          />

            <Button 
              type="button" 
              size="icon" 
              variant="ghost" 
              className="h-10 w-10 rounded-full"
              onClick={handleAttachClick}
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
            <Button 
              type="button" 
              onClick={handleSend} 
              disabled={!messageText.trim()}
              className="rounded-full h-10 w-10 p-2"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
  );
}
