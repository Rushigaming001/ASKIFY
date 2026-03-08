import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowLeft, Crown, Rocket, Diamond, Award, Star, Gem, Shield, Sparkles, Zap, X, Send, MessageSquare, Mail, Gift, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CoinBalance } from '@/components/CoinSystem';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import pricingLogo from '@/assets/pricing-logo.png';

const iconMap: Record<string, React.ReactNode> = {
  plus: <Diamond className="h-6 w-6" />,
  pro: <Rocket className="h-6 w-6" />,
  elite: <Crown className="h-6 w-6" />,
  silver: <Award className="h-6 w-6" />,
  gold: <Star className="h-6 w-6" />,
  platinum: <Gem className="h-6 w-6" />,
  basic: <Shield className="h-6 w-6" />,
  premium: <Sparkles className="h-6 w-6" />,
  vip: <Zap className="h-6 w-6" />,
};

const tierGradients: Record<string, string> = {
  'Tier 1': 'from-blue-500/10 via-indigo-500/5 to-purple-500/10',
  'Tier 2': 'from-amber-500/10 via-yellow-500/5 to-orange-500/10',
  'Tier 3': 'from-emerald-500/10 via-teal-500/5 to-cyan-500/10',
};

const tierBorderColors: Record<string, string> = {
  'Tier 1': 'border-indigo-500/30',
  'Tier 2': 'border-amber-500/30',
  'Tier 3': 'border-emerald-500/30',
};

interface Plan {
  id: string;
  display_name: string;
  description: string | null;
  role_name: string;
  coin_price: number;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  tier: string;
  sort_order: number;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [heroText, setHeroText] = useState({ title: 'Choose Your Perfect Plan', subtitle: 'Unlock premium features and supercharge your Askify experience with Askify Coins' });
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  // Gift dialog
  const [showGift, setShowGift] = useState(false);
  const [giftPlanId, setGiftPlanId] = useState('');
  const [giftPlanName, setGiftPlanName] = useState('');
  const [giftSearch, setGiftSearch] = useState('');
  const [giftUsers, setGiftUsers] = useState<{ id: string; name: string; avatar_url?: string }[]>([]);
  const [giftTarget, setGiftTarget] = useState('');
  const [gifting, setGifting] = useState(false);

