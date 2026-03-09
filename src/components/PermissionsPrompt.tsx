import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Mic, Bell, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import askifyLogo from '@/assets/askify-logo-new.png';

type PermissionStatus = 'pending' | 'granted' | 'denied';

export function PermissionsPrompt() {
  const { user } = useAuth();
  const { subscribe, isSupported: pushSupported } = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'welcome' | 'permissions' | 'done'>('welcome');
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>('pending');
  const [micStatus, setMicStatus] = useState<PermissionStatus>('pending');
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('pending');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem('askify_perms_prompted');
    if (dismissed) return;

    // Check existing permissions
    const checkExisting = async () => {
      try {
        if (navigator.permissions) {
          const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setCameraStatus(cam.state === 'granted' ? 'granted' : cam.state === 'denied' ? 'denied' : 'pending');
          setMicStatus(mic.state === 'granted' ? 'granted' : mic.state === 'denied' ? 'denied' : 'pending');
        }
        if ('Notification' in window) {
          setNotifStatus(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'pending');
        }
      } catch {}

      // Show popup after brief delay
      setTimeout(() => setOpen(true), 1500);
    };

    checkExisting();
  }, [user]);

  const requestCameraAndMic = async () => {
    setRequesting(true);
    try {
      console.log('[Permissions] Requesting camera and microphone...');
      
      // Request both video and audio to trigger system-level permission dialogs
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      
      console.log('[Permissions] Media access granted, tracks:', stream.getTracks().length);
      
      // Stop all tracks immediately after getting permission
      stream.getTracks().forEach(t => {
        console.log('[Permissions] Stopping track:', t.kind);
        t.stop();
      });
      
      setCameraStatus('granted');
      setMicStatus('granted');
    } catch (err: any) {
      console.error('[Permissions] Media access error:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setMicStatus('denied');
      } else if (err.name === 'NotFoundError') {
        // Device doesn't have camera/mic, mark as granted to avoid blocking
        console.log('[Permissions] No media devices found, skipping');
        setCameraStatus('granted');
        setMicStatus('granted');
      }
    }
    setRequesting(false);
  };

  const requestNotifications = async () => {
    setRequesting(true);
    try {
      if (pushSupported) {
        const result = await subscribe();
        setNotifStatus(result ? 'granted' : 'denied');
      } else if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        setNotifStatus(perm === 'granted' ? 'granted' : 'denied');
      }
    } catch {
      setNotifStatus('denied');
    }
    setRequesting(false);
  };

  const handleGrantAll = async () => {
    if (cameraStatus === 'pending' || micStatus === 'pending') {
      await requestCameraAndMic();
    }
    if (notifStatus === 'pending') {
      await requestNotifications();
    }
    setStep('done');
  };

  const handleDismiss = () => {
    localStorage.setItem('askify_perms_prompted', 'true');
    setOpen(false);
  };

  const allGranted = cameraStatus === 'granted' && micStatus === 'granted' && notifStatus === 'granted';

  const StatusIcon = ({ status }: { status: PermissionStatus }) => {
    if (status === 'granted') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === 'denied') return <XCircle className="h-5 w-5 text-red-500" />;
    return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md max-w-[92vw] rounded-2xl">
        {step === 'welcome' && (
          <div className="text-center space-y-4 py-2">
            <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden shadow-md border border-border">
              <img src={askifyLogo} alt="Askify" className="w-full h-full object-cover" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl">Welcome to Askify!</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                To get the best experience with video calls, voice chat, and notifications, we need a few permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-left px-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="p-2 rounded-lg bg-blue-500/10"><Camera className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-sm font-medium">Camera</p>
                  <p className="text-xs text-muted-foreground">For video calls & live features</p>
                </div>
                <div className="ml-auto"><StatusIcon status={cameraStatus} /></div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="p-2 rounded-lg bg-purple-500/10"><Mic className="h-5 w-5 text-purple-500" /></div>
                <div>
                  <p className="text-sm font-medium">Microphone</p>
                  <p className="text-xs text-muted-foreground">For voice & video calls</p>
                </div>
                <div className="ml-auto"><StatusIcon status={micStatus} /></div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="p-2 rounded-lg bg-orange-500/10"><Bell className="h-5 w-5 text-orange-500" /></div>
                <div>
                  <p className="text-sm font-medium">Notifications</p>
                  <p className="text-xs text-muted-foreground">Get notified for messages & calls</p>
                </div>
                <div className="ml-auto"><StatusIcon status={notifStatus} /></div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleDismiss}>
                Maybe Later
              </Button>
              <Button className="flex-1 gap-2" onClick={handleGrantAll} disabled={requesting}>
                <Shield className="h-4 w-4" />
                {requesting ? 'Requesting...' : 'Allow All'}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl">
                {allGranted ? "You're all set!" : "Permissions Updated"}
              </DialogTitle>
              <DialogDescription>
                {allGranted
                  ? "Enjoy the full Askify experience with video calls, voice chat, and notifications."
                  : "Some permissions were denied. You can change this anytime in your browser settings."}
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full" onClick={handleDismiss}>
              Get Started
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
