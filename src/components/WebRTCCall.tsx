import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, SwitchCamera, Monitor, Music, Minimize2, Maximize2, Circle, MessageSquare, X, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MusicPlayer } from '@/components/MusicPlayer';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface WebRTCCallProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'video' | 'voice';
  recipientName: string;
  recipientId: string;
  isInitiator: boolean;
}

export function WebRTCCall({ 
  isOpen, 
  onClose, 
  callType, 
  recipientName,
  recipientId,
  isInitiator 
}: WebRTCCallProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { sendNotification } = usePushNotifications();
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callReady, setCallReady] = useState(false);
  const [participants, setParticipants] = useState<Array<{ user_id: string; name: string }>>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobile] = useState(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  
  // Call recording (owner only)
  const [isRecording, setIsRecording] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // In-call chat
  const [showCallChat, setShowCallChat] = useState(false);
  const [callChatMessages, setCallChatMessages] = useState<Array<{ id: string; name: string; text: string; time: string }>>([]);
  const [callChatInput, setCallChatInput] = useState('');
  const callChatEndRef = useRef<HTMLDivElement>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [callId] = useState(() => `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // CRITICAL: Only cleanup on unmount/close — do NOT auto-call getUserMedia here
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCallReady(false);
      setIsConnecting(true);
    }
  }, [isOpen]);

  // Check if current user is owner (for recording feature)
  useEffect(() => {
    if (!user) return;
    const checkOwner = async () => {
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'owner' });
      setIsOwner(!!data);
    };
    checkOwner();
  }, [user]);

  // Scroll chat to bottom
  useEffect(() => {
    callChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [callChatMessages]);

  // Adaptive bandwidth control - maintains quality while reducing network usage
  const applyBandwidthConstraints = async (sender: RTCRtpSender) => {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      // Use simulcast-like approach: cap bitrate but keep resolution high
      params.encodings[0].maxBitrate = callType === 'video' ? 1500000 : 128000; // 1.5Mbps video, 128kbps audio
      params.encodings[0].scaleResolutionDownBy = 1; // No downscale - keep full quality
      if (callType === 'video') {
        params.encodings[0].maxFramerate = 30;
      }
      await sender.setParameters(params);
    } catch (e) {
      console.warn('Could not apply bandwidth constraints:', e);
    }
  };

  // Monitor and adapt bandwidth based on network conditions
  const startBandwidthMonitor = (pc: RTCPeerConnection) => {
    const monitor = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            if (videoSender && report.qualityLimitationReason === 'bandwidth') {
              // Network congested - temporarily reduce bitrate
              const params = videoSender.getParameters();
              if (params.encodings?.[0]) {
                params.encodings[0].maxBitrate = 800000; // Drop to 800kbps
                videoSender.setParameters(params).catch(() => {});
              }
            } else if (videoSender && report.qualityLimitationReason === 'none') {
              // Network is fine - restore full quality
              const params = videoSender.getParameters();
              if (params.encodings?.[0] && (params.encodings[0].maxBitrate || 0) < 1500000) {
                params.encodings[0].maxBitrate = 1500000;
                videoSender.setParameters(params).catch(() => {});
              }
            }
          }
        });
      } catch {}
    }, 5000);
    return monitor;
  };

  const bandwidthMonitorsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const createPeerConnection = (targetUserId: string): RTCPeerConnection => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
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

    const pc = new RTCPeerConnection(configuration);

    // Add local tracks with bandwidth optimization
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        // Apply bandwidth constraints after connection
        if (track.kind === 'video') {
          applyBandwidthConstraints(sender);
        }
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from', targetUserId, 'kind:', event.track.kind);
      const stream = event.streams[0];
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(targetUserId, stream);
        return newMap;
      });
      setIsConnecting(false);
      
      // Force audio playback on mobile - create a hidden audio element
      if (event.track.kind === 'audio') {
        const audioEl = document.createElement('audio');
        audioEl.srcObject = stream;
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.play().catch(e => console.warn('Audio autoplay blocked:', e));
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current && user) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { 
            candidate: event.candidate, 
            to: targetUserId, 
            from: user.id,
            callId 
          }
        });
      }
    };

    // Connection state + bandwidth monitoring
    pc.onconnectionstatechange = () => {
      console.log(`Connection to ${targetUserId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        // Start adaptive bandwidth monitoring
        const monitorId = startBandwidthMonitor(pc);
        bandwidthMonitorsRef.current.push(monitorId);
      }
    };

    return pc;
  };

  const initializeCall = async () => {
    try {
      // Skip pre-checking permissions — on mobile browsers, the query API often
      // reports "denied" even when the user hasn't been prompted via a gesture yet.
      // Instead, go straight to getUserMedia which triggers the real browser prompt.

      // Try with full constraints first, fallback to audio-only if video fails
      let stream: MediaStream;
      const fullConstraints: MediaStreamConstraints = {
        video: callType === 'video' ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(fullConstraints);
      } catch (firstErr: any) {
        // If video failed, try audio-only as fallback for video calls
        if (callType === 'video' && firstErr.name !== 'NotAllowedError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            toast({ title: 'Note', description: 'Using basic camera quality due to device limitations.' });
          } catch {
            // Last resort: audio only
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsVideoOn(false);
            toast({ title: 'Audio Only', description: 'Camera not available. Joined with audio only.' });
          }
        } else {
          throw firstErr;
        }
      }
      localStreamRef.current = stream;

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Setup signaling channel
      if (recipientId === 'public') {
        setupPublicCall();
      } else {
        setupPrivateCall();
      }

      setIsConnecting(false);
      setCallReady(true);
    } catch (error: any) {
      console.error('Error initializing call:', error);
      const isPermissionDenied = error?.name === 'NotAllowedError';
      const isNotFound = error?.name === 'NotFoundError';
      toast({
        title: isPermissionDenied ? 'Permission Denied' : isNotFound ? 'Device Not Found' : 'Error',
        description: isPermissionDenied
          ? 'Please allow camera/microphone access in your browser settings and try again.'
          : isNotFound
          ? 'No camera or microphone found on this device.'
          : 'Failed to start call. Please check your device permissions.',
        variant: 'destructive'
      });
      onClose();
    }
  };

  const setupPublicCall = () => {
    if (!user) return;

    const channel = supabase.channel(`public-call-${callType}`);
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const participantsList: Array<{ user_id: string; name: string }> = [];
        
        Object.keys(state).forEach(key => {
          const presences = state[key];
          presences.forEach((presence: any) => {
            if (presence.user_id !== user.id) {
              participantsList.push({
                user_id: presence.user_id,
                name: presence.name
              });
              
              // Create peer connection for new participant if not exists
              if (!peerConnectionsRef.current.has(presence.user_id)) {
                createOfferForPeer(presence.user_id);
              }
            }
          });
        });
        
        setParticipants(participantsList);
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to === user.id) {
          await handleOffer(payload);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to === user.id) {
          await handleAnswer(payload);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to === user.id) {
          await handleIceCandidate(payload);
        }
      })
      .on('broadcast', { event: 'call-chat' }, ({ payload }) => {
        if (payload && payload.name) {
          setCallChatMessages(prev => {
            if (prev.some(m => m.id === payload.id)) return prev;
            return [...prev, payload];
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();

          await channel.track({
            user_id: user.id,
            name: profile?.name || 'Unknown',
            call_type: callType
          });
        }
      });
  };

  const setupPrivateCall = () => {
    if (!user) return;

    const channel = supabase.channel(`private-call-${callId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to === user.id) {
          await handleOffer(payload);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to === user.id) {
          await handleAnswer(payload);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to === user.id) {
          await handleIceCandidate(payload);
        }
      })
      .on('broadcast', { event: 'call-chat' }, ({ payload }) => {
        if (payload && payload.name) {
          setCallChatMessages(prev => {
            if (prev.some(m => m.id === payload.id)) return prev;
            return [...prev, payload];
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && isInitiator) {
          createOfferForPeer(recipientId);
          
          // Send push notification to recipient about the incoming call
          if (user) {
            sendNotification(
              recipientId,
              `Incoming ${callType} call`,
              `${user.name || 'Someone'} is calling you`,
              { type: 'call', callType, callerId: user.id, callerName: user.name }
            );
          }
        }
      });
  };

  const createOfferForPeer = async (targetUserId: string) => {
    try {
      const pc = createPeerConnection(targetUserId);
      peerConnectionsRef.current.set(targetUserId, pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (channelRef.current && user) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: { 
            offer, 
            to: targetUserId, 
            from: user.id,
            callId 
          }
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (payload: any) => {
    try {
      const { from, offer } = payload;
      
      const pc = createPeerConnection(from);
      peerConnectionsRef.current.set(from, pc);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (channelRef.current && user) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'answer',
          payload: { 
            answer, 
            to: from, 
            from: user.id 
          }
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (payload: any) => {
    try {
      const { from, answer } = payload;
      const pc = peerConnectionsRef.current.get(from);
      
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (payload: any) => {
    try {
      const { from, candidate } = payload;
      const pc = peerConnectionsRef.current.get(from);
      
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const switchCamera = async () => {
    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newFacingMode);
      
      // Get new stream with different camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: true
      });
      
      // Replace video track in all peer connections
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && newVideoTrack) {
          videoSender.replaceTrack(newVideoTrack);
        }
      });
      
      // Update local stream
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
        }
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
      }
      
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      
      toast({ title: 'Camera switched', description: `Now using ${newFacingMode === 'user' ? 'front' : 'back'} camera` });
    } catch (error) {
      console.error('Error switching camera:', error);
      toast({ title: 'Error', description: 'Failed to switch camera', variant: 'destructive' });
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        // Revert to camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        const newVideoTrack = cameraStream.getVideoTracks()[0];
        
        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && newVideoTrack) {
            videoSender.replaceTrack(newVideoTrack);
          }
        });
        
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
          }
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(newVideoTrack);
        }
        
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        setIsScreenSharing(false);
        toast({ title: 'Screen sharing stopped' });
      } else {
        // Start screen sharing
        // Check if device supports screen sharing
        if (!navigator.mediaDevices.getDisplayMedia) {
          toast({ 
            title: 'Not Supported', 
            description: 'Screen sharing is not available on this device', 
            variant: 'destructive' 
          });
          return;
        }
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        
        // Handle when user stops sharing via browser UI
        screenVideoTrack.onended = () => {
          setIsScreenSharing(false);
          toggleScreenShare();
        };
        
        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && screenVideoTrack) {
            videoSender.replaceTrack(screenVideoTrack);
          }
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
        toast({ title: 'Screen sharing started' });
      }
    } catch (error: any) {
      console.error('Error toggling screen share:', error);
      if (error.name === 'NotAllowedError') {
        toast({ title: 'Cancelled', description: 'Screen sharing was cancelled' });
      } else if (error.name === 'NotSupportedError' || error.name === 'TypeError') {
        toast({ title: 'Not Supported', description: 'Screen sharing is not available on this device', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to share screen', variant: 'destructive' });
      }
    }
  };

  // ── Call Recording (Owner Only) ──
  const startRecording = () => {
    if (!localStreamRef.current) return;
    try {
      const streams: MediaStream[] = [localStreamRef.current];
      remoteStreams.forEach(s => streams.push(s));
      
      // Create a combined stream using AudioContext
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      streams.forEach(s => {
        s.getAudioTracks().forEach(t => {
          const source = audioCtx.createMediaStreamSource(new MediaStream([t]));
          source.connect(dest);
        });
      });
      
      const combinedStream = new MediaStream([
        ...localStreamRef.current.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);
      
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `call-recording-${new Date().toISOString().slice(0,19)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Recording saved', description: 'Call recording has been downloaded.' });
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast({ title: 'Recording started' });
    } catch {
      toast({ title: 'Error', description: 'Failed to start recording', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  // ── In-Call Chat ──
  const sendCallChatMessage = () => {
    if (!callChatInput.trim() || !channelRef.current || !user) return;
    const msg = {
      id: Date.now().toString(),
      name: user.name || 'You',
      text: callChatInput.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    channelRef.current.send({
      type: 'broadcast',
      event: 'call-chat',
      payload: msg
    });
    setCallChatMessages(prev => [...prev, msg]);
    setCallChatInput('');
  };

  const cleanup = () => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop bandwidth monitors
    bandwidthMonitorsRef.current.forEach(id => clearInterval(id));
    bandwidthMonitorsRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    localStreamRef.current = null;
    screenStreamRef.current = null;
    audioContextRef.current = null;
    setRemoteStreams(new Map());
    setIsRecording(false);
    setCallChatMessages([]);
  };

  const handleEndCall = () => {
    cleanup();
    onClose();
  };

  // Minimized floating view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 p-2 bg-muted/50">
          <div className="flex-1 px-2">
            <p className="text-xs font-medium truncate max-w-[120px]">{recipientName}</p>
            <p className="text-[10px] text-muted-foreground">{callType === 'video' ? 'Video' : 'Voice'} Call</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsMinimized(false)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="destructive" className="h-7 w-7" onClick={handleEndCall}>
            <PhoneOff className="h-3 w-3" />
          </Button>
        </div>
        {callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-36 h-24 object-cover"
          />
        )}
        {callType === 'voice' && (
          <div className="w-36 h-16 flex items-center justify-center bg-muted">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Mic className="h-5 w-5 text-primary" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleEndCall}>
      <DialogContent className="max-w-5xl h-[85vh] p-0">
        {!callReady ? (
          /* PRE-CALL SCREEN — getUserMedia is triggered by button click (user gesture) */
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              {callType === 'video' ? (
                <Video className="h-12 w-12 text-primary" />
              ) : (
                <Mic className="h-12 w-12 text-primary" />
              )}
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">{callType === 'video' ? 'Video' : 'Voice'} Call</h2>
              <p className="text-muted-foreground">with {recipientName}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Tap the button below to allow camera and microphone access and join the call.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={handleEndCall}>
                Cancel
              </Button>
              <Button size="lg" className="gap-2 px-8" onClick={initializeCall}>
                {callType === 'video' ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                Join Call
              </Button>
            </div>
          </div>
        ) : (
        <>
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <span>
              {callType === 'video' ? 'Video' : 'Voice'} Call with {recipientName}
              {isConnecting && ' - Connecting...'}
            </span>
            {recipientId === 'public' && participants.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                <span>{participants.length + 1}</span>
              </Badge>
            )}
            <Button 
              size="icon" 
              variant="ghost" 
              className="ml-auto h-8 w-8" 
              onClick={() => setIsMinimized(true)}
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col bg-muted relative overflow-hidden">
          {callType === 'video' ? (
            <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
              {/* Local video */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-lg border-2 border-primary shadow-lg bg-gray-800"
              />
              
              {/* Remote videos */}
              {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
                <video
                  key={userId}
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && el.srcObject !== stream) {
                      el.srcObject = stream;
                    }
                  }}
                  className="w-full h-full object-cover rounded-lg border-2 border-white shadow-lg bg-gray-900"
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="h-40 w-40 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <span className="text-5xl font-semibold text-primary">
                    {recipientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <p className="text-2xl font-medium">{recipientName}</p>
                <p className="text-sm text-muted-foreground mt-3">
                  {isConnecting ? 'Connecting...' : 'Voice Call Active'}
                </p>
              </div>
            </div>
          )}

          {/* Participants list for public calls */}
          {recipientId === 'public' && participants.length > 0 && (
            <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 max-w-xs shadow-lg">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                <span>In Call ({participants.length + 1})</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="truncate">You</span>
                </div>
                {participants.map((participant) => (
                  <div key={participant.user_id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="truncate">{participant.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Music Player Panel */}
          {showMusicPlayer && (
            <div className="absolute top-4 right-4 w-72 bg-background/95 backdrop-blur-sm rounded-lg shadow-xl z-10 max-h-[60%] overflow-auto">
              <MusicPlayer compact={false} />
            </div>
          )}

          {/* In-Call Chat Panel */}
          {showCallChat && (
            <div className="absolute top-4 right-4 w-80 bg-background/95 backdrop-blur-sm rounded-lg shadow-xl z-10 flex flex-col max-h-[60%]">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <span className="text-sm font-medium">Chat</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCallChat(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {callChatMessages.map(msg => (
                    <div key={msg.id} className="text-xs">
                      <span className="font-medium text-primary">{msg.name}</span>
                      <span className="text-muted-foreground ml-2">{msg.time}</span>
                      <p className="text-foreground mt-0.5">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={callChatEndRef} />
                </div>
              </ScrollArea>
              <div className="flex items-center gap-2 p-2 border-t border-border">
                <Input
                  value={callChatInput}
                  onChange={(e) => setCallChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="text-xs h-8"
                  onKeyDown={(e) => e.key === 'Enter' && sendCallChatMessage()}
                />
                <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={sendCallChatMessage}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Call Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-4 py-3 rounded-full shadow-xl flex-wrap justify-center">
            {callType === 'video' && (
              <>
                <Button
                  size="lg"
                  variant={isVideoOn ? "default" : "destructive"}
                  className="rounded-full h-11 w-11"
                  onClick={toggleVideo}
                  title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full h-11 w-11"
                  onClick={switchCamera}
                  title="Switch camera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
                
                {!isMobile && (
                  <Button
                    size="lg"
                    variant={isScreenSharing ? "default" : "secondary"}
                    className="rounded-full h-11 w-11"
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? "Stop sharing" : "Share screen"}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            
            <Button
              size="lg"
              variant={isMicOn ? "default" : "destructive"}
              className="rounded-full h-11 w-11"
              onClick={toggleMic}
              title={isMicOn ? "Mute" : "Unmute"}
            >
              {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>

            {/* In-Call Chat Button */}
            <Button
              size="lg"
              variant={showCallChat ? "default" : "secondary"}
              className="rounded-full h-11 w-11"
              onClick={() => { setShowCallChat(!showCallChat); setShowMusicPlayer(false); }}
              title="Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>

            <Button
              size="lg"
              variant={showMusicPlayer ? "default" : "secondary"}
              className="rounded-full h-11 w-11"
              onClick={() => { setShowMusicPlayer(!showMusicPlayer); setShowCallChat(false); }}
              title={showMusicPlayer ? "Hide music" : "Show music"}
            >
              <Music className="h-4 w-4" />
            </Button>

            {/* Owner-Only Recording Button */}
            {isOwner && (
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "secondary"}
                className={`rounded-full h-11 w-11 ${isRecording ? 'animate-pulse' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                title={isRecording ? "Stop recording" : "Record call"}
              >
                <Circle className={`h-4 w-4 ${isRecording ? 'fill-current' : ''}`} />
              </Button>
            )}

            <Button
              size="lg"
              variant="destructive"
              className="rounded-full h-12 w-12"
              onClick={handleEndCall}
              title="End call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
