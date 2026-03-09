import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

export function usePresenceTracker() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const updatePresence = async (status: 'online' | 'offline') => {
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    };

    // Set online immediately
    updatePresence('online');

    // Heartbeat
    intervalRef.current = setInterval(() => {
      updatePresence('online');
    }, HEARTBEAT_INTERVAL);

    // Set offline on tab close
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`;
      const body = JSON.stringify({ status: 'offline', last_seen: new Date().toISOString(), updated_at: new Date().toISOString() });
      navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (intervalRef.current) clearInterval(intervalRef.current);
      updatePresence('offline');
    };
  }, [user?.id]);
}
