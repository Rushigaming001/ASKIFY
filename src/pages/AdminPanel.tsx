import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, Edit2, Shield, ArrowLeft, UserPlus, Lock, Eye, Sparkles, Construction, Blocks, Coins, Crown, ShoppingCart } from 'lucide-react';
import ModelPermissionsManager from '@/components/ModelPermissionsManager';
import RolePermissionsManager from '@/components/RolePermissionsManager';
import RoleAbilitiesManager from '@/components/RoleAbilitiesManager';
import { UsageTrafficPanel } from '@/components/UsageTrafficPanel';
import { ChatAnalyticsPanel } from '@/components/ChatAnalyticsPanel';
import UserControlsManager from '@/components/UserControlsManager';
import MessageLimitsManager from '@/components/MessageLimitsManager';
import PremiumRolesManager from '@/components/PremiumRolesManager';
import OwnerAccountSwitcher from '@/components/OwnerAccountSwitcher';
import ModelLimitsManager from '@/components/ModelLimitsManager';
import MaintenanceManager from '@/components/admin/MaintenanceManager';
import FeatureManager from '@/components/admin/FeatureManager';
import CoinManager from '@/components/admin/CoinManager';
import PlanManager from '@/components/admin/PlanManager';
import PurchaseHistory from '@/components/admin/PurchaseHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Profile {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

