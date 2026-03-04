import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Video, Phone, PhoneIncoming, PhoneMissed, PhoneOff, Camera, CircleDot } from 'lucide-react';
import { WebRTCCall } from './WebRTCCall';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { EnhancedChatInput, TypingIndicator, useTypingIndicator, DateSeparator, isDifferentDay } from './chat';
import { SnapSender } from './SnapSender';
import { StoriesViewer } from './StoriesViewer';

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  edited_at?: string;
  read_at?: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Typing indicator
  const { sendTyping } = useTypingIndicator(`dm-${recipientId}`, user?.id, user?.name);

  useEffect(() => {
    if (!user) return;

    loadMessages();
    loadCallEvents();

    // Subscribe to new messages
    const channel = supabase
      .channel(`dm-${user.id}-${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${recipientId},receiver_id=eq.${user.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as DirectMessage]);
          markAsRead(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_events'
        },
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

    // Mark existing unread messages as read
    markUnreadMessages();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recipientId]);

  useEffect(() => {
    // Auto-scroll to bottom
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages, callEvents]);

  const loadMessages = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive'
      });
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

    if (data) {
      setCallEvents(data as CallEvent[]);
    }
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
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
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
        image_url: imageUrl
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } else {
      loadMessages();
      
      // Send push notification to recipient
      sendNotification(
        recipientId,
        `New message from ${user.name || 'Someone'}`,
        messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent,
        { type: 'direct_message', senderId: user.id, senderName: user.name }
      );
    }

    setIsLoading(false);
  };

  const handleStartCall = async (callType: 'voice' | 'video') => {
    if (!user) return;

    // Record call event
    await supabase.from('call_events').insert({
      caller_id: user.id,
      receiver_id: recipientId,
      call_type: callType,
      status: 'initiated'
    });

    if (callType === 'video') {
      setShowVideoCall(true);
    } else {
      setShowVoiceCall(true);
    }
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

  const renderCallEvent = (event: CallEvent) => {
    const isIncoming = event.receiver_id === user?.id;
    const isMissed = event.status === 'missed';
    const isEnded = event.status === 'ended';

    let icon = <Phone className="h-4 w-4" />;
    let text = '';
    let colorClass = 'text-muted-foreground';

    if (event.call_type === 'video') {
      icon = <Video className="h-4 w-4" />;
    }

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

  // Merge messages and call events by timestamp
  const allItems = [
    ...messages.map(m => ({ type: 'message' as const, data: m, timestamp: m.created_at })),
    ...callEvents.map(e => ({ type: 'call' as const, data: e, timestamp: e.started_at }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">DM with {recipientName}</h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowStatusBar(!showStatusBar)} title="Status">
            <CircleDot className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSnapSender(true)} title="Send Snap" className="text-yellow-600 dark:text-yellow-400">
            <Camera className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleStartCall('video')}>
            <Video className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleStartCall('voice')}>
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status/Stories Bar */}
      {showStatusBar && (
        <div className="border-b border-border">
          <StoriesViewer />
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-2">
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
              
              return (
                <div key={message.id}>
                  {showDateSeparator && <DateSeparator date={message.created_at} />}
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {message.image_url && (
                        <img src={message.image_url} alt="Shared" className="max-w-[200px] max-h-[200px] rounded-lg mb-2" />
                      )}
                      {message.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs opacity-70">
                          {formatTime(message.created_at)}
                        </span>
                        {isOwnMessage && message.read_at && (
                          <span className="text-xs opacity-70">✓✓</span>
                        )}
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

      <div className="border-t border-border p-4">
        <EnhancedChatInput 
          onSend={handleSendMessage}
          placeholder="Type a message..."
          disabled={isLoading}
          userId={user?.id}
          onTyping={sendTyping}
          maxFileSize={200}
          chatType="dm"
        />
      </div>

      <WebRTCCall
        isOpen={showVideoCall}
        onClose={() => setShowVideoCall(false)}
        callType="video"
        recipientName={recipientName}
        recipientId={recipientId}
        isInitiator={true}
      />

      <WebRTCCall
        isOpen={showVoiceCall}
        onClose={() => setShowVoiceCall(false)}
        callType="voice"
        recipientName={recipientName}
        recipientId={recipientId}
        isInitiator={true}
      />

      <SnapSender
        isOpen={showSnapSender}
        onClose={() => setShowSnapSender(false)}
        recipientId={recipientId}
        recipientName={recipientName}
      />
    </div>
  );
}