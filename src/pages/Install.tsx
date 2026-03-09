import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, CheckCircle2, ArrowLeft, Share, Plus, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import askifyLogo from '@/assets/askify-logo-new.png';

const Install = () => {
  const { isInstallable, installPWA, isInstalled } = usePWAInstall();
  const navigate = useNavigate();
  const [installing, setInstalling] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const handleInstall = async () => {
    setInstalling(true);
    await installPWA();
    setInstalling(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </header>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 -mt-12">
        {/* App icon */}
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
            <p className="text-sm text-muted-foreground">
              Install Askify on your device:
            </p>
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
      </div>
    </div>
  );
};

export default Install;