function FeedbackViewer() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setFeedbacks(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading feedback...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Feedback</CardTitle>
        <CardDescription>{feedbacks.length} feedback submissions</CardDescription>
      </CardHeader>
      <CardContent>
        {feedbacks.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No feedback yet</p>
        ) : (
          <div className="space-y-3">
            {feedbacks.map(fb => (
              <div key={fb.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{fb.email || 'Anonymous'}</span>
                  <span className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{fb.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const { user, session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['user']);
  const [editingUserRole, setEditingUserRole] = useState<Profile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['user']);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    checkAdminStatus();
    // Only re-check when the authenticated user changes (avoid TOKEN_REFRESHED loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, isLoading]);

  const checkAdminStatus = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const activeSession = currentSession ?? session;

    if (!activeSession?.user) {
      navigate('/auth');
      setLoading(false);
      return;
    }

    try {
      const userId = activeSession.user.id;

      const { data: allowed, error } = await supabase.rpc('is_owner', {
        _user_id: userId,
      });

      if (error) throw error;

      if (!allowed) {
        toast.error(`Access denied for ${activeSession.user.email || 'your account'}. Owner privileges required.`);
        navigate('/');
        return;
      }

      setIsOwner(true);
      setIsAdmin(true);
      loadUsers();
    } catch (error: any) {
      console.error('Error checking admin status:', error);
      toast.error('Failed to verify admin access');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Load all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setProfiles(profilesData || []);

      // Load all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Group roles by user_id
      const rolesMap: Record<string, string[]> = {};
      rolesData?.forEach((role: UserRole) => {
        if (!rolesMap[role.user_id]) {
          rolesMap[role.user_id] = [];
        }
        rolesMap[role.user_id].push(role.role);
      });

      setUserRoles(rolesMap);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user: ${userEmail}?`)) {
      return;
    }

    try {
      // Delete from profiles (cascade will handle user_roles)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast.success('User deleted successfully');
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleEditUser = (profile: Profile) => {
    setEditingUser(profile);
    setEditName(profile.name);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editName })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success('User updated successfully');
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      // Create auth user using admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: { name: newUserName },
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Assign roles to the new user
        for (const role of newUserRoles) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: role as any
            });

          if (roleError) throw roleError;
        }

        toast.success(`User created successfully with ${newUserRoles.join(', ')} role(s)`);
        setShowCreateUser(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserName('');
        setNewUserRoles(['user']);
        loadUsers();
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user: ' + error.message);
    }
  };

  const handleEditUserRole = (profile: Profile) => {
    // Check if trying to edit owner role
    const currentRoles = userRoles[profile.id] || ['user'];
    if (currentRoles.includes('owner') && !isOwner) {
      toast.error('You cannot modify the Owner role');
      return;
    }
    
    setEditingUserRole(profile);
    setSelectedRoles(currentRoles);
  };

  const handleSaveRoles = async () => {
    if (!editingUserRole) return;

    // Protection: Never allow removing owner role
    const currentRoles = userRoles[editingUserRole.id] || [];
    if (currentRoles.includes('owner') && !selectedRoles.includes('owner')) {
      toast.error('Owner role cannot be removed');
      return;
    }

    try {
      // Delete existing roles for this user
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUserRole.id);

      // Insert all selected roles
      for (const role of selectedRoles) {
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: editingUserRole.id,
            role: role as any
          });

        if (error) throw error;
      }

      toast.success('Roles updated successfully');
      setEditingUserRole(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating roles:', error);
      toast.error('Failed to update roles');
    }
  };
  
  const toggleRole = (role: string) => {
    // Protection: Never allow toggling off owner role if user has it
    const currentRoles = userRoles[editingUserRole?.id || ''] || [];
    if (role === 'owner' && currentRoles.includes('owner')) {
      toast.error('Owner role cannot be removed');
      return;
    }
    
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Control Panel</h1>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-3">Users</TabsTrigger>
            <TabsTrigger value="controls" className="text-xs sm:text-sm px-2 sm:px-3">Controls</TabsTrigger>
            <TabsTrigger value="limits" className="text-xs sm:text-sm px-2 sm:px-3">Limits</TabsTrigger>
            {isOwner && (
              <TabsTrigger value="model-limits" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <Sparkles className="h-3 w-3" />
                Model Limits
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="view-activity" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <Eye className="h-3 w-3" />
                View Activity
              </TabsTrigger>
            )}
            <TabsTrigger value="roles" className="text-xs sm:text-sm px-2 sm:px-3">Roles</TabsTrigger>
            <TabsTrigger value="abilities" className="text-xs sm:text-sm px-2 sm:px-3">Abilities</TabsTrigger>
            <TabsTrigger value="models" className="text-xs sm:text-sm px-2 sm:px-3">Models</TabsTrigger>
            <TabsTrigger value="premium" className="text-xs sm:text-sm px-2 sm:px-3">Premium</TabsTrigger>
            <TabsTrigger value="usage" className="text-xs sm:text-sm px-2 sm:px-3">AI Usage</TabsTrigger>
            <TabsTrigger value="chat-analytics" className="text-xs sm:text-sm px-2 sm:px-3">Chat Stats</TabsTrigger>
            {isOwner && (
              <TabsTrigger value="maintenance" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <Construction className="h-3 w-3" />
                Maintenance
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="features" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <Blocks className="h-3 w-3" />
                Features
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="coins" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <Coins className="h-3 w-3" />
                Coins
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="plans" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <Crown className="h-3 w-3" />
                Plans
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="purchases" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                <ShoppingCart className="h-3 w-3" />
                Purchases
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="feedback" className="text-xs sm:text-sm px-2 sm:px-3 gap-1">
                📬 Feedback
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      Manage all registered users and their accounts
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateUser(true)} className="w-full sm:w-auto">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{profile.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {profile.email}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Joined: {new Date(profile.created_at).toLocaleDateString()}
                        </div>
                        {userRoles[profile.id] && (
                          <div className="flex gap-2 mt-2">
                            {userRoles[profile.id].map((role) => (
                              <span
                                key={role}
                                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUserRole(profile)}
                          title="Change Role"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(profile)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(profile.id, profile.email)}
                          disabled={profile.id === user?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {profiles.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="controls">
            <UserControlsManager />
          </TabsContent>

          <TabsContent value="limits">
            <MessageLimitsManager />
          </TabsContent>

          {isOwner && (
            <TabsContent value="model-limits">
              <ModelLimitsManager />
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="view-activity">
              <OwnerAccountSwitcher />
            </TabsContent>
          )}

          <TabsContent value="roles">
            <RolePermissionsManager />
          </TabsContent>

          <TabsContent value="abilities">
            <RoleAbilitiesManager />
          </TabsContent>

          <TabsContent value="models">
            <ModelPermissionsManager />
          </TabsContent>

          <TabsContent value="premium">
            <PremiumRolesManager />
          </TabsContent>

          <TabsContent value="usage">
            <UsageTrafficPanel />
          </TabsContent>

          <TabsContent value="chat-analytics">
            <ChatAnalyticsPanel />
          </TabsContent>

          {isOwner && (
            <TabsContent value="maintenance">
              <MaintenanceManager />
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="features">
              <FeatureManager />
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="coins">
              <CoinManager />
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="plans">
              <PlanManager />
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="purchases">
              <PurchaseHistory />
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="feedback">
              <FeedbackViewer />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editingUser?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new account with specified role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles (select multiple)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase mb-1">Standard Roles</div>
                {['user', 'friend', 'moderator', 'sr_moderator', 'admin', 'sr_admin', 'education_admin', 'learning_department', 'learning_manager', 'co_founder', 'founder', 'ceo', 'owner'].map(role => (
                  <label key={role} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox 
                      checked={newUserRoles.includes(role)} 
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewUserRoles([...newUserRoles, role]);
                        } else {
                          setNewUserRoles(newUserRoles.filter(r => r !== role));
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{role.replace(/_/g, ' ')}</span>
                  </label>
                ))}
                {isOwner && (
                  <>
                    <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase mt-2 border-t pt-2">Paid Roles</div>
                    {['plus', 'pro', 'elite', 'silver', 'gold', 'platinum', 'basic', 'premium', 'vip'].map(role => (
                      <label key={role} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox 
                          checked={newUserRoles.includes(role)} 
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUserRoles([...newUserRoles, role]);
                            } else {
                              setNewUserRoles(newUserRoles.filter(r => r !== role));
                            }
                          }}
                        />
                        <span className="text-sm capitalize">{role}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUserRole} onOpenChange={() => setEditingUserRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update role for {editingUserRole?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Roles (select multiple)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase mb-1">Standard Roles</div>
                {['user', 'friend', 'moderator', 'sr_moderator', 'admin', 'sr_admin', 'education_admin', 'learning_department', 'learning_manager', 'co_founder', 'founder', 'ceo', 'owner'].map(role => {
                  const isOwnerRole = role === 'owner';
                  const hasOwnerRole = userRoles[editingUserRole?.id || '']?.includes('owner');
                  const isDisabled = isOwnerRole && hasOwnerRole; // Can't uncheck owner
                  
                  return (
                    <label key={role} className={`flex items-center gap-2 p-2 rounded hover:bg-muted ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <Checkbox 
                        checked={selectedRoles.includes(role)} 
                        disabled={isDisabled}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <span className="text-sm capitalize">{role.replace(/_/g, ' ')}</span>
                      {isOwnerRole && hasOwnerRole && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </label>
                  );
                })}
                {isOwner && (
                  <>
                    <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase mt-2 border-t pt-2">Paid Roles</div>
                    {['plus', 'pro', 'elite', 'silver', 'gold', 'platinum', 'basic', 'premium', 'vip'].map(role => (
                      <label key={role} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox 
                          checked={selectedRoles.includes(role)} 
                          onCheckedChange={() => toggleRole(role)}
                        />
                        <span className="text-sm capitalize">{role}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
              {userRoles[editingUserRole?.id || '']?.includes('owner') && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Owner role is protected and cannot be removed
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingUserRole(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
