import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, UserMinus, UserCheck, UserX, Search, MessageCircle, Ban, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface FriendItem {
  friendship: FriendshipRow;
  profile: ProfileRow;
  isOnline: boolean;
}

interface FriendRequestsPanelProps {
  onOpenDM: (userId: string, userName: string) => void;
}

const ROLE_PRIORITY: Record<string, number> = {
  owner: 0, ceo: 1, founder: 2, co_founder: 3, sr_admin: 4, admin: 5,
  sr_moderator: 6, moderator: 7, education_admin: 8, learning_department: 9,
  learning_manager: 10, vip: 11, elite: 12, platinum: 13, gold: 14,
  silver: 15, premium: 16, pro: 17, plus: 18, basic: 19, friend: 20, user: 21,
};

function getHighestRole(roles: string[]): string {
  if (!roles.length) return 'user';
  return roles.sort((a, b) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99))[0];
}

export function FriendRequestsPanel({ onOpenDM }: FriendRequestsPanelProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'friends' | 'incoming' | 'outgoing' | 'search'>('friends');
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [presenceMap, setPresenceMap] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadFriendships();

    const channel = supabase
      .channel('friendship-updates-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        loadFriendships();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const loadFriendships = async () => {
    if (!user) return;

    const { data: fs } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!fs) return;
    setFriendships(fs);

    // Load profiles for all related users
    const userIds = new Set<string>();
    fs.forEach(f => { userIds.add(f.user_id); userIds.add(f.friend_id); });
    userIds.delete(user.id);

    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', Array.from(userIds));

      const { data: presence } = await supabase
        .from('user_presence')
        .select('user_id, status, last_seen')
        .in('user_id', Array.from(userIds));

      if (profs) {
        const map = new Map<string, ProfileRow>();
        profs.forEach(p => map.set(p.id, p));
        setProfiles(map);
      }
      if (presence) {
        const pMap = new Map<string, string>();
        presence.forEach(p => {
          const isStale = p.last_seen
            ? (Date.now() - new Date(p.last_seen).getTime()) > 90_000
            : true;
          pMap.set(p.user_id, (!isStale && p.status === 'online') ? 'online' : 'offline');
        });
        setPresenceMap(pMap);
      }
    }
  };

  const getOtherUserId = (f: FriendshipRow) => f.user_id === user?.id ? f.friend_id : f.user_id;

  const accepted = friendships.filter(f => f.status === 'accepted');
  const incoming = friendships.filter(f => f.status === 'pending' && f.friend_id === user?.id);
  const outgoing = friendships.filter(f => f.status === 'pending' && f.user_id === user?.id);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    setIsSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .neq('id', user.id)
      .ilike('name', `%${searchQuery.trim()}%`)
      .limit(20);
    setSearchResults(data || []);
    setIsSearching(false);
  };

  const sendRequest = async (friendId: string) => {
    if (!user) return;
    if (friendId === user.id) { toast.error("Can't add yourself"); return; }

    // Check for existing
    const existing = friendships.find(
      f => (f.user_id === friendId && f.friend_id === user.id) ||
           (f.user_id === user.id && f.friend_id === friendId)
    );
    if (existing) {
      if (existing.status === 'accepted') toast.info('Already friends');
      else if (existing.status === 'pending') toast.info('Request already pending');
      else if (existing.status === 'blocked') toast.error('This user is blocked');
      return;
    }

    setLoadingAction(friendId);
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_id: friendId, status: 'pending' });

    if (error) toast.error('Failed to send request');
    else { toast.success('Friend request sent!'); loadFriendships(); }
    setLoadingAction(null);
  };

  const acceptRequest = async (friendshipId: string) => {
    setLoadingAction(friendshipId);
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (error) toast.error('Failed to accept');
    else { toast.success('Friend request accepted!'); loadFriendships(); }
    setLoadingAction(null);
  };

  const rejectRequest = async (friendshipId: string) => {
    setLoadingAction(friendshipId);
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) toast.error('Failed to reject');
    else { toast.success('Request rejected'); loadFriendships(); }
    setLoadingAction(null);
  };

  const cancelRequest = async (friendshipId: string) => {
    setLoadingAction(friendshipId);
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) toast.error('Failed to cancel');
    else { toast.success('Request cancelled'); loadFriendships(); }
    setLoadingAction(null);
  };

  const removeFriend = async (friendshipId: string) => {
    setLoadingAction(friendshipId);
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) toast.error('Failed to remove');
    else { toast.success('Friend removed'); loadFriendships(); }
    setLoadingAction(null);
  };

  const blockUser = async (friendshipId: string) => {
    setLoadingAction(friendshipId);
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked' })
      .eq('id', friendshipId);
    if (error) toast.error('Failed to block');
    else { toast.success('User blocked'); loadFriendships(); }
    setLoadingAction(null);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 3600000;
    if (diff < 24) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderUserRow = (profile: ProfileRow, isOnline: boolean, actions: React.ReactNode) => (
    <div key={profile.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
      <div className="relative">
        <Avatar className="h-10 w-10">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="text-xs bg-blue-500/10 text-blue-600">{getInitials(profile.name)}</AvatarFallback>
        </Avatar>
        <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
          isOnline ? 'bg-emerald-500' : 'bg-gray-400'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{profile.name}</p>
        <p className="text-xs text-muted-foreground truncate">{isOnline ? 'Online' : 'Offline'}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">{actions}</div>
    </div>
  );

  const getExistingStatus = (profileId: string) => {
    const f = friendships.find(
      fs => (fs.user_id === profileId && fs.friend_id === user?.id) ||
            (fs.user_id === user?.id && fs.friend_id === profileId)
    );
    return f?.status || 'none';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">Friends</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="friends" className="text-xs relative">
              Friends
              {accepted.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">({accepted.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="text-xs relative">
              Incoming
              {incoming.length > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {incoming.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="text-xs">
              Sent
              {outgoing.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">({outgoing.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs">
              <Search className="h-3.5 w-3.5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {/* FRIENDS TAB */}
          {tab === 'friends' && (
            accepted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No friends yet</p>
                <p className="text-xs mt-1">Search for users to add friends</p>
              </div>
            ) : (
              accepted.map(f => {
                const otherId = getOtherUserId(f);
                const profile = profiles.get(otherId);
                if (!profile) return null;
                const isOnline = presenceMap.get(otherId) === 'online';
                return renderUserRow(profile, isOnline, (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenDM(profile.id, profile.name)} title="Message">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeFriend(f.id)} title="Remove friend"
                      disabled={loadingAction === f.id}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </>
                ));
              })
            )
          )}

          {/* INCOMING TAB */}
          {tab === 'incoming' && (
            incoming.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No incoming requests</p>
              </div>
            ) : (
              incoming.map(f => {
                const otherId = getOtherUserId(f);
                const profile = profiles.get(otherId);
                if (!profile) return null;
                const isOnline = presenceMap.get(otherId) === 'online';
                return renderUserRow(profile, isOnline, (
                  <>
                    <Button size="sm" variant="default" className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => acceptRequest(f.id)} disabled={loadingAction === f.id}>
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30"
                      onClick={() => rejectRequest(f.id)} disabled={loadingAction === f.id}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </>
                ));
              })
            )
          )}

          {/* OUTGOING TAB */}
          {tab === 'outgoing' && (
            outgoing.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No pending requests</p>
              </div>
            ) : (
              outgoing.map(f => {
                const otherId = getOtherUserId(f);
                const profile = profiles.get(otherId);
                if (!profile) return null;
                const isOnline = presenceMap.get(otherId) === 'online';
                return renderUserRow(profile, isOnline, (
                  <Button size="sm" variant="outline" className="h-8"
                    onClick={() => cancelRequest(f.id)} disabled={loadingAction === f.id}>
                    Cancel
                  </Button>
                ));
              })
            )
          )}

          {/* SEARCH TAB */}
          {tab === 'search' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-9"
                />
                <Button size="sm" onClick={handleSearch} disabled={isSearching} className="h-9">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {searchResults.length === 0 && !isSearching && searchQuery && (
                <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
              )}
              {searchResults.map(profile => {
                const status = getExistingStatus(profile.id);
                const isOnline = presenceMap.get(profile.id) === 'online';
                return renderUserRow(profile, isOnline, (
                  status === 'none' ? (
                    <Button size="sm" onClick={() => sendRequest(profile.id)} disabled={loadingAction === profile.id} className="h-8">
                      <UserPlus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  ) : status === 'pending' ? (
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  ) : status === 'accepted' ? (
                    <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">Friends</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Blocked</Badge>
                  )
                ));
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
