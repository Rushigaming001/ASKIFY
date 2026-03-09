import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, UserMinus, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  status?: 'online' | 'offline' | 'away';
  friendship_status?: 'none' | 'pending' | 'accepted' | 'blocked';
  friendship_id?: string;
  is_request_receiver?: boolean;
}

interface UsersListProps {
  onOpenDM: (userId: string, userName: string) => void;
}

export function UsersList({ onOpenDM }: UsersListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | 'online' | 'friends'>('all');

  useEffect(() => {
    if (!user) return;

    loadUsers();

    // Subscribe to presence updates
    const presenceChannel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => { loadUsers(); }
      )
      .subscribe();

    // Subscribe to friendship updates
    const friendshipChannel = supabase
      .channel('friendships-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => { loadUsers(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(friendshipChannel);
    };
  }, [user]);

  const loadUsers = async () => {
    if (!user) return;

    // Load all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .neq('id', user.id);

    if (!profiles) return;

    // Load presence data
    const { data: presenceData } = await supabase
      .from('user_presence')
      .select('user_id, status, last_seen');

    // Load friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    // Combine data
    const usersWithStatus: User[] = profiles.map(profile => {
      const presence = presenceData?.find(p => p.user_id === profile.id);
      // Treat as offline if last_seen is older than 90 seconds
      const isStale = presence?.last_seen
        ? (Date.now() - new Date(presence.last_seen).getTime()) > 90_000
        : true;
      const friendship = friendships?.find(
        f => f.user_id === profile.id || f.friend_id === profile.id
      );

      let friendshipStatus: 'none' | 'pending' | 'accepted' | 'blocked' = 'none';
      let friendshipId: string | undefined;
      let isRequestReceiver = false; // Track if current user received the request

      if (friendship) {
        friendshipStatus = friendship.status as any;
        friendshipId = friendship.id;
        // If current user is friend_id (receiver) and status is pending, they can accept
        isRequestReceiver = friendship.friend_id === user.id && friendship.status === 'pending';
      }

      return {
        ...profile,
        status: (!isStale && presence?.status === 'online') ? 'online' : 'offline',
        friendship_status: friendshipStatus,
        friendship_id: friendshipId,
        is_request_receiver: isRequestReceiver
      };
    });

    setUsers(usersWithStatus);
  };

  const sendFriendRequest = async (friendId: string) => {
    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: user?.id,
        friend_id: friendId,
        status: 'pending'
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send friend request',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Friend request sent',
        description: 'Your friend request has been sent'
      });
      loadUsers();
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept friend request',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Friend request accepted',
        description: 'You are now friends'
      });
      loadUsers();
    }
  };

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove friend',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Friend removed',
        description: 'Friend has been removed'
      });
      loadUsers();
    }
  };

  const getFilteredUsers = () => {
    let filtered = users;

    if (filter === 'online') {
      filtered = filtered.filter(u => u.status === 'online');
    } else if (filter === 'friends') {
      filtered = filtered.filter(u => u.friendship_status === 'accepted');
    }

    return filtered;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">Users</h2>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'online' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('online')}
          >
            Online
          </Button>
          <Button
            variant={filter === 'friends' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('friends')}
          >
            Friends
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {getFilteredUsers().map(u => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                </Avatar>
                <div
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                    u.status === 'online'
                      ? 'bg-green-500'
                      : u.status === 'away'
                      ? 'bg-yellow-500'
                      : 'bg-muted-foreground/40'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>

              <div className="flex gap-1">
                {u.friendship_status === 'none' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => sendFriendRequest(u.id)}
                    title="Send friend request"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}

                {u.friendship_status === 'pending' && (
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {u.is_request_receiver ? 'Incoming' : 'Sent'}
                    </Badge>
                    {u.is_request_receiver && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => u.friendship_id && acceptFriendRequest(u.friendship_id)}
                        title="Accept friend request"
                      >
                        <UserPlus className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                  </>
                )}

                {u.friendship_status === 'accepted' && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onOpenDM(u.id, u.name)}
                      title="Send message"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => u.friendship_id && removeFriend(u.friendship_id)}
                      title="Remove friend"
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {getFilteredUsers().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}