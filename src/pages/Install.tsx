import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, Smartphone, Monitor, Apple, CheckCircle2, ArrowLeft, Zap, Shield, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import askifyLogo from '@/assets/askify-logo-new.png';

const Install = () => {
  const { isInstallable, installPWA, isInstalled } = usePWAInstall();
  const navigate = useNavigate();
  const [installing, setInstalling] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  const handleInstall = async () => {
    setInstalling(true);
    await installPWA();
    setInstalling(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Get Askify</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 rounded-2xl overflow-hidden shadow-lg border border-border">
            <img src={askifyLogo} alt="Askify" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Askify</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            AI-powered chat, image generation, games, and more — right on your device.
          </p>
        </div>

        {/* Install Status */}
        {isInstalled ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-6 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="text-xl font-semibold">Already Installed!</h3>
              <p className="text-muted-foreground">Askify is installed on your device. Open it from your home screen.</p>
              <Button onClick={() => navigate('/')} className="mt-2">
                Open Askify
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Direct Install Button */}
            {isInstallable && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6 text-center space-y-4">
                  <Download className="h-10 w-10 text-primary mx-auto" />
                  <h3 className="text-xl font-semibold">Install Askify</h3>
                  <p className="text-muted-foreground">Add Askify to your home screen for the best experience.</p>
                  <Button size="lg" onClick={handleInstall} disabled={installing} className="w-full max-w-xs">
                    {installing ? 'Installing...' : 'Install Now'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Platform-specific instructions */}
            {isIOS && !isInstallable && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Apple className="h-8 w-8" />
                    <h3 className="text-lg font-semibold">Install on iPhone / iPad</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                      <span>Tap the <strong>Share</strong> button (square with an arrow) at the bottom of Safari</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                      <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                      <span>Tap <strong>"Add"</strong> to install Askify</span>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            )}

            {isAndroid && !isInstallable && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8" />
                    <h3 className="text-lg font-semibold">Install on Android</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                      <span>Tap the <strong>⋮ menu</strong> (three dots) in Chrome</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                      <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                      <span>Tap <strong>"Install"</strong> to confirm</span>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            )}

            {!isMobile && !isInstallable && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-8 w-8" />
                    <h3 className="text-lg font-semibold">Install on Desktop</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                      <span>Look for the <strong>install icon</strong> (⊕) in the address bar</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                      <span>Click <strong>"Install"</strong> to add Askify to your desktop</span>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 text-center space-y-2">
              <Zap className="h-8 w-8 text-primary mx-auto" />
              <h4 className="font-semibold">Lightning Fast</h4>
              <p className="text-xs text-muted-foreground">Loads instantly, works offline</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center space-y-2">
              <Shield className="h-8 w-8 text-primary mx-auto" />
              <h4 className="font-semibold">Secure</h4>
              <p className="text-xs text-muted-foreground">End-to-end encrypted chats</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center space-y-2">
              <Wifi className="h-8 w-8 text-primary mx-auto" />
              <h4 className="font-semibold">Works Offline</h4>
              <p className="text-xs text-muted-foreground">No internet? No problem</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Install;
