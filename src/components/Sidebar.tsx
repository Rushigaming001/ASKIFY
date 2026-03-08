import { useState, useEffect } from 'react';
import { Plus, MessageSquare, MoreVertical, Edit2, Trash2, Share2, Menu, Settings, LogOut, User, Download, Mail, Pin, Shield, Users as UsersIcon, MessageCircle, Sparkles, Gamepad2, Pencil, Wind, BarChart3, Play, BookOpen, Crown, PanelLeftClose, PanelLeft, Calculator, Video, Film, Box, Clapperboard, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import askifyLogoNew from '@/assets/askify-logo-new.png';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { MathSolver } from '@/components/MathSolver';
import { LiveVideoCall } from '@/components/LiveVideoCall';
import { VideoGenerator } from '@/components/VideoGenerator';
import MinecraftPluginMaker from '@/components/MinecraftPluginMaker';
import CapCutPro from '@/components/CapCutPro';
import { useUserRestrictions } from '@/hooks/useUserRestrictions';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  alwaysOpen?: boolean;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({ isOpen, onToggle, alwaysOpen = false, collapsed = false, onCollapse }: SidebarProps) {
  const { chats, currentChat, createNewChat, selectChat, deleteChat, deleteAllChats, renameChat, togglePinChat } = useChat();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isInstallable, installPWA, isInstalled } = usePWAInstall();
  const { restrictions } = useUserRestrictions();
  const [renameDialog, setRenameDialog] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unreadPublicCount, setUnreadPublicCount] = useState(0);

  const handleToolClick = (toolName: string, restrictionKey: keyof typeof restrictions) => {
    if (restrictions[restrictionKey]) {
      toast({
        title: 'Access Restricted',
        description: `You don't have access to ${toolName}. Contact an admin for assistance.`,
        variant: 'destructive'
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    checkAdminStatus();
    fetchUserRole();
    
    // Clear unread count when user views public chat
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && window.location.pathname === '/public-chat') {
        setUnreadPublicCount(0);
        if (user) {
          localStorage.setItem(`askify_last_public_read_${user.id}`, Date.now().toString());
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Clear public chat unread count when on that page
  useEffect(() => {
    if (window.location.pathname === '/public-chat' && user) {
      setUnreadPublicCount(0);
      localStorage.setItem(`askify_last_public_read_${user.id}`, Date.now().toString());
    }
  }, [user]);

  useEffect(() => {
    checkAdminStatus();
    fetchUserRole();
  }, [user]);

  const checkAdminStatus = async () => {
    const userId = user?.id;
    if (!userId) {
      setIsOwner(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('is_owner', {
        _user_id: userId,
      });

      if (error) throw error;
      setIsOwner(!!data);
    } catch {
      setIsOwner(false);
    }
  };

  const fetchUserRole = async () => {
    const userId = user?.id;
    if (!userId) {
      setUserRole(null);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      setUserRole(data?.role || null);
    } catch {
      setUserRole(null);
    }
  };

  const isPaidRole = (role: string | null) => {
    const paidRoles = ['plus', 'pro', 'elite', 'silver', 'gold', 'platinum', 'basic', 'premium', 'vip'];
    return role && paidRoles.includes(role);
  };

  const getRoleBadgeStyle = (role: string) => {
    const styles: Record<string, string> = {
      // Owner/Founder tier - Most prestigious
      owner: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-yellow-300',
      founder: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-300',
      co_founder: 'bg-gradient-to-r from-orange-400 to-red-500 text-white border-orange-300',
      ceo: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-300',
      // Staff tier
      admin: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-300',
      moderator: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-300',
      friend: 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-pink-300',
      // Premium paid tiers
      vip: 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-black border-yellow-200',
      premium: 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white border-fuchsia-300',
      platinum: 'bg-gradient-to-r from-slate-300 via-cyan-200 to-slate-400 text-slate-800 border-cyan-200',
      gold: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-yellow-300',
      silver: 'bg-gradient-to-r from-slate-300 to-gray-400 text-slate-700 border-slate-200',
      elite: 'bg-gradient-to-r from-violet-600 to-purple-700 text-white border-violet-400',
      pro: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-300',
      plus: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-cyan-300',
      basic: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white border-emerald-300',
    };
    return styles[role] || 'bg-muted text-muted-foreground border-border';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: '👑 OWNER',
      founder: '⭐ FOUNDER',
      co_founder: '✦ CO-FOUNDER',
      ceo: '💎 CEO',
      admin: '🛡️ ADMIN',
      moderator: '⚔️ MOD',
      friend: '💖 FRIEND',
      vip: '✨ VIP',
      premium: '💫 PREMIUM',
      platinum: '🏆 PLATINUM',
      gold: '🥇 GOLD',
      silver: '🥈 SILVER',
      elite: '🔥 ELITE',
      pro: '⚡ PRO',
      plus: '➕ PLUS',
      basic: '✓ BASIC',
    };
    return labels[role] || role.toUpperCase();
  };

  const handleRename = (chatId: string) => {
    if (newTitle.trim()) {
      renameChat(chatId, newTitle);
      setRenameDialog(null);
      setNewTitle('');
      toast({ title: 'Chat renamed successfully' });
    }
  };

  const handleDelete = (chatId: string) => {
    deleteChat(chatId);
    toast({ title: 'Chat deleted' });
  };

  const handleShare = () => {
    toast({ title: 'Share feature', description: 'Share link copied to clipboard!' });
  };

  const handlePin = (chatId: string) => {
    togglePinChat(chatId);
    toast({ title: 'Chat pinned status updated' });
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // For desktop with alwaysOpen, don't show toggle button when closed
  if (!isOpen && !alwaysOpen) {
    return (
      <div className="fixed top-4 left-4 z-50 animate-fade-in lg:hidden">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggle} 
          className="bg-background/80 backdrop-blur hover:bg-background hover:scale-110 transition-all duration-200 shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Desktop always-open sidebar (with collapse support)
  if (alwaysOpen) {
    return (
      <TooltipProvider>
        <aside className={`hidden lg:flex fixed left-0 top-0 h-full ${collapsed ? 'w-16' : 'w-72'} bg-sidebar border-r border-sidebar-border z-40 flex-col shadow-lg transition-all duration-300`}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className={`flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
              <img src={askifyLogoNew} alt="Askify" className="h-8 w-8 transition-transform hover:scale-110 duration-200" />
              {!collapsed && (
                <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">ASKIFY</span>
              )}
            </div>
            {!collapsed && onCollapse && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onCollapse(true)}
                className="h-8 w-8 hover:scale-110 transition-all"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className={`p-3 ${collapsed ? 'px-2' : ''}`}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={createNewChat} 
                    className="w-full hover:scale-105 transition-all duration-200" 
                    size="icon"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Chat</TooltipContent>
              </Tooltip>
            ) : (
              <Button 
                onClick={createNewChat} 
                className="w-full hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg" 
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                New Chat
              </Button>
            )}
          </div>
          
          {!collapsed && (
            <div className="px-4 py-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Chat History
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1">
              {chats
                .sort((a, b) => {
                  if (a.pinned && !b.pinned) return -1;
                  if (!a.pinned && b.pinned) return 1;
                  return b.createdAt - a.createdAt;
                })
                .map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent transition-all duration-200 hover:scale-[1.02] hover:shadow-sm ${
                    currentChat?.id === chat.id ? 'bg-accent shadow-sm' : ''
                  } ${collapsed ? 'justify-center' : ''}`}
                  onClick={() => selectChat(chat.id)}
                >
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right">{chat.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <>
                      {chat.pinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate text-sm max-w-[140px]" title={chat.title}>{chat.title}</span>
                      
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Dialog open={renameDialog === chat.id} onOpenChange={(open) => !open && setRenameDialog(null)}>
                            <DialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => {
                                e.preventDefault();
                                setRenameDialog(chat.id);
                                setNewTitle(chat.title);
                              }}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Rename Chat</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <Input
                                  value={newTitle}
                                  onChange={(e) => setNewTitle(e.target.value)}
                                  placeholder="Enter new title"
                                />
                                <Button onClick={() => handleRename(chat.id)} className="w-full">
                                  Save
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <DropdownMenuItem onSelect={() => handlePin(chat.id)}>
                            <Pin className="h-4 w-4 mr-2" />
                            {chat.pinned ? 'Unpin' : 'Pin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={handleShare}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleDelete(chat.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-border p-2 space-y-1">
            {collapsed ? (
              <>
                {/* AI Tools - Collapsed */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-full">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48">
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Math Solver', 'math_solver_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Calculator className="h-4 w-4 mr-2" />
                          Math
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.math_solver_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Math Solver</DialogTitle>
                          </DialogHeader>
                          <MathSolver />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Live Video', 'live_video_call_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Video className="h-4 w-4 mr-2" />
                          Live Video
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.live_video_call_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Live Video Call with AI</DialogTitle>
                          </DialogHeader>
                          <LiveVideoCall />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Video Generator', 'video_generation_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Film className="h-4 w-4 mr-2" />
                          Video Gen
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.video_generation_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>AI Video Generator</DialogTitle>
                          </DialogHeader>
                          <VideoGenerator />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Minecraft Plugin Maker', 'minecraft_plugin_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Box className="h-4 w-4 mr-2" />
                          Minecraft
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.minecraft_plugin_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Minecraft Creator Studio</DialogTitle>
                          </DialogHeader>
                          <MinecraftPluginMaker />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem>
                          <Clapperboard className="h-4 w-4 mr-2" />
                          CapCut
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>CapCut Pro Video Editor</DialogTitle>
                        </DialogHeader>
                        <CapCutPro />
                      </DialogContent>
                    </Dialog>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate('/')}
                      className="w-full"
                    >
                      <Home className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Home</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate('/pricing')}
                      className="w-full"
                    >
                      <Crown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Pricing / Upgrade</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate('/public-chat')}
                      className="w-full relative"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {unreadPublicCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                          {unreadPublicCount > 9 ? '9+' : unreadPublicCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Public Chat
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate('/settings')}
                      className="w-full"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>

                {isOwner && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate('/admin')}
                        className="w-full"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Control Panel</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => onCollapse?.(false)}
                      className="w-full"
                    >
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expand Sidebar</TooltipContent>
                </Tooltip>
                
                <div className="flex items-center justify-center pt-2 border-t border-border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleLogout} 
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Logout</TooltipContent>
                  </Tooltip>
                </div>
              </>
            ) : (
              <>
                {/* AI Tools Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start hover:bg-accent transition-all duration-200" size="sm">
                      <Menu className="h-4 w-4 mr-2" />
                      AI Tools
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48">
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Math Solver', 'math_solver_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Calculator className="h-4 w-4 mr-2" />
                          Math
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.math_solver_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Math Solver</DialogTitle>
                          </DialogHeader>
                          <MathSolver />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Live Video', 'live_video_call_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Video className="h-4 w-4 mr-2" />
                          Live Video
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.live_video_call_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Live Video Call with AI</DialogTitle>
                          </DialogHeader>
                          <LiveVideoCall />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Video Generator', 'video_generation_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Film className="h-4 w-4 mr-2" />
                          Video Gen
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.video_generation_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>AI Video Generator</DialogTitle>
                          </DialogHeader>
                          <VideoGenerator />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          if (!handleToolClick('Minecraft Plugin Maker', 'minecraft_plugin_disabled')) {
                            e.preventDefault();
                          }
                        }}>
                          <Box className="h-4 w-4 mr-2" />
                          Minecraft
                        </DropdownMenuItem>
                      </DialogTrigger>
                      {!restrictions.minecraft_plugin_disabled && (
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Minecraft Creator Studio</DialogTitle>
                          </DialogHeader>
                          <MinecraftPluginMaker />
                        </DialogContent>
                      )}
                    </Dialog>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem>
                          <Clapperboard className="h-4 w-4 mr-2" />
                          CapCut
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>CapCut Pro Video Editor</DialogTitle>
                        </DialogHeader>
                        <CapCutPro />
                      </DialogContent>
                    </Dialog>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-accent transition-all duration-200" 
                  size="sm"
                  onClick={() => navigate('/')}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>

                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-accent transition-all duration-200" 
                  size="sm"
                  onClick={() => navigate('/pricing')}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Pricing / Upgrade
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-accent transition-all duration-200 relative" 
                  size="sm"
                  onClick={() => navigate('/public-chat')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Public Chat
                  {unreadPublicCount > 0 && (
                    <Badge className="ml-auto bg-blue-500 text-white text-[10px] px-1.5 py-0 h-4">
                      {unreadPublicCount > 99 ? '99+' : unreadPublicCount}
                    </Badge>
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-accent transition-all duration-200" 
                  size="sm"
                  onClick={async () => {
                    const result = await installPWA();
                    if (result === 'already-installed') {
                      toast({ title: 'Already Installed', description: 'Askify app is already installed!' });
                    } else if (result === true) {
                      toast({ title: 'Success!', description: 'Askify app has been installed!' });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download App
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-accent transition-all duration-200" 
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>

                <Button 
                  variant="ghost" 
                  className="w-full justify-start hover:bg-accent transition-all duration-200" 
                  size="sm"
                  onClick={() => window.location.href = 'mailto:opgamer012321@gmail.com'}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Us
                </Button>

                {isOwner && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start hover:bg-accent transition-all duration-200" 
                    size="sm"
                    onClick={() => navigate('/admin')}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Control Panel
                  </Button>
                )}
                
                <div className="flex items-center gap-2 p-2 border-t border-border">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{user?.name}</span>
                      {userRole && userRole !== 'user' && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-5 font-bold border shadow-sm ${getRoleBadgeStyle(userRole)}`}>
                          {getRoleLabel(userRole)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleLogout} 
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </TooltipProvider>
    );
  }

  // Mobile/tablet overlay sidebar
  return (
    <>
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in lg:hidden" 
        onClick={onToggle} 
      />
      <aside className="fixed left-0 top-0 h-full w-64 md:w-72 bg-sidebar border-r border-sidebar-border z-50 flex flex-col shadow-2xl animate-slide-in-left lg:hidden">
        <div className="p-4 border-b border-border flex items-center justify-between backdrop-blur">
          <div className="flex items-center gap-2 animate-scale-in">
            <img src={askifyLogoNew} alt="Askify" className="h-8 w-8 transition-transform hover:scale-110 duration-200" />
            <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">ASKIFY</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle}
            className="hover:bg-accent hover:rotate-90 transition-all duration-300"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-2">
          <Button 
            onClick={createNewChat} 
            className="w-full hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg" 
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Chat
          </Button>
        </div>
        
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Chat History
          </div>
          {chats.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
              onClick={async () => {
                if (confirm('Delete all chats? This cannot be undone.')) {
                  await deleteAllChats();
                  toast({ title: 'All chats cleared' });
                }
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1">
            {chats
              .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.createdAt - a.createdAt;
              })
              .map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent transition-all duration-200 hover:scale-[1.02] hover:shadow-sm ${
                  currentChat?.id === chat.id ? 'bg-accent shadow-sm' : ''
                }`}
              >
                {chat.pinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
                <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span
                  className="flex-1 truncate text-sm"
                  onClick={() => selectChat(chat.id)}
                >
                  {chat.title}
                </span>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Dialog open={renameDialog === chat.id} onOpenChange={(open) => !open && setRenameDialog(null)}>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setRenameDialog(chat.id);
                          setNewTitle(chat.title);
                        }}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rename Chat</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Enter new title"
                          />
                          <Button onClick={() => handleRename(chat.id)} className="w-full">
                            Save
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <DropdownMenuItem onSelect={() => handlePin(chat.id)}>
                      <Pin className="h-4 w-4 mr-2" />
                      {chat.pinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleDelete(chat.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-2 space-y-1 animate-fade-in">
          {/* AI Tools Menu for Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" size="sm">
                <Menu className="h-4 w-4 mr-2" />
                AI Tools
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => {
                    if (!handleToolClick('Math Solver', 'math_solver_disabled')) {
                      e.preventDefault();
                    }
                  }}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Math
                  </DropdownMenuItem>
                </DialogTrigger>
                {!restrictions.math_solver_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Math Solver</DialogTitle>
                    </DialogHeader>
                    <MathSolver />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => {
                    if (!handleToolClick('Live Video', 'live_video_call_disabled')) {
                      e.preventDefault();
                    }
                  }}>
                    <Video className="h-4 w-4 mr-2" />
                    Live Video
                  </DropdownMenuItem>
                </DialogTrigger>
                {!restrictions.live_video_call_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Live Video Call with AI</DialogTitle>
                    </DialogHeader>
                    <LiveVideoCall />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => {
                    if (!handleToolClick('Video Generator', 'video_generation_disabled')) {
                      e.preventDefault();
                    }
                  }}>
                    <Film className="h-4 w-4 mr-2" />
                    Video Gen
                  </DropdownMenuItem>
                </DialogTrigger>
                {!restrictions.video_generation_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>AI Video Generator</DialogTitle>
                    </DialogHeader>
                    <VideoGenerator />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => {
                    if (!handleToolClick('Minecraft Plugin Maker', 'minecraft_plugin_disabled')) {
                      e.preventDefault();
                    }
                  }}>
                    <Box className="h-4 w-4 mr-2" />
                    Minecraft
                  </DropdownMenuItem>
                </DialogTrigger>
                {!restrictions.minecraft_plugin_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Minecraft Creator Studio</DialogTitle>
                    </DialogHeader>
                    <MinecraftPluginMaker />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <DropdownMenuItem>
                    <Clapperboard className="h-4 w-4 mr-2" />
                    CapCut
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>CapCut Pro Video Editor</DialogTitle>
                  </DialogHeader>
                  <CapCutPro />
                </DialogContent>
              </Dialog>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
            size="sm"
            onClick={() => navigate('/')}
          >
            <Home className="h-4 w-4 mr-2" />
            Home
          </Button>

          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
            size="sm"
            onClick={() => navigate('/pricing')}
          >
            <Crown className="h-4 w-4 mr-2" />
            Pricing / Upgrade
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
            size="sm"
            onClick={() => navigate('/public-chat')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Public Chat
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
            size="sm"
            onClick={async () => {
              const result = await installPWA();
              if (result === 'already-installed') {
                toast({
                  title: 'Already Installed',
                  description: 'Askify app is already installed on your device!'
                });
              } else if (result === true) {
                toast({
                  title: 'Success!',
                  description: 'Askify app has been installed successfully!'
                });
              } else if (result === false) {
                toast({
                  title: 'Installation Cancelled',
                  description: 'You cancelled the installation.'
                });
              } else {
                const apkUrl = 'https://your-server.com/askify.apk';
                const link = document.createElement('a');
                link.href = apkUrl;
                link.download = 'Askify.apk';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                toast({
                  title: 'Download Started',
                  description: 'APK download will begin shortly. Install it to use Askify as a native app!',
                  duration: 5000
                });
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Mobile App
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
            size="sm"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>

          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
            size="sm"
            onClick={() => window.location.href = 'mailto:opgamer012321@gmail.com'}
          >
            <Mail className="h-4 w-4 mr-2" />
            Contact Us
          </Button>

          {isOwner && (
            <Button 
              variant="ghost" 
              className="w-full justify-start hover:bg-accent transition-all duration-200 hover:scale-[1.02]" 
              size="sm"
              onClick={() => navigate('/admin')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Control Panel
            </Button>
          )}
          
          <div className="flex items-center gap-2 p-2 border-t border-border animate-fade-in">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-transform hover:scale-110 duration-200">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{user?.name}</span>
                {userRole && userRole !== 'user' && (
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-5 font-bold border shadow-sm ${getRoleBadgeStyle(userRole)}`}>
                    {getRoleLabel(userRole)}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout} 
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-110"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