  useEffect(() => {
    loadPlans();
    loadHeroText();
    if (user) loadUserRoles();
  }, [user]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      setPlans((data || []).map(p => ({
        ...p,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHeroText = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'pricing_hero_text')
      .maybeSingle();
    if (data?.value && typeof data.value === 'object') {
      const v = data.value as Record<string, string>;
      if (v.title) setHeroText({ title: v.title, subtitle: v.subtitle || '' });
    }
  };

  const loadUserRoles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    setUserRoles((data || []).map(r => r.role));
  };

  const hasRole = (roleName: string) => userRoles.includes(roleName);

  const handlePurchase = async (planId: string) => {
    if (!user) { navigate('/auth'); return; }
    
    const plan = plans.find(p => p.id === planId);
    if (plan && hasRole(plan.role_name)) {
      toast.error('You already own this plan!');
      return;
    }
    
    setPurchasing(planId);
    try {
      const { data, error } = await supabase.rpc('purchase_subscription', {
        _user_id: user.id,
        _plan_id: planId,
      });
      if (error) throw error;
      if (data) {
        toast.success('🎉 Subscription purchased! Role granted.');
        loadPlans();
        loadUserRoles();
      } else {
        toast.error('Not enough Askify Coins or plan unavailable.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPurchasing(null);
    }
  };

  const openGiftDialog = async (planId: string, planName: string) => {
    setGiftPlanId(planId);
    setGiftPlanName(planName);
    setGiftTarget('');
    setGiftSearch('');
    setShowGift(true);
    // Load users
    const { data } = await supabase.from('profiles').select('id, name, avatar_url');
    if (data) setGiftUsers(data.filter(u => u.id !== user?.id));
  };

  const handleGift = async () => {
    if (!user || !giftTarget || !giftPlanId) return;
    setGifting(true);
    try {
      const { data, error } = await supabase.rpc('purchase_subscription', {
        _user_id: user.id,
        _plan_id: giftPlanId,
      });
      if (error) throw error;
      if (!data) { toast.error('Not enough coins'); setGifting(false); return; }
      
      // The purchase_subscription gives role to _user_id, but we want to gift to giftTarget
      // So we need to: remove the role from buyer, add to target
      const plan = plans.find(p => p.id === giftPlanId);
      if (plan) {
        // Remove from buyer (was just added)
        await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', plan.role_name as any);
        // Add to target
        await supabase.from('user_roles').insert({ user_id: giftTarget, role: plan.role_name as any });
        // Send DM notification
        await supabase.from('direct_messages').insert({
          sender_id: user.id,
          receiver_id: giftTarget,
          content: `🎁 You've been gifted the **${plan.display_name}** plan! Enjoy your new role.`,
        });
      }
      toast.success(`🎁 Gift sent! ${giftPlanName} gifted successfully.`);
      setShowGift(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGifting(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) { toast.error('Please enter your feedback'); return; }
    setSendingFeedback(true);
    try {
      if (user) {
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();

        if (ownerRole) {
          await supabase.from('direct_messages').insert({
            sender_id: user.id,
            receiver_id: ownerRole.user_id,
            content: `📋 **Feedback from ${feedbackEmail || 'User'}:**\n\n${feedbackText}`,
          });
        }
      }

      await supabase.functions.invoke('send-feedback', {
        body: {
          email: feedbackEmail || (user ? 'Logged-in user' : 'Anonymous'),
          message: feedbackText,
          userId: user?.id || null,
        },
      });

      toast.success('Feedback sent! Thank you for your input.');
      setShowFeedback(false);
      setFeedbackText('');
      setFeedbackEmail('');
    } catch (err: any) {
      toast.error('Failed to send feedback');
    } finally {
      setSendingFeedback(false);
    }
  };

  const groupedPlans = plans.reduce((acc, plan) => {
    if (!acc[plan.tier]) acc[plan.tier] = [];
    acc[plan.tier].push(plan);
    return acc;
  }, {} as Record<string, Plan[]>);

  const filteredGiftUsers = giftUsers.filter(u => u.name.toLowerCase().includes(giftSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-accent/20" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, hsl(var(--primary) / 0.15), transparent 60%), radial-gradient(ellipse at 70% 80%, hsl(250 91% 60% / 0.1), transparent 50%)' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 pt-6 pb-12 sm:pb-16">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover-lift">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CoinBalance compact />
          </div>

          <div className="text-center max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <img src={pricingLogo} alt="Askify Premium" className="h-20 w-20 sm:h-24 sm:w-24 drop-shadow-lg" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 gradient-text">
              {heroText.title}
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
              {heroText.subtitle}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Badge variant="secondary" className="px-4 py-1.5 text-sm gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Pay with Askify Coins
              </Badge>
              <Badge variant="outline" className="px-4 py-1.5 text-sm gap-1.5 cursor-pointer hover:bg-accent" onClick={() => setShowFeedback(true)}>
                <MessageSquare className="h-3.5 w-3.5" /> Feedback
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-7xl mx-auto px-4 pb-16 -mt-4">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => (
              <Card key={i} className="shimmer h-80" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20">
            <Crown className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-lg">No plans available yet. Check back soon!</p>
          </div>
        ) : (
          Object.entries(groupedPlans).map(([tier, tierPlans]) => (
            <div key={tier} className="mb-14">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold">{tier}</h2>
                <div className={`h-px flex-1 bg-gradient-to-r ${tier === 'Tier 1' ? 'from-indigo-500/40' : tier === 'Tier 2' ? 'from-amber-500/40' : 'from-emerald-500/40'} to-transparent`} />
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tierPlans.map((plan) => {
                  const owned = hasRole(plan.role_name);
                  return (
                    <Card
                      key={plan.id}
                      className={`relative group transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-gradient-to-br ${tierGradients[plan.tier] || ''} ${plan.is_popular ? `ring-2 ring-primary/40 shadow-xl shadow-primary/10 ${tierBorderColors[plan.tier] || ''}` : 'hover:shadow-primary/5'} ${owned ? 'ring-2 ring-green-500/40' : ''}`}
                    >
                      {owned && (
                        <div className="absolute -top-3 right-4 z-10">
                          <Badge className="bg-green-500 text-white shadow-lg px-3 py-1 gap-1">
                            <CheckCircle className="h-3 w-3" /> Current Plan
                          </Badge>
                        </div>
                      )}
                      {plan.is_popular && !owned && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-primary text-primary-foreground shadow-lg shadow-primary/30 px-4 py-1">
                            ⚡ Most Popular
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="text-center pb-2 pt-6">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                          {iconMap[plan.role_name] || <Star className="h-6 w-6" />}
                        </div>
                        <CardTitle className="text-xl font-bold">{plan.display_name}</CardTitle>
                        <CardDescription className="text-sm">{plan.description}</CardDescription>
                        <div className="mt-4 flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-extrabold">{plan.coin_price}</span>
                          <span className="text-sm text-muted-foreground font-medium">AC</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pb-6">
                        <ul className="space-y-2.5">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-sm">
                              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Check className="h-3 w-3 text-primary" />
                              </div>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <Button
                            className={`flex-1 h-11 font-semibold ${plan.is_popular && !owned ? 'btn-glow' : ''}`}
                            variant={owned ? 'secondary' : plan.is_popular ? 'default' : 'outline'}
                            onClick={() => handlePurchase(plan.id)}
                            disabled={purchasing === plan.id || owned}
                          >
                            {owned ? (
                              <><CheckCircle className="h-4 w-4 mr-1" /> Owned</>
                            ) : purchasing === plan.id ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing...</>
                            ) : (
                              `Buy for ${plan.coin_price} AC`
                            )}
                          </Button>
                          {!owned && user && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              title="Gift this plan"
                              onClick={() => openGiftDialog(plan.id, plan.display_name)}
                            >
                              <Gift className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Contact & Feedback Section */}
        <div className="mt-16 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <Card className="card-hover text-center p-8">
            <Mail className="h-10 w-10 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Contact Us</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Have questions? Reach out to us directly.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:opgamer012321@gmail.com">
                <Mail className="h-4 w-4 mr-2" />
                Email Us
              </a>
            </Button>
          </Card>
          <Card className="card-hover text-center p-8 cursor-pointer" onClick={() => setShowFeedback(true)}>
            <MessageSquare className="h-10 w-10 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Share Feedback</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Tell us what changes you'd like to see.
            </p>
            <Button variant="outline">
              <Send className="h-4 w-4 mr-2" />
              Give Feedback
            </Button>
          </Card>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Share Your Feedback
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Your email (optional)"
              value={feedbackEmail}
              onChange={e => setFeedbackEmail(e.target.value)}
            />
            <Textarea
              placeholder="What changes would you like to see?"
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <Button className="w-full" onClick={handleSendFeedback} disabled={sendingFeedback}>
              {sendingFeedback ? 'Sending...' : 'Send Feedback'}
              <Send className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Your feedback will be sent to the Askify team via email and in-app message.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gift Dialog */}
      <Dialog open={showGift} onOpenChange={setShowGift}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Gift {giftPlanName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Search users..."
              value={giftSearch}
              onChange={e => setGiftSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredGiftUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => setGiftTarget(u.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${giftTarget === u.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}
                >
                  <Avatar className="h-6 w-6">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback className="text-[10px]">{u.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={handleGift} disabled={!giftTarget || gifting}>
              {gifting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
              Gift Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
