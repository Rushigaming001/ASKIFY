import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// VAPID public key - this is safe to expose in frontend
const VAPID_PUBLIC_KEY = 'BP7_FXiZuP4Gl8lit9DLO-Vc3jWjjEMO5HQI8ZGLr7A3SPLeC3Xh8_sAAbMR30pI-MzM8TfBsX3kgov55MtyHKY';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (isSupported && user) {
      checkSubscription();
    }
  }, [isSupported, user]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers not supported');
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  };

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to enable notifications');
      return false;
    }

    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const notificationPermission = await Notification.requestPermission();
      setPermission(notificationPermission);

      if (notificationPermission !== 'granted') {
        toast.error('Notification permission denied');
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();

      // Subscribe to push notifications
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const subscriptionJson = subscription.toJSON();
      
      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        throw new Error('Invalid subscription data');
      }

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) {
        console.error('Error saving subscription:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast.success('Push notifications enabled!');
      return true;

    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast.error('Failed to enable push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast.success('Push notifications disabled');
      return true;

    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to disable push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Function to send a push notification to a user
  const sendNotification = useCallback(async (
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) => {
    console.log('[Push] Attempting to send notification:', { userId, title, body });
    
    try {
      const { data: response, error } = await supabase.functions.invoke('send-push-notification', {
        body: { userId, title, body, data },
      });

      if (error) {
        console.error('[Push] Error sending notification:', error);
        return false;
      }

      console.log('[Push] Notification response:', response);
      return response?.sent > 0;
    } catch (error) {
      console.error('[Push] Exception sending notification:', error);
      return false;
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    sendNotification,
  };
}
