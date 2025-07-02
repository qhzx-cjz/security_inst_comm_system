export interface Message {
  id: string;
  content: string;
  timestamp: string;
  sender: 'me' | 'friend';
  isRead?: boolean;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastSeen?: string;
  messages: Message[];
  lastMessage?: {
    content: string;
    timestamp: string;
    isRead: boolean;
  };
}
