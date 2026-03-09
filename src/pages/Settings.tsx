import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { 
  ArrowLeft, User, Zap, Mail, Sun, Moon, Monitor, Palette, 
  Settings as SettingsIcon, Mic, Database, Shield, Info, LogOut, Bell, BellOff, 
  RefreshCw, Pencil, Camera, Lock, Download, ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const Settings = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSupported, isSubscribed, isLoading: isPushLoading, subscribe, unsubscribe } = usePushNotifications();
  
  // Profile edit state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  
  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAStep, setTwoFAStep] = useState<'toggle' | 'verify'>('toggle');
  const [twoFALoading, setTwoFALoading] = useState(false);
  
  // Security
  const [showSecurity, setShowSecurity] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Accent color
  const [accentColor, setAccentColor] = useState('Default');

  useEffect(() => {
    if (user?.id) {
      loadProfile();
      load2FAStatus();
    }
  }, [user?.id]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();
    if (data) {
      setProfileData(data);
      setEditName(data.name);
      setEditBio(data.bio || '');
    }
  };

  const load2FAStatus = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', `2fa_${user!.id}`)
      .maybeSingle();
    setTwoFAEnabled(!!(data?.value as any)?.enabled);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setProfileLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: editName.trim(), bio: editBio.trim() || null })
      .eq('id', user!.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
      setShowEditProfile(false);
      loadProfile();
    }
    setProfileLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(path, file, { upsert: true });
    
    if (uploadError) {
      toast({ title: 'Upload failed', variant: 'destructive' });
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(path);
    
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    toast({ title: 'Avatar updated' });
    loadProfile();
  };

  const handleToggle2FA = async () => {
    if (twoFAEnabled) {
      // Disable 2FA
      setTwoFALoading(true);
      await supabase.from('app_settings').upsert({
        key: `2fa_${user!.id}`,
        value: { enabled: false }
      }, { onConflict: 'key' });
      setTwoFAEnabled(false);
      toast({ title: '2FA Disabled' });
      setTwoFALoading(false);
      setShow2FA(false);
    } else {
      // Enable - send verification code
      setTwoFAStep('verify');
      setTwoFALoading(true);
      try {
        await supabase.functions.invoke('send-otp', {
          body: { email: user!.email, name: user!.name || 'User', purpose: '2fa_setup' }
        });
        toast({ title: 'Verification code sent', description: 'Check your email' });
      } catch {
        toast({ title: 'Failed to send code', variant: 'destructive' });
      }
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFACode.trim()) return;
    setTwoFALoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { email: user!.email, code: twoFACode.trim(), purpose: '2fa_setup' }
      });
      
      if (error || !data?.success) {
        toast({ title: 'Invalid code', variant: 'destructive' });
      } else {
        await supabase.from('app_settings').upsert({
          key: `2fa_${user!.id}`,
          value: { enabled: true, enabled_at: new Date().toISOString() }
        }, { onConflict: 'key' });
        setTwoFAEnabled(true);
        toast({ title: '2FA Enabled', description: 'Your account is now more secure' });
        setShow2FA(false);
        setTwoFAStep('toggle');
        setTwoFACode('');
      }
    } catch {
      toast({ title: 'Verification failed', variant: 'destructive' });
    }
    setTwoFALoading(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Failed to update password', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password updated successfully' });
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="h-5 w-5" />;
    if (theme === 'dark') return <Moon className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
    toast({ title: `Theme: ${nextTheme}` });
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const settingSections = [
    {
      title: 'Account',
      items: [
        { 
          icon: Mail, label: 'Email', subtitle: user?.email || '',
          onClick: () => toast({ title: 'Email', description: 'Managed through your account' })
        },
        { 
          icon: getThemeIcon(), label: 'Theme', 
          subtitle: theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System',
          onClick: cycleTheme, isCustomIcon: true
        },
        { 
          icon: Palette, label: 'Accent Color', subtitle: accentColor,
          onClick: () => {
            const colors = ['Default', 'Blue', 'Purple', 'Green', 'Orange'];
            const idx = colors.indexOf(accentColor);
            const next = colors[(idx + 1) % colors.length];
            setAccentColor(next);
            toast({ title: `Accent: ${next}` });
          }
        },
      ]
    },
    {
      title: 'Features',
      items: [
        { 
          icon: isSubscribed ? Bell : BellOff, label: 'Push Notifications', 
          subtitle: !isSupported ? 'Not supported' : isSubscribed ? 'Enabled' : 'Disabled',
          onClick: async () => {
            if (!isSupported) {
              toast({ title: 'Not supported in this browser' });
              return;
            }
            isSubscribed ? await unsubscribe() : await subscribe();
          }
        },
        { 
          icon: Camera, label: 'Camera & Microphone', subtitle: 'Request permissions',
          onClick: async () => {
            try {
              toast({ title: 'Requesting permissions...' });
              const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: true 
              });
              stream.getTracks().forEach(t => t.stop());
              toast({ title: 'Permissions granted!', description: 'Camera and microphone access enabled' });
            } catch (err: any) {
              if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                toast({ 
                  title: 'Permission denied', 
                  description: 'Please enable camera/mic in your browser or app settings',
                  variant: 'destructive'
                });
              } else {
                toast({ title: 'Error', description: err.message, variant: 'destructive' });
              }
            }
          }
        },
        { 
          icon: RefreshCw, label: 'Update the app', subtitle: 'Clear cache & reload',
          onClick: async () => {
            toast({ title: 'Refreshing...' });
            if ('caches' in window) {
              const names = await caches.keys();
              await Promise.all(names.map(n => caches.delete(n)));
            }
            window.location.reload();
          }
        },
        { icon: Download, label: 'Install App', onClick: () => navigate('/install') },
        { icon: Database, label: 'Memory', subtitle: 'AI personalization', onClick: () => navigate('/') },
      ]
    },
    {
      title: 'Security',
      items: [
        { 
          icon: Shield, label: 'Two-Factor Auth (2FA)', 
          subtitle: twoFAEnabled ? '✅ Enabled' : 'Disabled',
          onClick: () => { setShow2FA(true); setTwoFAStep('toggle'); setTwoFACode(''); }
        },
        { 
          icon: Lock, label: 'Change Password',
          onClick: () => { setShowChangePassword(true); setNewPassword(''); setConfirmPassword(''); }
        },
      ]
    },
    {
      title: 'Social',
      items: [
        { icon: User, label: 'Public Chat', onClick: () => navigate('/public-chat') },
        { icon: Info, label: 'About', onClick: () => toast({ title: 'Askify', description: 'Made by Mr. Rudra' }) },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto">
        <header className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Profile Section */}
            <div className="flex flex-col items-center py-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-border">
                  {profileData?.avatar_url && <AvatarImage src={profileData.avatar_url} />}
                  <AvatarFallback className="text-2xl bg-muted">
                    {user?.name ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="h-6 w-6 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              <h2 className="text-xl font-semibold mt-3">{profileData?.name || user?.name || 'User'}</h2>
              {profileData?.bio && <p className="text-sm text-muted-foreground mt-1">{profileData.bio}</p>}
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 rounded-full"
                onClick={() => {
                  setEditName(profileData?.name || '');
                  setEditBio(profileData?.bio || '');
                  setShowEditProfile(true);
                }}
              >
                <Pencil className="h-3 w-3 mr-2" />
                Edit Profile
              </Button>
            </div>

            {/* Settings Sections */}
            {settingSections.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {section.items.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {(item as any).isCustomIcon ? (item.icon as any) : <item.icon className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{item.label}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Log out</span>
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Display Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Bio</label>
              <Input value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Tell people about yourself" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={profileLoading}>
              {profileLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Dialog */}
      <Dialog open={show2FA} onOpenChange={setShow2FA}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {twoFAEnabled 
                ? 'Your account has 2FA enabled. You can disable it below.' 
                : 'Add an extra layer of security to your account.'}
            </DialogDescription>
          </DialogHeader>
          {twoFAStep === 'toggle' ? (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Email Verification</p>
                  <p className="text-sm text-muted-foreground">
                    Require a code sent to {user?.email} on each login
                  </p>
                </div>
                <Switch checked={twoFAEnabled} onCheckedChange={handleToggle2FA} disabled={twoFALoading} />
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <strong>{user?.email}</strong>
              </p>
              <Input 
                value={twoFACode} 
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={6}
              />
              <Button onClick={handleVerify2FA} disabled={twoFALoading || twoFACode.length !== 6} className="w-full">
                {twoFALoading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
