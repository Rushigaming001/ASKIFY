import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, CheckCircle2, ArrowLeft, Share, Plus, MoreVertical, Camera, Mic, Bell, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import askifyLogo from '@/assets/askify-logo-new.png';

const Install = () => {
  const { isInstallable, installPWA, isInstalled } = usePWAInstall();
  const navigate = useNavigate();
  const [installing, setInstalling] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState<Record<string, boolean>>({});
  const [requestingPerms, setRequestingPerms] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const handleInstall = async () => {
    setInstalling(true);
    await installPWA();
    setInstalling(false);
  };

  const requestAllPermissions = async () => {
    setRequestingPerms(true);
    const results: Record<string, boolean> = {};

    // Camera & Microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop());
      results.camera = true;
      results.microphone = true;
    } catch {
      results.camera = false;
      results.microphone = false;
    }

    // Notifications
    try {
      const perm = await Notification.requestPermission();
      results.notifications = perm === 'granted';
    } catch {
      results.notifications = false;
    }

    setPermissionsGranted(results);
    setRequestingPerms(false);

    const granted = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    if (granted === total) {
      toast({ title: '✅ All permissions granted!', description: 'Askify is fully set up.' });
    } else {
      toast({ title: `${granted}/${total} permissions granted`, description: 'Some features may be limited.', variant: 'destructive' });
    }
  };

  const permissionItems = [
    { key: 'camera', icon: Camera, label: 'Camera', desc: 'Video calls & photo capture' },
    { key: 'microphone', icon: Mic, label: 'Microphone', desc: 'Voice chat & audio messages' },
    { key: 'notifications', icon: Bell, label: 'Notifications', desc: 'Message alerts & updates' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 -mt-6">
        <div className="w-28 h-28 rounded-[28px] overflow-hidden shadow-xl border border-border mb-6">
          <img src={askifyLogo} alt="Askify" className="w-full h-full object-cover" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-1">Askify</h1>
        <p className="text-sm text-muted-foreground mb-8">AI Chat & Tools</p>

        {isInstalled ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-muted-foreground text-sm">Already installed on your device</p>
            <Button size="lg" onClick={() => navigate('/')} className="rounded-full px-8">
              Open Askify
            </Button>
          </div>
        ) : isInstallable ? (
          <Button
            size="lg"
            onClick={handleInstall}
            disabled={installing}
            className="rounded-full px-10 h-12 text-base gap-2"
          >
            <Download className="h-5 w-5" />
            {installing ? 'Installing...' : 'Install App'}
          </Button>
        ) : (
          <div className="text-center max-w-xs space-y-5">
            <p className="text-sm text-muted-foreground">Install Askify on your device:</p>
            {isIOS ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Share className="h-4 w-4 text-primary" />
                  </div>
                  <span>Tap <strong className="text-foreground">Share</strong> in Safari</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <span>Tap <strong className="text-foreground">Add to Home Screen</strong></span>
                </div>
              </div>
            ) : isAndroid ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MoreVertical className="h-4 w-4 text-primary" />
                  </div>
                  <span>Tap <strong className="text-foreground">⋮ menu</strong> in Chrome</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <span>Tap <strong className="text-foreground">Install app</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click the <strong className="text-foreground">install icon ⊕</strong> in your browser's address bar
              </p>
            )}
          </div>
        )}

        {/* Permissions Section */}
        <div className="w-full max-w-sm mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">App Permissions</h2>
          </div>

          <div className="space-y-3 mb-5">
            {permissionItems.map(({ key, icon: Icon, label, desc }) => (
              <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {permissionsGranted[key] !== undefined && (
                  <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${permissionsGranted[key] ? 'text-emerald-500' : 'text-destructive'}`} />
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={requestAllPermissions}
            disabled={requestingPerms}
            variant="outline"
            className="w-full rounded-full gap-2"
          >
            <Shield className="h-4 w-4" />
            {requestingPerms ? 'Requesting...' : 'Grant All Permissions'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
