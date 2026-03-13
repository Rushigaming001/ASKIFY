
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  category text NOT NULL DEFAULT 'other',
  rating numeric(2,1) NOT NULL DEFAULT 4.0,
  rating_count integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Owners admins can manage products" ON public.products FOR ALL TO authenticated USING (is_owner_or_admin(auth.uid())) WITH CHECK (is_owner_or_admin(auth.uid()));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  total numeric(10,2) NOT NULL DEFAULT 0,
  address text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can view all orders" ON public.orders FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));

CREATE TABLE public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reward_type text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cashouts" ON public.cashout_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create cashouts" ON public.cashout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can view all cashouts" ON public.cashout_requests FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owners can update cashouts" ON public.cashout_requests FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
