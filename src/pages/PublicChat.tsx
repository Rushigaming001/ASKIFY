import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Users, MoreVertical, Edit2, Trash2, UserCircle, Video, Phone, Reply, X, Music, Shield, Lock, Trash, Copy } from 'lucide-react';
import { ClearAllMessagesButton } from '@/components/ClearAllMessagesButton';
import { EnhancedChatInput, TypingIndicator, useTypingIndicator, DateSeparator, isDifferentDay, MusicBotPanel } from '@/components/chat';
import { WebRTCCall } from '@/components/WebRTCCall';
import { GroupsList } from '@/components/GroupsList';
import { GroupChat } from '@/components/GroupChat';
import { useToast } from '@/hooks/use-toast';
import { UserModerationDialog } from '@/components/UserModerationDialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserRestrictions } from '@/hooks/useUserRestrictions';
import { MentionInput } from '@/components/MentionInput';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FriendRequestsPanel } from '@/components/FriendRequestsPanel';
import { DirectMessageChat } from '@/components/DirectMessageChat';
import { UserProfileDialog } from '@/components/UserProfileDialog';

interface PublicMessage {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  deleted_by?: string;
  edit_history?: any[];
  reply_to?: string;
  profiles: {
    name: string;
    email: string;
    avatar_url?: string;
  };
  user_role?: string;
}

interface MentionedUser {
  id: string;
  name: string;
}

