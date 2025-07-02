import { useState, useRef, useEffect } from 'react';
import { Friend } from '~/pages/Index';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { X, Search, Plus, Check } from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

interface FriendsListProps {
  friends: Friend[];
  selectedFriend: Friend | null;
  onSelectFriend: (friend: Friend) => void;
  isOpen: boolean;
  onToggle: () => void;
  onSearch: (query: string) => void;
  onAddFriend: (name: string) => void;
}

const FriendsList = ({
  friends,
  selectedFriend,
  onSelectFriend,
  isOpen,
  onToggle,
  onSearch,
  onAddFriend,
}: FriendsListProps) => {
  const [searchValue, setSearchValue] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Focus search input when dialog opens
  useEffect(() => {
    if (isDialogOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isDialogOpen]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch(value);
  };

  const handleAddFriend = () => {
    if (newFriendName.trim()) {
      onAddFriend(newFriendName.trim());
      setNewFriendName('');
      setIsDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddFriend();
    }
  };

  return (
    <div 
      className={`bg-white h-full border-r border-gray-200 flex-shrink-0 transition-all duration-300 ease-in-out
        ${isOpen ? 'w-80 md:w-72' : 'w-0 md:w-0 overflow-hidden'}`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 flex flex-shrink-0 items-center justify-between">
          <h2 className="text-xl font-bold">Chats</h2>
          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Add friend</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Friend</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col space-y-4 pt-4">
                  <Input
                    ref={searchInputRef}
                    placeholder="Friend name"
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <Button onClick={handleAddFriend} disabled={!newFriendName.trim()}>
                    Add Friend
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onToggle} 
              className="h-8 w-8 md:hidden"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          </div>
        </div>
        
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search friends"
              className="pl-8"
              value={searchValue}
              onChange={handleSearch}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {friends.length > 0 ? (
            <ul>
              {friends.map((friend) => (
                <li key={friend.id}>
                  <button
                    onClick={() => onSelectFriend(friend)}
                    className={`w-full flex items-center px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition
                      ${selectedFriend?.id === friend.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="h-12 w-12 rounded-full"
                      />
                      <span 
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white
                          ${friend.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden text-left">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{friend.name}</p>
                        {friend.lastMessage && (
                          <span className="text-xs text-gray-500">
                            {friend.lastMessage.timestamp}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        {friend.lastMessage ? (
                          <p className="text-sm text-gray-500 truncate">
                            {friend.lastMessage.content}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            {friend.isOnline ? 'Online' : friend.lastSeen ? `Last seen ${friend.lastSeen}` : 'Offline'}
                          </p>
                        )}
                        {friend.lastMessage && !friend.lastMessage.isRead && (
                          <span className="ml-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <p className="text-gray-500 mb-4">No friends found</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                Add New Friend
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsList;