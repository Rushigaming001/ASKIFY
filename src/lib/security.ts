import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type SecurityEventType = 
  | 'unauthorized_admin_access'
  | 'suspicious_navigation'
  | 'devtools_detected'
  | 'xss_attempt'
  | 'rapid_requests'
  | 'session_anomaly';

interface SecurityEvent {
  event_type: SecurityEventType;
  details?: Record<string, unknown>;
  severity?: 'info' | 'warn' | 'critical';
}

// Rate limiter for security log submissions (prevent log flooding)
const logTimestamps: number[] = [];
const MAX_LOGS_PER_MINUTE = 10;

function canLog(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  // Remove old entries
  while (logTimestamps.length > 0 && logTimestamps[0] < oneMinuteAgo) {
    logTimestamps.shift();
  }
  if (logTimestamps.length >= MAX_LOGS_PER_MINUTE) return false;
  logTimestamps.push(now);
  return true;
}

export async function logSecurityEvent(event: SecurityEvent, userId?: string) {
  if (!canLog()) return;
  
  try {
    await supabase.from('security_logs').insert([{
      user_id: userId || null,
      event_type: event.event_type,
      details: (event.details || {}) as Record<string, string>,
      severity: event.severity || 'info',
      user_agent: navigator.userAgent,
    }]);
  } catch {
    // Silently fail - don't expose security logging to attackers
  }
}

// Detect and block common XSS patterns in user input
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Strip HTML tags
  let clean = input.replace(/<[^>]*>/g, '');
  // Remove javascript: protocol
  clean = clean.replace(/javascript\s*:/gi, '');
  // Remove event handlers
  clean = clean.replace(/on\w+\s*=/gi, '');
  // Remove data: URIs (except images)
  clean = clean.replace(/data\s*:\s*(?!image\/)[^;,]*/gi, '');
  
  return clean;
}

// Check if input contains potential XSS
export function detectXSS(input: string): boolean {
  if (typeof input !== 'string') return false;
  const xssPatterns = [
    /<script\b/i,
    /javascript\s*:/i,
    /on(error|load|click|mouseover|focus|blur)\s*=/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /eval\s*\(/i,
    /document\.(cookie|write|location)/i,
    /window\.(location|open)/i,
  ];
  return xssPatterns.some(pattern => pattern.test(input));
}

// Hook: Anti-tampering protection for the app
export function useSecurityGuard() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // Disable right-click context menu in production (optional deterrent)
    const handleContextMenu = (e: MouseEvent) => {
      // Allow in development
      if (import.meta.env.DEV) return;
    };

    // Detect devtools open (basic detection)
    let devtoolsOpen = false;
    const detectDevTools = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          logSecurityEvent({
            event_type: 'devtools_detected',
            severity: 'warn',
            details: { timestamp: new Date().toISOString() }
          }, user?.id);
        }
      } else {
        devtoolsOpen = false;
      }
    };

    const interval = setInterval(detectDevTools, 2000);

    // Protect against prototype pollution
    const freezePrototypes = () => {
      try {
        Object.freeze(Object.prototype);
        Object.freeze(Array.prototype);
      } catch {
        // Some environments don't allow this
      }
    };

    // Only in production
    if (!import.meta.env.DEV) {
      freezePrototypes();
    }

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  return { blocked };
}

// Hook: Protect admin routes with server-side verification
export function useAdminGuard() {
  const { user, session, isLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    
    if (!session?.user) {
      setIsAuthorized(false);
      setChecking(false);
      
      logSecurityEvent({
        event_type: 'unauthorized_admin_access',
        severity: 'warn',
        details: { route: window.location.pathname }
      });
      return;
    }

    const verify = async () => {
      try {
        const { data: allowed } = await supabase.rpc('is_owner_or_admin', {
          _user_id: session.user.id,
        });
        
        if (!allowed) {
          logSecurityEvent({
            event_type: 'unauthorized_admin_access',
            severity: 'critical',
            details: { 
              route: window.location.pathname,
              email: session.user.email 
            }
          }, session.user.id);
        }
        
        setIsAuthorized(!!allowed);
      } catch {
        setIsAuthorized(false);
      } finally {
        setChecking(false);
      }
    };

    verify();
  }, [session?.user?.id, isLoading]);

  return { isAuthorized, checking };
}

// Secure fetch wrapper that validates responses
export async function secureFetch(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'X-Requested-With': 'XMLHttpRequest', // CSRF protection
    },
  });
  
  // Check for redirect attacks
  if (response.redirected && !response.url.startsWith(window.location.origin)) {
    throw new Error('Suspicious redirect detected');
  }
  
  return response;
}
