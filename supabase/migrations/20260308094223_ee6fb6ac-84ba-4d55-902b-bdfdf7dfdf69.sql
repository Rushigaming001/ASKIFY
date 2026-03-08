
-- Security audit log table for tracking suspicious activity
CREATE TABLE public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX idx_security_logs_created_at ON public.security_logs(created_at DESC);

-- RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Only owners can view security logs
CREATE POLICY "Owners can view security logs"
  ON public.security_logs FOR SELECT
  USING (public.is_owner(auth.uid()));

-- System can insert (via service role), and authenticated users can log their own events
CREATE POLICY "Authenticated users can insert security logs"
  ON public.security_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Nobody can update or delete security logs (immutable audit trail)
CREATE POLICY "Nobody can update security logs"
  ON public.security_logs FOR UPDATE
  USING (false);

CREATE POLICY "Nobody can delete security logs"
  ON public.security_logs FOR DELETE
  USING (false);
