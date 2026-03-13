import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ArrowLeft, Coins, Gift, CreditCard, Smartphone, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CashoutRequest {
  id: string;
  amount: number;
  reward_type: string;
  details: string | null;
  status: string;
  created_at: string;
}

const rewardTypes = [
  { value: 'gift_card', label: 'Gift Card', icon: Gift, description: 'Amazon, Google Play, iTunes, etc.' },
  { value: 'upi', label: 'UPI Transfer', icon: Smartphone, description: 'Direct UPI payment' },
  { value: 'bank', label: 'Bank Transfer', icon: CreditCard, description: 'Direct bank deposit' },
  { value: 'crypto', label: 'Crypto', icon: Coins, description: 'Bitcoin, USDT, etc.' },
];

const Cashout = () => {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [rewardType, setRewardType] = useState('');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<CashoutRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [{ data: coins }, { data: requests }] = await Promise.all([
        supabase.from('user_coins').select('balance').eq('user_id', user.id).maybeSingle(),
        supabase.from('cashout_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setBalance(coins?.balance || 0);
      setHistory(requests || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !rewardType || !amount || !details) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    const amt = parseInt(amount);
    if (isNaN(amt) || amt < 100) {
      toast({ title: 'Minimum cashout is 100 coins', variant: 'destructive' });
      return;
    }
    if (amt > balance) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('cashout_requests').insert({
        user_id: user.id,
        amount: amt,
        reward_type: rewardType,
        details: details.trim(),
      });
      if (error) throw error;

      // Deduct coins
      await supabase.from('user_coins').update({ balance: balance - amt }).eq('user_id', user.id);
      setBalance(prev => prev - amt);

      toast({ title: 'Cashout request submitted! ✅' });
      setRewardType('');
      setAmount('');
      setDetails('');

      // Refresh history
      const { data } = await supabase.from('cashout_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setHistory(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'rejected') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  const detailsPlaceholder = () => {
    switch (rewardType) {
      case 'gift_card': return 'Enter gift card type (e.g., Amazon $10) and email to receive it';
      case 'upi': return 'Enter your UPI ID (e.g., name@upi)';
      case 'bank': return 'Enter bank name, account number, IFSC code';
      case 'crypto': return 'Enter wallet address and coin type (e.g., BTC, USDT)';
      default: return 'Select a reward type first';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Cashout</h1>
      </header>

      <ScrollArea className="h-[calc(100vh-57px)]">
        <div className="max-w-lg mx-auto p-4 space-y-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-6 text-center">
              <Coins className="h-10 w-10 text-amber-500 mx-auto mb-2" />
              <p className="text-3xl font-black text-foreground">{balance.toLocaleString()}</p>
              <p className="text-muted-foreground text-sm">Available Coins</p>
              <p className="text-xs text-muted-foreground mt-1">100 coins = ₹1 equivalent</p>
            </CardContent>
          </Card>

          {/* Cashout Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Cashout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Reward Type</label>
                <Select value={rewardType} onValueChange={setRewardType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reward type" />
                  </SelectTrigger>
                  <SelectContent>
                    {rewardTypes.map(rt => (
                      <SelectItem key={rt.value} value={rt.value}>
                        <div className="flex items-center gap-2">
                          <rt.icon className="h-4 w-4" />
                          <span>{rt.label}</span>
                          <span className="text-muted-foreground text-xs ml-1">— {rt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Amount (coins)</label>
                <Input
                  type="number"
                  min={100}
                  max={balance}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Minimum 100 coins"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Details</label>
                <Textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder={detailsPlaceholder()}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <Button onClick={handleSubmit} disabled={submitting || !rewardType || !amount || !details} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Cashout Request
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cashout History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      {statusIcon(req.status)}
                      <div>
                        <p className="text-sm font-medium capitalize">{req.reward_type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-600">{req.amount} AC</p>
                      <Badge variant="outline" className="text-xs capitalize">{req.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Cashout;