const PublicChat = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sendNotification } = usePushNotifications();
  const { restrictions } = useUserRestrictions();
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showUsersList, setShowUsersList] = useState(false);
  const [showGroupsList, setShowGroupsList] = useState(false);
  const [activeDM, setActiveDM] = useState<{ userId: string; userName: string } | null>(null);
  const [activeGroup, setActiveGroup] = useState<{ groupId: string; groupName: string } | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [replyingTo, setReplyingTo] = useState<PublicMessage | null>(null);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [moderatingUser, setModeratingUser] = useState<{ userId: string; userName: string } | null>(null);
  const [userRestrictionData, setUserRestrictionData] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string }[]>([]);
  const [viewingProfile, setViewingProfile] = useState<{ userId: string; userName: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Typing indicator
  const { sendTyping } = useTypingIndicator('public-chat', user?.id, user?.name);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // Check if user is banned
    if (restrictions.banned_from_public_chat) {
      toast({
        title: 'Access Denied',
        description: 'You are banned from public chat',
        variant: 'destructive'
      });
      navigate('/');
      return;
    }

    // Check if user is owner or admin
    const checkAdminStatus = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin']);
      
      const roles = data?.map(r => r.role) || [];
      setIsOwner(roles.includes('owner'));
      setIsAdmin(roles.includes('owner') || roles.includes('admin'));
    };

    // Load all profiles for @mention lookup
    const loadProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name');
      if (data) {
        setAllProfiles(data);
      }
    };

    checkAdminStatus();
    loadMessages();
    loadProfiles();

    // Subscribe to new messages
    const channel = supabase
      .channel('public-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'public_messages'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', payload.new.user_id)
              .single();

            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', payload.new.user_id);
            
            // Pick highest priority role
            const ROLE_PRI: Record<string, number> = {
              owner: 0, ceo: 1, founder: 2, co_founder: 3, admin: 5, moderator: 7, friend: 20, user: 21
            };
            const bestRole = (roleData || [])
              .sort((a, b) => (ROLE_PRI[a.role] ?? 99) - (ROLE_PRI[b.role] ?? 99))[0];

            if (profile) {
              setMessages(prev => [...prev, {
                ...payload.new as any,
                profiles: profile,
                user_role: bestRole?.role || 'user'
              }]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(msg => 
              msg.id === payload.new.id 
                ? { ...msg, ...payload.new as any }
                : msg
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, navigate, restrictions.banned_from_public_chat]);

  // Load user restriction data when moderating
  useEffect(() => {
    if (moderatingUser) {
      const loadUserRestriction = async () => {
        const { data } = await supabase
          .from('user_restrictions')
          .select('*')
          .eq('user_id', moderatingUser.userId)
          .maybeSingle();
        setUserRestrictionData(data);
      };
      loadUserRestriction();
    }
  }, [moderatingUser]);

  useEffect(() => {
    // Auto-scroll to bottom
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    // Load messages in batches for faster initial load
    const { data, error } = await supabase
      .from('public_messages')
      .select(`
        *,
        profiles!public_messages_user_id_fkey (
          name,
          email,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive'
      });
    } else {
      // Get unique user IDs
      const userIds = [...new Set((data || []).map((msg: any) => msg.user_id))];
      
      // Batch fetch all user roles at once
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Create a map with HIGHEST priority role per user
      const ROLE_PRIORITY: Record<string, number> = {
        owner: 0, ceo: 1, founder: 2, co_founder: 3, sr_admin: 4, admin: 5,
        sr_moderator: 6, moderator: 7, education_admin: 8, learning_department: 9,
        learning_manager: 10, vip: 11, elite: 12, platinum: 13, gold: 14,
        silver: 15, premium: 16, pro: 17, plus: 18, basic: 19, friend: 20, user: 21,
      };
      const roleMap = new Map<string, string>();
      (rolesData || []).forEach(r => {
        const existing = roleMap.get(r.user_id);
        if (!existing || (ROLE_PRIORITY[r.role] ?? 99) < (ROLE_PRIORITY[existing] ?? 99)) {
          roleMap.set(r.user_id, r.role);
        }
      });
      
      // Map roles to messages
      const messagesWithRoles = (data || []).map((msg: any) => ({
        ...msg,
        user_role: roleMap.get(msg.user_id) || 'user'
      })).reverse(); // Reverse to show oldest first
      
      setMessages(messagesWithRoles as PublicMessage[]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isLoading) return;

    setIsLoading(true);
    const content = newMessage.trim();

    // Check for /play command - open music panel
    if (content.startsWith('/play ')) {
      setShowMusicPlayer(true);
      toast({
        title: 'Music Panel',
        description: 'Use the music panel to search and play music'
      });
      setNewMessage('');
      setIsLoading(false);
      return;
    }

    // Check for /askify command
    if (content.startsWith('/askify ')) {
      const question = content.substring(8);
      
      // First post the user's question
      const { data: userMsg, error: userMsgError } = await supabase
        .from('public_messages')
        .insert({
          user_id: user.id,
          content: content,
          reply_to: replyingTo?.id || null
        })
        .select()
        .single();

      if (userMsgError) {
        toast({
          title: 'Error',
          description: 'Failed to send message',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      // Then call the AI
      await supabase.functions.invoke('askify-chat', {
        body: { question, originalMessageId: userMsg.id, userId: user.id }
      });

      setNewMessage('');
      setReplyingTo(null);
      setIsLoading(false);
      return;
    }

    const { error } = await supabase
      .from('public_messages')
      .insert({
        user_id: user.id,
        content,
        reply_to: replyingTo?.id || null
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } else {
      setNewMessage('');
      setReplyingTo(null);

      // Send push notifications to mentioned users
      const mentionMatches = content.match(/@(\w+)/g);
      if (mentionMatches) {
        for (const mention of mentionMatches) {
          const mentionedName = mention.substring(1).toLowerCase();
          const mentionedUser = allProfiles.find(
            p => p.name.toLowerCase().replace(/\s+/g, '') === mentionedName ||
                 p.name.toLowerCase().split(' ')[0] === mentionedName
          );
          if (mentionedUser && mentionedUser.id !== user.id) {
            sendNotification(
              mentionedUser.id,
              `${user.name || 'Someone'} mentioned you`,
              content.length > 100 ? content.substring(0, 100) + '...' : content,
              { type: 'public_message', senderId: user.id, senderName: user.name }
            );
          }
        }
      }

      // Also notify if replying to someone
      if (replyingTo && replyingTo.user_id !== user.id) {
        sendNotification(
          replyingTo.user_id,
          `${user.name || 'Someone'} replied to your message`,
          content.length > 100 ? content.substring(0, 100) + '...' : content,
          { type: 'public_message', senderId: user.id, senderName: user.name }
        );
      }
    }

    setIsLoading(false);
  };

  // Handle media messages from ChatMediaInput
  const handleSendMediaMessage = async (content: string, imageUrl?: string) => {
    if ((!content.trim() && !imageUrl) || !user || isLoading) return;

    setIsLoading(true);
    const trimmedContent = content.trim();

    // Check for /play command - open music panel
    if (trimmedContent.startsWith('/play ')) {
      setShowMusicPlayer(true);
      toast({
        title: 'Music Panel',
        description: 'Use the music panel to search and play music'
      });
      setReplyingTo(null);
      setIsLoading(false);
      return;
    }

    // Check for /askify command
    if (trimmedContent.startsWith('/askify ')) {
      const question = trimmedContent.substring(8);
      const { data: userMsg, error: userMsgError } = await supabase
        .from('public_messages')
        .insert({
          user_id: user.id,
          content: trimmedContent,
          image_url: imageUrl,
          reply_to: replyingTo?.id || null
        })
        .select()
        .single();

      if (userMsgError) {
        toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      await supabase.functions.invoke('askify-chat', {
        body: { question, originalMessageId: userMsg.id, userId: user.id }
      });

      setReplyingTo(null);
      setIsLoading(false);
      return;
    }

    const { error } = await supabase
      .from('public_messages')
      .insert({
        user_id: user.id,
        content: trimmedContent || '',
        image_url: imageUrl,
        reply_to: replyingTo?.id || null
      });

    if (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } else {
      setReplyingTo(null);

      // Send push notifications to mentioned users
      if (trimmedContent) {
        const mentionMatches = trimmedContent.match(/@(\w+)/g);
        if (mentionMatches) {
          for (const mention of mentionMatches) {
            const mentionedName = mention.substring(1).toLowerCase();
            const mentionedUser = allProfiles.find(
              p => p.name.toLowerCase().replace(/\s+/g, '') === mentionedName ||
                   p.name.toLowerCase().split(' ')[0] === mentionedName
            );
            if (mentionedUser && mentionedUser.id !== user.id) {
              sendNotification(
                mentionedUser.id,
                `${user.name || 'Someone'} mentioned you`,
                trimmedContent.length > 100 ? trimmedContent.substring(0, 100) + '...' : trimmedContent,
                { type: 'public_message', senderId: user.id, senderName: user.name }
              );
            }
          }
        }
      }

      // Also notify if replying to someone
      if (replyingTo && replyingTo.user_id !== user.id) {
        sendNotification(
          replyingTo.user_id,
          `${user.name || 'Someone'} replied to your message`,
          trimmedContent.length > 100 ? trimmedContent.substring(0, 100) + '...' : trimmedContent,
          { type: 'public_message', senderId: user.id, senderName: user.name }
        );
      }
    }

    setIsLoading(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;

    const message = messages.find(m => m.id === editingMessage);
    if (!message) return;

    const editHistory = message.edit_history || [];
    editHistory.push({
      content: message.content,
      edited_at: new Date().toISOString()
    });

    const { error } = await supabase
      .from('public_messages')
      .update({
        content: editContent.trim(),
        edited_at: new Date().toISOString(),
        edit_history: editHistory
      })
      .eq('id', editingMessage);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to edit message',
        variant: 'destructive'
      });
    } else {
      setEditingMessage(null);
      setEditContent('');
    }
  };

  const handleDeleteMessage = async (messageId: string, isOwnerDelete: boolean = false) => {
    const { error } = await supabase
      .from('public_messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id
      })
      .eq('id', messageId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive'
      });
    }
  };

  const handleDismissDeletedMessage = async (messageId: string) => {
    // Permanently remove the message from database (owner only)
    const { error } = await supabase
      .from('public_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to dismiss message',
        variant: 'destructive'
      });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast({
        title: 'Dismissed',
        description: 'Message permanently removed'
      });
    }
  };

  const handleOwnerEditMessage = async (message: PublicMessage) => {
    setEditingMessage(message.id);
    setEditContent(message.content);
  };

  const getReplyMessage = (replyId: string) => {
    return messages.find(m => m.id === replyId);
  };

  const renderMessageContent = (content: string) => {
    // Parse @mentions and highlight them with better visibility
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const isEveryone = part.toLowerCase() === '@everyone';
        return (
          <span 
            key={i} 
            className={`font-bold px-1 py-0.5 rounded ${
              isEveryone 
                ? 'bg-warning/30 text-warning-foreground' 
                : 'bg-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Role badge helper function
  const getRoleBadgeStyle = (role: string) => {
    const styles: Record<string, string> = {
      owner: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-yellow-300 shadow-yellow-500/30',
      founder: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-300 shadow-amber-500/30',
      co_founder: 'bg-gradient-to-r from-orange-400 to-red-500 text-white border-orange-300 shadow-orange-500/30',
      ceo: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-300 shadow-purple-500/30',
      admin: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-300 shadow-red-500/30',
      moderator: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-300 shadow-orange-500/30',
      friend: 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-pink-300 shadow-pink-500/30',
      vip: 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-black border-yellow-200 shadow-yellow-500/40',
      premium: 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white border-fuchsia-300 shadow-fuchsia-500/30',
      platinum: 'bg-gradient-to-r from-slate-300 via-cyan-200 to-slate-400 text-slate-800 border-cyan-200 shadow-cyan-500/30',
      gold: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-yellow-300 shadow-yellow-500/30',
      silver: 'bg-gradient-to-r from-slate-300 to-gray-400 text-slate-700 border-slate-200 shadow-slate-500/20',
      elite: 'bg-gradient-to-r from-violet-600 to-purple-700 text-white border-violet-400 shadow-violet-500/30',
      pro: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-300 shadow-blue-500/30',
      plus: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-cyan-300 shadow-cyan-500/30',
      basic: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white border-emerald-300 shadow-emerald-500/30',
    };
    return styles[role] || 'bg-muted text-muted-foreground border-border';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: '👑 OWNER',
      founder: '⭐ FOUNDER',
      co_founder: '✦ CO-FOUNDER',
      ceo: '💎 CEO',
      admin: '🛡️ ADMIN',
      moderator: '⚔️ MOD',
      friend: '💖 FRIEND',
      vip: '✨ VIP',
      premium: '💫 PREMIUM',
      platinum: '🏆 PLATINUM',
      gold: '🥇 GOLD',
      silver: '🥈 SILVER',
      elite: '🔥 ELITE',
      pro: '⚡ PRO',
      plus: '➕ PLUS',
      basic: '✓ BASIC',
    };
    return labels[role] || role.toUpperCase();
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="flex-1 flex flex-col w-full relative bg-card border-0 md:border-x border-border">
        <header className="border-b border-border p-2 sm:p-3 md:p-4 bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95 sticky top-0 z-50">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="h-8 w-8 sm:h-9 sm:w-9"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl font-semibold truncate">Public Chat</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Chat with everyone</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowVideoCall(true)}
                title="Start video call"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Video className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowVoiceCall(true)}
                title="Start voice call"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGroupsList(true)}
                title="View groups"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUsersList(true)}
                title="View users"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <UserCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant={showMusicPlayer ? "default" : "ghost"}
                size="icon"
                onClick={() => setShowMusicPlayer(!showMusicPlayer)}
                title="Music Player"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Music className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/friends-chat')}
                title="Boys Chat (Friends Only)"
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              {isOwner && (
                <ClearAllMessagesButton 
                  chatType="public" 
                  onCleared={() => setMessages([])} 
                />
              )}
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 chat-scroll" ref={scrollRef}>
          <div className="p-4 space-y-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                <p className="text-muted-foreground">Be the first to say hello!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwnMessage = message.user_id === user?.id;
                const isDeleted = !!message.deleted_at;
                const canSeeDeleted = isAdmin;
                const replyMessage = message.reply_to ? getReplyMessage(message.reply_to) : null;
                
                if (isDeleted && !canSeeDeleted) return null;

                // Message grouping: same user within 2 minutes
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const isGrouped = prevMsg && 
                  prevMsg.user_id === message.user_id && 
                  !prevMsg.deleted_at &&
                  (new Date(message.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 120000 &&
                  !message.reply_to;

                // Day separator
                const showDateSep = index === 0 || isDifferentDay(
                  messages[index - 1].created_at,
                  message.created_at
                );

                const isGif = message.image_url && (
                  message.image_url.includes('tenor.com') || 
                  message.image_url.includes('.gif') ||
                  message.image_url.includes('giphy.com')
                );

                return (
                  <div key={message.id}>
                    {showDateSep && (
                      <DateSeparator date={message.created_at} />
                    )}
                    <div
                      className={`flex gap-2.5 group ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${isDeleted ? 'opacity-50' : ''} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                    >
                      {/* Avatar - only show for first in group */}
                      {!isGrouped ? (
                        <Avatar 
                          className="h-8 w-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                          onClick={() => setViewingProfile({ userId: message.user_id, userName: message.profiles?.name || 'User' })}
                        >
                          {message.profiles?.avatar_url ? (
                            <AvatarImage src={message.profiles.avatar_url} alt={message.profiles.name} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-muted">
                            {message.profiles ? getInitials(message.profiles.name) : '??'}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%]`}>
                        {!isGrouped && (
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-semibold">
                              {isOwnMessage ? 'You' : (message.profiles?.name || 'Anonymous')}
                            </span>
                            {message.user_role && message.user_role !== 'user' && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-sm ${getRoleBadgeStyle(message.user_role)}`}>
                                {getRoleLabel(message.user_role)}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {formatTime(message.created_at)}
                            </span>
                            {message.edited_at && (
                              <span className="text-[11px] text-muted-foreground italic">(edited)</span>
                            )}
                          </div>
                        )}
                        {/* Reply indicator */}
                        {replyMessage && (
                          <div className={`text-xs text-muted-foreground mb-1 px-2 py-1 rounded bg-muted/50 border-l-2 border-primary max-w-full`}>
                            <span className="font-medium">↩ {replyMessage.profiles?.name}: </span>
                            <span className="truncate">{replyMessage.content.substring(0, 50)}{replyMessage.content.length > 50 ? '...' : ''}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-1">
                          <div
                            className={`rounded-2xl ${isGif ? 'p-0 bg-transparent' : 'px-3 py-1.5'} ${
                              isDeleted 
                                ? 'bg-destructive/20 text-destructive px-3 py-1.5'
                                : isGif ? '' 
                                : isOwnMessage
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {message.image_url && !isDeleted && (
                              <img 
                                src={message.image_url} 
                                alt={isGif ? 'GIF' : 'Shared'} 
                                className={`${isGif ? 'max-w-[250px] rounded-xl' : 'max-w-[200px] max-h-[200px] rounded-lg mb-1'}`}
                              />
                            )}
                            {message.content && !isDeleted && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {renderMessageContent(message.content)}
                              </p>
                            )}
                            {isDeleted && isAdmin && (
                              <p className="text-sm">
                                <span className="text-destructive font-medium">[Deleted by {message.deleted_by === message.user_id ? 'user' : 'admin'}]</span>
                                <br />
                                <span className="line-through">{message.content}</span>
                              </p>
                            )}
                          </div>
                          {isDeleted && isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDismissDeletedMessage(message.id)} title="Remove permanently">
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                          {!isDeleted && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(message.content); toast({ title: 'Copied' }); }}>
                                  <Copy className="h-4 w-4 mr-2" />Copy
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                  <Reply className="h-4 w-4 mr-2" />Reply
                                </DropdownMenuItem>
                                {(isOwnMessage || isAdmin) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleOwnerEditMessage(message)}>
                                      <Edit2 className="h-4 w-4 mr-2" />Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteMessage(message.id, isAdmin && !isOwnMessage)} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" />Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {isAdmin && !isOwnMessage && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setModeratingUser({ userId: message.user_id, userName: message.profiles?.name || 'User' })}>
                                      <Shield className="h-4 w-4 mr-2" />Moderate User
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4 bg-background">
          {replyingTo && (
            <div className="mb-2 flex items-center gap-2 text-xs bg-muted/50 p-2 rounded border-l-2 border-primary">
              <Reply className="h-3 w-3" />
              <span className="text-muted-foreground">Replying to</span>
              <span className="font-medium">{replyingTo.profiles?.name}</span>
              <span className="text-muted-foreground truncate max-w-[200px]">
                {replyingTo.content.substring(0, 30)}{replyingTo.content.length > 30 ? '...' : ''}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-auto"
                onClick={() => setReplyingTo(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <TypingIndicator channelId="public-chat" currentUserId={user?.id} />
          <div className="mb-2 text-xs text-muted-foreground">
            Tip: /play [song] to play music • /askify [question] for AI help • Type @ to mention users
          </div>
          <EnhancedChatInput
            onSend={(content, fileUrl) => handleSendMediaMessage(content, fileUrl)}
            onTyping={sendTyping}
            placeholder={replyingTo ? `Reply to ${replyingTo.profiles?.name}...` : "Type a message..."}
            disabled={isLoading}
            userId={user?.id}
            chatType="public"
            maxFileSize={200}
          />
        </div>

        <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Message</DialogTitle>
            </DialogHeader>
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Edit your message..."
              className="mt-4"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMessage(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditMessage}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={showUsersList} onOpenChange={setShowUsersList}>
          <SheetContent side="left" className="w-80 p-0 z-[60]">
            <SheetHeader className="sr-only">
              <SheetTitle>Users</SheetTitle>
            </SheetHeader>
            <FriendRequestsPanel
              onOpenDM={(userId, userName) => {
                setShowUsersList(false);
                setTimeout(() => {
                  setActiveDM({ userId, userName });
                }, 100);
              }}
            />
          </SheetContent>
        </Sheet>

        <Sheet open={showGroupsList} onOpenChange={setShowGroupsList}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Groups</SheetTitle>
            </SheetHeader>
            <GroupsList
              onOpenGroupChat={(groupId, groupName) => {
                setActiveGroup({ groupId, groupName });
                setShowGroupsList(false);
              }}
            />
          </SheetContent>
        </Sheet>

        {activeDM && (
          <div className="fixed inset-y-0 right-0 w-full md:w-96 z-[70] bg-background shadow-xl">
            <DirectMessageChat
              recipientId={activeDM.userId}
              recipientName={activeDM.userName}
              onClose={() => setActiveDM(null)}
            />
          </div>
        )}

        {activeGroup && (
          <div className="fixed inset-y-0 right-0 w-full md:w-96 z-[70] bg-background shadow-xl">
            <GroupChat
              groupId={activeGroup.groupId}
              groupName={activeGroup.groupName}
              onClose={() => setActiveGroup(null)}
              onVideoCall={() => setShowVideoCall(true)}
              onVoiceCall={() => setShowVoiceCall(true)}
            />
          </div>
        )}

        <WebRTCCall
          isOpen={showVideoCall}
          onClose={() => setShowVideoCall(false)}
          callType="video"
          recipientName="Public Chat"
          recipientId="public"
          isInitiator={true}
        />

        <WebRTCCall
          isOpen={showVoiceCall}
          onClose={() => setShowVoiceCall(false)}
          callType="voice"
          recipientName="Public Chat"
          recipientId="public"
          isInitiator={true}
        />
        <MusicBotPanel
          isVisible={showMusicPlayer}
          onClose={() => setShowMusicPlayer(false)}
          channelId="public-chat"
        />

        {/* User Moderation Dialog */}
        {moderatingUser && (
          <UserModerationDialog
            isOpen={!!moderatingUser}
            onClose={() => {
              setModeratingUser(null);
              setUserRestrictionData(null);
            }}
            userId={moderatingUser.userId}
            userName={moderatingUser.userName}
            currentlyBanned={userRestrictionData?.banned_from_public_chat}
            currentTimeout={userRestrictionData?.public_chat_timeout_until}
          />
        )}

        {/* User Profile Dialog */}
        {viewingProfile && (
          <UserProfileDialog
            open={!!viewingProfile}
            onOpenChange={(open) => !open && setViewingProfile(null)}
            userId={viewingProfile.userId}
            userName={viewingProfile.userName}
          />
        )}
      </div>
    </div>
  );
};

export default PublicChat;
