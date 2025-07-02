import { useState, useRef, useEffect } from 'react';
import { Friend, Message } from '~/pages/Index';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Send, Paperclip, Smile } from 'lucide-react';

interface ChatInterfaceProps {
  friend: Friend;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

const ChatInterface = ({ friend, messages, onSendMessage }: ChatInterfaceProps) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Scroll to bottom of messages when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, [friend.id]);

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
      // Refocus the textarea after sending
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat header */}
      <div className="bg-white p-4 border-b border-gray-200 flex items-center">
        <div className="relative flex-shrink-0">
          <img
            src={friend.avatar}
            alt={friend.name}
            className="h-10 w-10 rounded-full"
          />
          <span 
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white
              ${friend.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
          />
        </div>
        <div className="ml-3">
          <h3 className="font-medium">{friend.name}</h3>
          <p className="text-xs text-gray-500">
            {friend.isOnline ? 'Online' : friend.lastSeen ? `Last seen ${friend.lastSeen}` : 'Offline'}
          </p>
        </div>
      </div>
      
      {/* Chat messages */}
      <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isMe = message.senderId === 'me';
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      isMe 
                        ? 'bg-blue-500 text-white rounded-br-none' 
                        : 'bg-white text-gray-900 rounded-bl-none shadow-sm'
                    }`}
                  >
                    <p>{message.content}</p>
                    <span 
                      className={`text-xs mt-1 block ${
                        isMe ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {message.timestamp}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation with {friend.name}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Message input */}
      <div className="bg-white p-4 border-t border-gray-200">
        <div className="flex items-end">
          <div className="flex-1 mr-2">
            <Textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${friend.name}...`}
              className="min-h-[60px] resize-none"
              maxLength={500}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              size="icon" 
              variant="ghost" 
              className="h-10 w-10 rounded-full"
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
            <Button 
              type="button" 
              size="icon" 
              variant="ghost"
              className="h-10 w-10 rounded-full"
            >
              <Smile className="h-5 w-5" />
              <span className="sr-only">Add emoji</span>
            </Button>
            <Button 
              type="button" 
              onClick={handleSend} 
              disabled={!messageText.trim()} 
              className="rounded-full h-10 w-10"
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;