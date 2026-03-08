import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart } from 'lucide-react';

interface Transaction {
  id: string;
  from_user_id: string | null;
  to_user_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  from_name?: string;
  to_name?: string;
}

export default function PurchaseHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('transaction_type', 'purchase')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.flatMap(t => [t.from_user_id, t.to_user_id].filter(Boolean)))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds as string[]);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      setTransactions(data.map(t => ({
        ...t,
        from_name: t.from_user_id ? profileMap.get(t.from_user_id) || 'Unknown' : undefined,
        to_name: profileMap.get(t.to_user_id) || 'Unknown',
      })));
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Purchase History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No purchases yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div>
                  <p className="text-sm font-medium">{t.to_name}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                  {t.amount} AC
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
