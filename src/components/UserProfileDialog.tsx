import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Mail, Shield, Circle, Camera, ImageIcon, Loader2, Pencil, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  created_at: string;
  roles: string[];
  status: 'online' | 'offline' | 'away';
}

const getRoleBadgeStyle = (role: string) => {
  const styles: Record<string, string> = {
    owner: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0',
    founder: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0',
    co_founder: 'bg-gradient-to-r from-orange-400 to-red-500 text-white border-0',
    ceo: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0',
    admin: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-0',
    moderator: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border-0',
    friend: 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-0',
    vip: 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-black border-0',
    premium: 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white border-0',
    platinum: 'bg-gradient-to-r from-slate-300 via-cyan-200 to-slate-400 text-slate-800 border-0',
    gold: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0',
    silver: 'bg-gradient-to-r from-slate-300 to-gray-400 text-slate-700 border-0',
    elite: 'bg-gradient-to-r from-violet-600 to-purple-700 text-white border-0',
    pro: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0',
    plus: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-0',
    basic: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white border-0',
  };
  return styles[role] || 'bg-muted text-muted-foreground';
};

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    owner: '👑 Owner',
    founder: '⭐ Founder',
    co_founder: '✦ Co-Founder',
    ceo: '💎 CEO',
    admin: '🛡️ Admin',
    moderator: '⚔️ Moderator',
    friend: '💖 Friend',
    vip: '✨ VIP',
    premium: '💫 Premium',
    platinum: '🏆 Platinum',
    gold: '🥇 Gold',
    silver: '🥈 Silver',
    elite: '🔥 Elite',
    pro: '⚡ Pro',
    plus: '➕ Plus',
    basic: '✓ Basic',
    user: '👤 User',
  };
  return labels[role] || role;
};

export function UserProfileDialog({ open, onOpenChange, userId, userName }: UserProfileDialogProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [editBioValue, setEditBioValue] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (open && userId) {
      loadUserProfile();
    }
  }, [open, userId]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('status')
        .eq('user_id', userId)
        .single();

      // Sort roles by hierarchy (highest first)
      const roleHierarchy = ['owner', 'ceo', 'founder', 'co_founder', 'admin', 'sr_admin', 'moderator', 'sr_moderator', 'vip', 'premium', 'platinum', 'gold', 'silver', 'elite', 'pro', 'plus', 'basic', 'friend', 'user'];
      const sortedRoles = (rolesData?.map(r => r.role) || ['user']).sort((a, b) => {
        const indexA = roleHierarchy.indexOf(a);
        const indexB = roleHierarchy.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      setProfile({
        id: profileData.id,
        name: profileData.name,
        email: profileData.email,
        bio: profileData.bio || null,
        avatar_url: profileData.avatar_url,
        banner_url: profileData.banner_url,
        created_at: profileData.created_at,
        roles: sortedRoles,
        status: (presenceData?.status as 'online' | 'offline' | 'away') || 'offline'
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File, type: 'avatar' | 'banner') => {
    if (!isOwnProfile || !user) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setUploading(type);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(fileName);

      const updateData = type === 'avatar' 
        ? { avatar_url: publicUrl }
        : { banner_url: publicUrl };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, ...updateData } : null);
      toast({ title: 'Success!', description: `${type === 'avatar' ? 'Avatar' : 'Banner'} updated!` });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      default: return 'Offline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="relative">
            {/* Hidden file inputs */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'avatar')}
            />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'banner')}
            />

            {/* Banner */}
            <div className="relative h-32 bg-gradient-to-br from-primary/40 via-primary/20 to-secondary/40">
              {profile.banner_url && (
                <img 
                  src={profile.banner_url} 
                  alt="Banner" 
                  className="w-full h-full object-cover"
                />
              )}
              {isOwnProfile && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploading === 'banner'}
                >
                  {uploading === 'banner' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Avatar */}
            <div className="absolute left-6 top-20">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-card">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.name} />
                  ) : null}
                  <AvatarFallback className="text-2xl bg-primary/20">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator */}
                <div className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-card ${getStatusColor(profile.status)}`} />
                {isOwnProfile && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-7 w-7 rounded-full opacity-80 hover:opacity-100"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploading === 'avatar'}
                  >
                    {uploading === 'avatar' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Content */}
            <div className="pt-14 px-6 pb-6 space-y-5">
              {/* Name & Status */}
              <div>
                <h2 className="text-xl font-bold">{profile.name}</h2>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Circle className={`h-2.5 w-2.5 fill-current ${profile.status === 'online' ? 'text-green-500' : profile.status === 'away' ? 'text-yellow-500' : 'text-gray-400'}`} />
                  {getStatusLabel(profile.status)}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* About / Bio Section */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">About Me</h3>
                    {isOwnProfile && !editingBio && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setEditBioValue(profile.bio || ''); setEditingBio(true); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {editingBio ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editBioValue}
                        onChange={(e) => setEditBioValue(e.target.value.slice(0, 300))}
                        placeholder="Tell people about yourself..."
                        className="text-sm resize-none min-h-[80px]"
                        maxLength={300}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{editBioValue.length}/300</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingBio(false)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="default"
                            size="icon"
                            className="h-7 w-7"
                            disabled={savingBio}
                            onClick={async () => {
                              if (!user) return;
                              setSavingBio(true);
                              const { error } = await supabase
                                .from('profiles')
                                .update({ bio: editBioValue.trim() || null })
                                .eq('id', user.id);
                              if (error) {
                                toast({ title: 'Failed to save', variant: 'destructive' });
                              } else {
                                setProfile(prev => prev ? { ...prev, bio: editBioValue.trim() || null } : null);
                                toast({ title: 'Bio updated' });
                                setEditingBio(false);
                              }
                              setSavingBio(false);
                            }}
                          >
                            {savingBio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm ${profile.bio ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                      {profile.bio || (isOwnProfile ? 'Click the pencil to add a description...' : 'No description yet.')}
                    </p>
                  )}
                </div>

                {/* Roles */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Roles</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.roles.length > 0 ? (
                      profile.roles.map(role => (
                        <Badge key={role} className={`${getRoleBadgeStyle(role)} text-xs px-2 py-0.5`}>
                          {getRoleLabel(role)}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary" className="text-xs">👤 User</Badge>
                    )}
                  </div>
                </div>

                {/* Member Since */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Member Since</h3>
                  <p className="text-sm">{formatDate(profile.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            User not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
