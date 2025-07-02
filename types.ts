// app/types.ts

/**
 * 代表一个好友或用户
 */
export interface Friend {
    id: string; // 通常是用户名
    name: string;
    avatar: string; // 头像URL
    isOnline: boolean;
    lastMessage?: {
      content: string;
      timestamp: string;
      isRead: boolean;
    };
    lastSeen?: string;
  }
  
  /**
   * 代表一条聊天消息
   */
  export interface Message {
    id: string; // 消息的唯一ID
    senderId: string; // 发送者ID, 'me' 代表自己
    content: string;
    timestamp: string;
  }
  