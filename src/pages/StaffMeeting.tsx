import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, Monitor,
  Send, ArrowLeft, MessageSquare, SwitchCamera, Crown, Shield
} from 'lucide-react';
import { toast } from 'sonner';

interface Participant {
  user_id: string;
  name: string;
  role: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  name: string;
  content: string;
  timestamp: number;
}

const STAFF_ROLES = ['owner', 'ceo', 'founder', 'co_founder', 'admin', 'sr_admin', 'moderator', 'sr_moderator'];

const StaffMeeting = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [inCall, setInCall] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [userRole, setUserRole] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check authorization
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const checkAccess = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = (data?.map(r => r.role) || []) as string[];
      const hasAccess = roles.some(r => STAFF_ROLES.includes(r));
      setIsAuthorized(hasAccess);

      // Get highest role for display
      const priority = ['owner', 'ceo', 'founder', 'co_founder', 'sr_admin', 'admin', 'sr_moderator', 'moderator'];
      const highest = priority.find(p => roles.includes(p));
      setUserRole(highest || roles[0] || 'user');

      if (!hasAccess) {
        toast.error('Access denied. Staff members only.');
      }
    };

    checkAccess();
  }, [user, navigate]);

  const getRoleIcon = (role: string) => {
    if (['owner', 'ceo', 'founder', 'co_founder'].includes(role)) return <Crown className="h-3 w-3" />;
    return <Shield className="h-3 w-3" />;
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'owner') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (['ceo', 'founder', 'co_founder'].includes(role)) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (['admin', 'sr_admin'].includes(role)) return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const createPeerConnection = useCallback((targetUserId: string): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        // Bandwidth optimization
        if (track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings?.length) params.encodings = [{}];
            params.encodings[0].maxBitrate = 1200000; // 1.2Mbps per peer
            params.encodings[0].maxFramerate = 24;
            sender.setParameters(params).catch(() => {});
          } catch {}
        }
      });
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams(prev => new Map(prev).set(targetUserId, stream));
      if (event.track.kind === 'audio') {
        const audioEl = document.createElement('audio');
        audioEl.srcObject = stream;
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        audioEl.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current && user) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, to: targetUserId, from: user.id }
        });
      }
    };

    return pc;
  }, [user]);

  const createOffer = useCallback(async (targetUserId: string) => {
    const pc = createPeerConnection(targetUserId);
    peerConnectionsRef.current.set(targetUserId, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'offer',
      payload: { offer, to: targetUserId, from: user!.id }
    });
  }, [createPeerConnection, user]);

  const handleOffer = useCallback(async (payload: any) => {
    const pc = createPeerConnection(payload.from);
    peerConnectionsRef.current.set(payload.from, pc);
    await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'answer',
      payload: { answer, to: payload.from, from: user!.id }
    });
  }, [createPeerConnection, user]);

  const handleAnswer = useCallback(async (payload: any) => {
    const pc = peerConnectionsRef.current.get(payload.from);
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
  }, []);

  const handleIceCandidate = useCallback(async (payload: any) => {
    const pc = peerConnectionsRef.current.get(payload.from);
    if (pc && payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
  }, []);

  const joinMeeting = async () => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 24 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();

      const channel = supabase.channel('staff-meeting-room');
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const list: Participant[] = [];
          Object.values(state).forEach((presences: any) => {
            presences.forEach((p: any) => {
              if (p.user_id !== user.id) {
                list.push({ user_id: p.user_id, name: p.name, role: p.role });
                if (!peerConnectionsRef.current.has(p.user_id)) {
                  createOffer(p.user_id);
                }
              }
            });
          });
          setParticipants(list);
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.to === user.id) await handleOffer(payload);
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.to === user.id) await handleAnswer(payload);
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.to === user.id) await handleIceCandidate(payload);
        })
        .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
          setChatMessages(prev => [...prev, payload as ChatMessage]);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              name: profile?.name || 'Staff',
              role: userRole
            });
          }
        });

      setInCall(true);
      toast.success('Joined staff meeting');
    } catch (err) {
      console.error('Failed to join:', err);
      toast.error('Failed to access camera/microphone');
    }
  };

  const leaveMeeting = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setRemoteStreams(new Map());
    setParticipants([]);
    setInCall(false);
    toast.success('Left meeting');
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOn(track.enabled); }
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMicOn(track.enabled); }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newVideoTrack);
      });
      const old = localStreamRef.current?.getVideoTracks()[0];
      if (old) { old.stop(); localStreamRef.current?.removeTrack(old); }
      localStreamRef.current?.addTrack(newVideoTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(newMode);
    } catch { toast.error('Failed to switch camera'); }
  };

  const toggleScreenShare = async () => {
    if (!navigator.mediaDevices.getDisplayMedia) {
      toast.error('Screen sharing not supported');
      return;
    }
    try {
      if (isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
        const newTrack = camStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(newTrack);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
        setIsScreenSharing(false);
      } else {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        screenTrack.onended = () => { setIsScreenSharing(false); toggleScreenShare(); };
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        setIsScreenSharing(true);
      }
    } catch { /* cancelled */ }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !channelRef.current || !user) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: user.name || 'Staff',
      content: chatInput.trim(),
      timestamp: Date.now()
    };
    channelRef.current.send({ type: 'broadcast', event: 'chat-message', payload: msg });
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (inCall) leaveMeeting();
    };
  }, []);

  if (isAuthorized === null) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center gap-4">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">This meeting room is for staff members only.</p>
        <Button onClick={() => navigate('/')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Go Back</Button>
      </div>
    );
  }

  if (!inCall) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 gap-6">
        <Button variant="ghost" className="absolute top-4 left-4" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Back
        </Button>
        <div className="text-center space-y-2">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Staff Meeting Room</h1>
          <p className="text-muted-foreground">Video conference for team members</p>
          <Badge className={`${getRoleBadgeColor(userRole)} border`}>
            {getRoleIcon(userRole)}
            <span className="ml-1 capitalize">{userRole.replace('_', ' ')}</span>
          </Badge>
        </div>
        <Button size="lg" className="gap-2 px-8" onClick={joinMeeting}>
          <Video className="h-5 w-5" /> Join Meeting
        </Button>
      </div>
    );
  }

  const totalParticipants = participants.length + 1;
  const gridCols = totalParticipants <= 1 ? 'grid-cols-1' : totalParticipants <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex h-screen bg-background">
      {/* Main video area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold">Staff Meeting</span>
            <Badge variant="secondary">{totalParticipants} in call</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)} className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Chat
            {chatMessages.length > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{chatMessages.length}</Badge>}
          </Button>
        </div>

        {/* Video grid */}
        <div className={`flex-1 grid ${gridCols} gap-1.5 p-2 bg-muted/30`}>
          {/* Local video */}
          <div className="relative rounded-lg overflow-hidden bg-muted">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">You</span>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <Badge className={`text-[10px] ${getRoleBadgeColor(userRole)} border`}>
                {getRoleIcon(userRole)} <span className="ml-0.5">You</span>
              </Badge>
              {!isMicOn && <Badge variant="destructive" className="text-[10px]"><MicOff className="h-2.5 w-2.5" /></Badge>}
            </div>
          </div>

          {/* Remote videos */}
          {participants.map((p) => {
            const stream = remoteStreams.get(p.user_id);
            return (
              <div key={p.user_id} className="relative rounded-lg overflow-hidden bg-muted">
                {stream ? (
                  <video
                    autoPlay playsInline
                    ref={el => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">{p.name[0]}</span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <Badge className={`text-[10px] ${getRoleBadgeColor(p.role)} border`}>
                    {getRoleIcon(p.role)} <span className="ml-0.5">{p.name}</span>
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
          <Button size="lg" variant={isVideoOn ? 'default' : 'destructive'} className="rounded-full h-12 w-12" onClick={toggleVideo}>
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button size="lg" variant={isMicOn ? 'default' : 'destructive'} className="rounded-full h-12 w-12" onClick={toggleMic}>
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button size="lg" variant="secondary" className="rounded-full h-12 w-12" onClick={switchCamera}>
            <SwitchCamera className="h-5 w-5" />
          </Button>
          <Button size="lg" variant={isScreenSharing ? 'default' : 'secondary'} className="rounded-full h-12 w-12" onClick={toggleScreenShare}>
            <Monitor className="h-5 w-5" />
          </Button>
          <Button size="lg" variant="destructive" className="rounded-full h-14 w-14" onClick={leaveMeeting}>
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Chat sidebar */}
      {showChat && (
        <div className="w-80 border-l border-border flex flex-col bg-background">
          <div className="p-3 border-b border-border font-semibold text-sm">Meeting Chat</div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`${msg.user_id === user?.id ? 'text-right' : ''}`}>
                  <p className="text-[11px] text-muted-foreground font-medium">{msg.user_id === user?.id ? 'You' : msg.name}</p>
                  <div className={`inline-block px-3 py-1.5 rounded-xl text-sm mt-0.5 max-w-[85%] ${
                    msg.user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              placeholder="Type a message..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
              className="text-sm"
            />
            <Button size="icon" onClick={sendChatMessage} disabled={!chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffMeeting;
