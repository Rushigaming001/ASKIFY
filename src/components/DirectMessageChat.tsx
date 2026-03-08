import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Video, Phone, PhoneIncoming, PhoneMissed, PhoneOff, Camera, CircleDot, MoreVertical, Edit2, Trash2, Reply, Copy, Coins } from 'lucide-react';
import { WebRTCCall } from './WebRTCCall';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { EnhancedChatInput, TypingIndicator, useTypingIndicator, DateSeparator, isDifferentDay } from './chat';
import { SnapSender } from './SnapSender';
import { StoriesViewer } from './StoriesViewer';
import { MessageReactions } from './MessageReactions';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  read_at?: string;
  reply_to?: string;
}

interface CallEvent {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'voice' | 'video';
  status: 'initiated' | 'answered' | 'missed' | 'declined' | 'ended';
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
}

interface DirectMessageChatProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

export function DirectMessageChat({ recipientId, recipientName, onClose }: DirectMessageChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendNotification } = usePushNotifications();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [callEvents, setCallEvents] = useState<CallEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [showSnapSender, setShowSnapSender] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [recipientAvatar, setRecipientAvatar] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { sendTyping } = useTypingIndicator(`dm-${recipientId}`, user?.id, user?.name);

  useEffect(() => {
    if (!user) return;

    loadMessages();
    loadCallEvents();
    loadRecipientProfile();

    const channel = supabase
      .channel(`dm-${user.id}-${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new as DirectMessage;
            if ((msg.sender_id === recipientId && msg.receiver_id === user.id) ||
                (msg.sender_id === user.id && msg.receiver_id === recipientId)) {
              setMessages(prev => [...prev, msg]);
              if (msg.sender_id === recipientId) markAsRead(msg.id);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new as any } : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const event = payload.new as CallEvent;
            if ((event.caller_id === user.id && event.receiver_id === recipientId) ||
                (event.receiver_id === user.id && event.caller_id === recipientId)) {
              setCallEvents(prev => [...prev, event]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setCallEvents(prev => prev.map(e => e.id === payload.new.id ? payload.new as CallEvent : e));
          }
        }
      )
      .subscribe();

    markUnreadMessages();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recipientId]);

  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages, callEvents]);

  const loadRecipientProfile = async () => {
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', recipientId).single();
    if (data) setRecipientAvatar(data.avatar_url);
  };

  const loadMessages = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
    } else {
      setMessages(data || []);
    }
  };

  const loadCallEvents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('call_events')
      .select('*')
      .or(`and(caller_id.eq.${user.id},receiver_id.eq.${recipientId}),and(caller_id.eq.${recipientId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    if (data) setCallEvents(data as CallEvent[]);
  };

  const markUnreadMessages = async () => {
    if (!user) return;
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', recipientId)
      .eq('receiver_id', user.id)
      .is('read_at', null);
  };

  const markAsRead = async (messageId: string) => {
    await supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', messageId);
  };

  const handleSendMessage = async (content: string, imageUrl?: string) => {
    if ((!content.trim() && !imageUrl) || !user || isLoading) return;
    setIsLoading(true);

    const messageContent = content.trim();
    const { error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        receiver_id: recipientId,
        content: messageContent || '',
        image_url: imageUrl,
      });

    if (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } else {
      setReplyingTo(null);
      sendNotification(
        recipientId,
        `New message from ${user.name || 'Someone'}`,
        messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent,
        { type: 'direct_message', senderId: user.id, senderName: user.name }
      );
    }
    setIsLoading(false);
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;
    const msg = messages.find(m => m.id === editingMessage);
    if (!msg) return;

    const editHistory = (msg as any).edit_history || [];
    editHistory.push({ content: msg.content, edited_at: new Date().toISOString() });

    const { error } = await supabase
      .from('direct_messages')
      .update({
        content: editContent.trim(),
        edited_at: new Date().toISOString(),
        edit_history: editHistory,
      })
      .eq('id', editingMessage);

    if (error) {
      toast({ title: 'Error', description: 'Failed to edit message', variant: 'destructive' });
    } else {
      setEditingMessage(null);
      setEditContent('');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('direct_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const handleStartCall = async (callType: 'voice' | 'video') => {
    if (!user) return;
    await supabase.from('call_events').insert({
      caller_id: user.id,
      receiver_id: recipientId,
      call_type: callType,
      status: 'initiated'
    });
    if (callType === 'video') setShowVideoCall(true);
    else setShowVoiceCall(true);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getReplyMessage = (replyId: string) => messages.find(m => m.id === replyId);

  const renderCallEvent = (event: CallEvent) => {
    const isIncoming = event.receiver_id === user?.id;
    const isMissed = event.status === 'missed';
    const isEnded = event.status === 'ended';

    let icon = <Phone className="h-4 w-4" />;
    let text = '';
    let colorClass = 'text-muted-foreground';

    if (event.call_type === 'video') icon = <Video className="h-4 w-4" />;

    if (isMissed) {
      icon = <PhoneMissed className="h-4 w-4" />;
      text = isIncoming ? 'Missed call' : 'No answer';
      colorClass = 'text-destructive';
    } else if (isEnded) {
      icon = <PhoneOff className="h-4 w-4" />;
      const duration = event.duration_seconds ? `${Math.floor(event.duration_seconds / 60)}:${String(event.duration_seconds % 60).padStart(2, '0')}` : '';
      text = `Call ended${duration ? ` (${duration})` : ''}`;
    } else if (event.status === 'answered') {
      text = 'Call in progress';
      colorClass = 'text-green-500';
    } else {
      icon = isIncoming ? <PhoneIncoming className="h-4 w-4" /> : <Phone className="h-4 w-4" />;
      text = isIncoming ? 'Incoming call' : 'Outgoing call';
    }

    return (
      <div key={event.id} className="flex justify-center my-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm ${colorClass}`}>
          {icon}
          <span>{event.call_type === 'video' ? 'Video' : 'Voice'} · {text}</span>
          <span className="text-xs opacity-70">{formatTime(event.started_at)}</span>
        </div>
      </div>
    );
  };

  const allItems = [
    ...messages.map(m => ({ type: 'message' as const, data: m, timestamp: m.created_at })),
    ...callEvents.map(e => ({ type: 'call' as const, data: e, timestamp: e.started_at }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {recipientAvatar && <AvatarImage src={recipientAvatar} />}
            <AvatarFallback className="text-xs">{getInitials(recipientName)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm">{recipientName}</h3>
            <p className="text-xs text-muted-foreground">Direct Message</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowStatusBar(!showStatusBar)} title="Status" className="h-8 w-8 p-0">
            <CircleDot className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSnapSender(true)} title="Send Snap" className="h-8 w-8 p-0 text-yellow-600 dark:text-yellow-400">
            <Camera className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleStartCall('video')} className="h-8 w-8 p-0">
            <Video className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleStartCall('voice')} className="h-8 w-8 p-0">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showStatusBar && (
        <div className="border-b border-border">
          <StoriesViewer />
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-1">
          {allItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            allItems.map((item, index) => {
              const showDateSeparator = index === 0 || isDifferentDay(allItems[index - 1].timestamp, item.timestamp);

              if (item.type === 'call') {
                return (
                  <div key={`call-${item.data.id}`}>
                    {showDateSeparator && <DateSeparator date={item.timestamp} />}
                    {renderCallEvent(item.data as CallEvent)}
                  </div>
                );
              }

              const message = item.data as DirectMessage;
              const isOwnMessage = message.sender_id === user?.id;
              const isGif = message.image_url && (
                message.image_url.includes('tenor.com') ||
                message.image_url.includes('.gif') ||
                message.image_url.includes('giphy.com')
              );

              // Message grouping
              const prevItem = index > 0 ? allItems[index - 1] : null;
              const isGrouped = prevItem && prevItem.type === 'message' &&
                (prevItem.data as DirectMessage).sender_id === message.sender_id &&
                (new Date(message.created_at).getTime() - new Date(prevItem.timestamp).getTime()) < 120000;

              return (
                <div key={message.id}>
                  {showDateSeparator && <DateSeparator date={message.created_at} />}
                  <div className={`flex group ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
                    {/* Avatar for recipient messages */}
                    {!isOwnMessage && !isGrouped && (
                      <Avatar className="h-7 w-7 mr-2 flex-shrink-0">
                        {recipientAvatar && <AvatarImage src={recipientAvatar} />}
                        <AvatarFallback className="text-[10px]">{getInitials(recipientName)}</AvatarFallback>
                      </Avatar>
                    )}
                    {!isOwnMessage && isGrouped && <div className="w-7 mr-2 flex-shrink-0" />}
                    
                    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
                      {/* Reply indicator */}
                      {message.reply_to && (() => {
                        const reply = getReplyMessage(message.reply_to);
                        return reply ? (
                          <div className="text-xs text-muted-foreground mb-1 px-2 py-1 rounded bg-muted/50 border-l-2 border-primary">
                            <span className="font-medium">↩ {reply.sender_id === user?.id ? 'You' : recipientName}: </span>
                            <span>{reply.content.substring(0, 40)}{reply.content.length > 40 ? '...' : ''}</span>
                          </div>
                        ) : null;
                      })()}

                      <div className="flex items-start gap-1">
                        <div
                          className={`rounded-2xl ${isGif ? 'p-0 bg-transparent' : 'px-3 py-1.5'} ${
                            isGif ? '' : isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {message.image_url && (
                            <img
                              src={message.image_url}
                              alt={isGif ? 'GIF' : 'Shared'}
                              className={`${isGif ? 'max-w-[200px] rounded-xl' : 'max-w-[180px] max-h-[180px] rounded-lg mb-1'}`}
                            />
                          )}
                          {message.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          )}
                        </div>

                        <MessageReactions messageId={message.id} messageType="dm" />

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
                            {isOwnMessage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setEditingMessage(message.id); setEditContent(message.content); }}>
                                  <Edit2 className="h-4 w-4 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteMessage(message.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
                        {message.edited_at && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
                        {isOwnMessage && message.read_at && <span className="text-[10px] text-blue-500">✓✓</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <TypingIndicator channelId={`dm-${recipientId}`} currentUserId={user?.id} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 text-xs bg-muted/50 p-2 rounded border-l-2 border-primary">
            <Reply className="h-3 w-3" />
            <span className="text-muted-foreground">Replying to</span>
            <span className="font-medium">{replyingTo.sender_id === user?.id ? 'yourself' : recipientName}</span>
            <span className="text-muted-foreground truncate max-w-[150px]">{replyingTo.content.substring(0, 30)}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4 ml-auto" onClick={() => setReplyingTo(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <EnhancedChatInput
          onSend={handleSendMessage}
          placeholder={replyingTo ? `Reply...` : "Type a message..."}
          disabled={isLoading}
          userId={user?.id}
          onTyping={sendTyping}
          maxFileSize={200}
          chatType="dm"
        />
      </div>

      {/* Edit Dialog */}
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
            onKeyDown={(e) => e.key === 'Enter' && handleEditMessage()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMessage(null)}>Cancel</Button>
            <Button onClick={handleEditMessage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WebRTCCall isOpen={showVideoCall} onClose={() => setShowVideoCall(false)} callType="video" recipientName={recipientName} recipientId={recipientId} isInitiator={true} />
      <WebRTCCall isOpen={showVoiceCall} onClose={() => setShowVoiceCall(false)} callType="voice" recipientName={recipientName} recipientId={recipientId} isInitiator={true} />
      <SnapSender isOpen={showSnapSender} onClose={() => setShowSnapSender(false)} recipientId={recipientId} recipientName={recipientName} />
    </div>
  );
}
